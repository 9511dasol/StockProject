"""AI 판단 진행 상황 스트리밍 (명세 6.4).

`generate_advice()`는 전부 끝난 뒤 결과 하나를 돌려준다. 그런데 종목당 LLM
호출이 4회(에이전트 3 + 의사결정 1)라 수십 초가 걸리고, 그동안 화면이 아무것도
말하지 못한다. 그래서 같은 오케스트레이션을 단계별로 쪼개 이벤트로 흘린다.

이벤트는 프런트가 기대하는 4단계와 1:1로 대응한다.
    {"stage": 1}                      주가 데이터 조회 완료
    {"stage": 2}                      뉴스·리포트 수집 완료
    {"stage": 3, "agent": {...}} × 3  에이전트 의견 (끝나는 순서대로)
    {"stage": 4, "decision": {...}}   최종 판단 종합
    {"stage": n, "error": "..."}      복구 불가능한 실패
"""

import asyncio
import logging
from collections.abc import AsyncIterator
from datetime import UTC, datetime

from app.agents.analysts import build_context, invoke_one
from app.agents.decision import decide
from app.agents.prompts import ANALYST_PROFILES
from app.schemas.advice import (
    AdviceStreamDecision,
    AdviceStreamEvent,
    StockRef,
    resolve_decision_label,
)
from app.schemas.stock import KrxListing, StockHistoryParams
from app.services import stock_service

logger = logging.getLogger(__name__)

_ADVICE_ROW_LIMIT = 504
_ADVICE_TIMEFRAME = "day"


async def stream_advice(
    symbol: str, *, listing: KrxListing | None = None
) -> AsyncIterator[AdviceStreamEvent]:
    """단계 이벤트를 순서대로 내보낸다. 소비자가 끊으면 GeneratorExit로 종료된다."""
    try:
        # 1) 주가 — 뉴스·리포트는 응답 시간의 대부분을 차지하므로 뒤로 미룬다.
        params = StockHistoryParams(
            symbol=symbol, timeframe=_ADVICE_TIMEFRAME, limit=_ADVICE_ROW_LIMIT
        )
        stock_data = await stock_service.get_history(
            params, include_content=False, listing=listing
        )
        metrics = stock_service.get_metrics(stock_data)
        yield AdviceStreamEvent(stage=1)

        # 2) 뉴스·리포트
        content = await stock_service.get_content(stock_data.symbol)
        stock_data = stock_data.model_copy(
            update={"news": content.news, "reports": content.reports}
        )
        yield AdviceStreamEvent(stage=2)

        # 3) 에이전트 3인 병렬 — 먼저 끝난 것부터 내보낸다.
        context = build_context(stock_data, metrics)
        tasks = [
            asyncio.create_task(invoke_one(profile, context, metrics))
            for profile in ANALYST_PROFILES
        ]
        opinions = []
        try:
            for finished in asyncio.as_completed(tasks):
                opinion = await finished
                opinions.append(opinion)
                yield AdviceStreamEvent(stage=3, agent=opinion)
        except BaseException:
            for task in tasks:
                task.cancel()
            raise

        # 4) 최종 판단
        decision, used_fallback = await decide(stock_data, metrics, opinions)
        yield AdviceStreamEvent(
            stage=4,
            decision=AdviceStreamDecision(
                stock=StockRef(
                    name=stock_data.name,
                    symbol=stock_data.symbol,
                    query=stock_data.query,
                ),
                verdict=decision.verdict,
                decision_label=resolve_decision_label(decision.verdict, decision.decision_label),
                confidence=decision.confidence,
                answer=decision.answer,
                buy_conditions=decision.buy_conditions,
                risk_notes=decision.risk_notes,
                decision_source="fallback" if used_fallback else "llm",
                updated_at=datetime.now(UTC).isoformat(timespec="seconds"),
            ),
        )
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        # 주가 조회 실패처럼 복구 불가능한 경우. 에이전트·판단 실패는 각 계층이
        # 이미 규칙 기반으로 흡수하므로 여기까지 오지 않는다.
        logger.warning("AI 판단 스트림 실패 (%s)", exc)
        yield AdviceStreamEvent(stage=0, error=str(exc))
