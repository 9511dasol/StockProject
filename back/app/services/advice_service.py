"""멀티 에이전트 투자 판단 오케스트레이션 (명세 6.4).

흐름: 주가 조회 → 지표 계산 → 컨텍스트 구성 → 에이전트 3인 병렬 → 최종 판단.
와이어프레임 1a/1c의 진행 단계와 1:1로 대응한다.
"""

import logging
from datetime import UTC, datetime

from app.agents.analysts import build_context, collect_opinions
from app.agents.decision import decide
from app.schemas.advice import StockAdviceResponse, StockRef, resolve_decision_label
from app.schemas.stock import KrxListing, StockContent, StockHistoryParams
from app.services import fundamentals_service, rag_service, stock_service

logger = logging.getLogger(__name__)

# 지표 계산에 쓰는 일봉 개수 (약 2년).
_ADVICE_ROW_LIMIT = 504
_ADVICE_TIMEFRAME = "day"


async def generate_advice(
    symbol: str, *, listing: KrxListing | None = None
) -> StockAdviceResponse:
    params = StockHistoryParams(
        symbol=symbol,
        timeframe=_ADVICE_TIMEFRAME,
        limit=_ADVICE_ROW_LIMIT,
    )

    # 판단 결과에 종목명이 그대로 실린다 — 상세 화면과 같은 KRX 이름이어야 한다.
    stock_data = await stock_service.get_history(params, listing=listing)
    metrics = stock_service.get_metrics(stock_data)

    # 밸류에이션·배당. 실패는 None 으로 흡수한다 — PER 을 못 읽었다고 분석 전체가
    # 죽으면 안 된다.
    fundamentals = await fundamentals_service.get_fundamentals_or_none(stock_data.symbol)

    # 검색 증강. 스트리밍 경로와 달리 뉴스를 따로 조회하지 않으므로 `get_history` 가
    # 이미 실어 온 것을 그대로 넘긴다. 미설정·실패면 빈 목록이라 아래는 그대로 돈다.
    documents = await rag_service.documents_for_advice(
        stock_data.symbol,
        stock_data.name,
        StockContent(symbol=stock_data.symbol, news=stock_data.news, reports=stock_data.reports),
    )

    context = build_context(
        stock_data, metrics, fundamentals=fundamentals, documents=documents
    )
    opinions = await collect_opinions(context, metrics, documents)
    decision, used_fallback = await decide(
        stock_data, metrics, opinions, fundamentals=fundamentals, documents=documents
    )

    if used_fallback:
        logger.info("%s 판단을 규칙 기반으로 생성했습니다", stock_data.symbol)

    return StockAdviceResponse(
        stock=StockRef(
            name=stock_data.name,
            symbol=stock_data.symbol,
            query=stock_data.query,
        ),
        stock_data=stock_data,
        metrics=metrics,
        agents=opinions,
        verdict=decision.verdict,
        decision_label=resolve_decision_label(decision.verdict, decision.decision_label),
        confidence=decision.confidence,
        answer=decision.answer,
        buy_conditions=decision.buy_conditions,
        risk_notes=decision.risk_notes,
        decision_source="fallback" if used_fallback else "llm",
        updated_at=datetime.now(UTC).isoformat(timespec="seconds"),
    )
