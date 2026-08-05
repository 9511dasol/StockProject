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
from app.services import advice_cache, fundamentals_service, rag_service, stock_service

logger = logging.getLogger(__name__)

_ADVICE_ROW_LIMIT = 504
_ADVICE_TIMEFRAME = "day"


def _replay(
    stock_data_ref: StockRef, outcome: advice_cache.AdviceOutcome
) -> list[AdviceStreamEvent]:
    """캐시된 결과를 스트림 계약(4단계)에 맞춰 그대로 재생한다.

    프런트와의 계약은 "이벤트 4단계" 지 "매번 새로 계산" 이 아니다. 그래서 캐시 적중
    시에도 단계를 건너뛰지 않고 같은 순서로 즉시 내보낸다 — 화면 코드는 캐시였는지
    아닌지 알 필요가 없고, 사용자에게는 진행 바가 순식간에 끝난 것으로 보인다.
    """
    events = [AdviceStreamEvent(stage=1), AdviceStreamEvent(stage=2)]
    events += [AdviceStreamEvent(stage=3, agent=opinion) for opinion in outcome.opinions]
    events.append(
        AdviceStreamEvent(
            stage=4,
            decision=AdviceStreamDecision(
                stock=stock_data_ref,
                verdict=outcome.decision.verdict,
                decision_label=resolve_decision_label(
                    outcome.decision.verdict, outcome.decision.decision_label
                ),
                confidence=outcome.decision.confidence,
                answer=outcome.decision.answer,
                buy_conditions=outcome.decision.buy_conditions,
                risk_notes=outcome.decision.risk_notes,
                decision_source="fallback" if outcome.used_fallback else "llm",
                updated_at=datetime.now(UTC).isoformat(timespec="seconds"),
            ),
        )
    )
    return events


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

        stock_ref = StockRef(
            name=stock_data.name, symbol=stock_data.symbol, query=stock_data.query
        )

        # TTL 안이면 뉴스 조회조차 하지 않는다 (advice_cache 흐름 ①). 주가는 이미
        # 받았으므로 여기까지가 이 요청의 전부다 — LLM 0회, 뉴스 조회 0회.
        cached = advice_cache.peek(stock_data.symbol)
        if cached is not None:
            logger.info("%s AI 판단을 캐시에서 재생합니다", stock_data.symbol)
            for event in _replay(stock_ref, cached):
                yield event
            return

        yield AdviceStreamEvent(stage=1)

        # 2) 뉴스·리포트 + 재무 — 둘 다 네트워크 대기라 병렬로 묶는다. 재무를 여기에
        #    합치는 이유는 단계를 늘리지 않기 위해서다 (프런트와의 계약이 4단계다).
        content, fundamentals = await asyncio.gather(
            stock_service.get_content(stock_data.symbol),
            fundamentals_service.get_fundamentals_or_none(stock_data.symbol),
        )
        stock_data = stock_data.model_copy(
            update={"news": content.news, "reports": content.reports}
        )
        # 색인은 방금 받은 뉴스에 의존하므로 위 gather 뒤에 온다. 실패·지연은
        # rag_service 가 삼키고 빈 목록을 준다 — 이 단계가 판단을 막으면 안 된다.
        documents = await rag_service.documents_for_advice(
            stock_data.symbol, stock_data.name, content
        )

        # TTL 은 지났지만 기사가 그대로면 다시 분석할 이유가 없다 (흐름 ②).
        # 뉴스 조회 비용은 이미 치렀고, 여기서 아끼는 것은 LLM 4회다.
        unchanged = advice_cache.reuse_if_unchanged(stock_data.symbol, content)
        if unchanged is not None:
            logger.info(
                "%s 기사가 그대로라 직전 AI 판단을 유지합니다", stock_data.symbol
            )
            for event in _replay(stock_ref, unchanged)[1:]:
                yield event
            return

        yield AdviceStreamEvent(stage=2)

        # 3) 에이전트 3인 병렬 — 먼저 끝난 것부터 내보낸다.
        context = build_context(
            stock_data, metrics, fundamentals=fundamentals, documents=documents
        )
        tasks = [
            asyncio.create_task(invoke_one(profile, context, metrics, documents))
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
        decision, used_fallback = await decide(
            stock_data, metrics, opinions, fundamentals=fundamentals, documents=documents
        )

        # 방금 만든 판단을 그 기사 묶음의 지문과 함께 넣는다. 다음 요청은 새 기사가
        # 없는 한 여기까지 오지 않는다. (폴백은 캐시하지 않는다 — advice_cache 주석)
        advice_cache.store(
            stock_data.symbol,
            content,
            opinions=opinions,
            decision=decision,
            used_fallback=used_fallback,
        )

        yield AdviceStreamEvent(
            stage=4,
            decision=AdviceStreamDecision(
                stock=stock_ref,
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
