"""멀티 에이전트 투자 판단 오케스트레이션 (명세 6.4).

흐름: 주가 조회 → 지표 계산 → 컨텍스트 구성 → 에이전트 3인 병렬 → 최종 판단.
와이어프레임 1a/1c의 진행 단계와 1:1로 대응한다.
"""

import logging
from datetime import UTC, datetime

from app.agents.analysts import build_context, collect_opinions
from app.agents.decision import decide
from app.domain.fit import compute_fit
from app.domain.verdict import combine
from app.schemas.advice import StockAdviceResponse, StockRef, resolve_decision_label
from app.schemas.profile import InvestorProfile
from app.schemas.stock import KrxListing, StockContent, StockHistoryParams
from app.services import advice_cache, fundamentals_service, rag_service, stock_service

logger = logging.getLogger(__name__)

# 지표 계산에 쓰는 일봉 개수 (약 2년).
_ADVICE_ROW_LIMIT = 504
_ADVICE_TIMEFRAME = "day"


async def generate_advice(
    symbol: str,
    *,
    listing: KrxListing | None = None,
    profile: InvestorProfile | None = None,
) -> StockAdviceResponse:
    """종목 분석. `profile` 이 있으면 2축 판단(계획 5.4)까지 얹는다.

    `profile` 을 키워드 전용 선택 인자로 둔 이유: 프로파일 저장소가 아직 없어
    호출부 대부분은 None 으로 부른다. 그때의 동작은 종전과 완전히 동일하다.
    """
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

    # 스트리밍 경로와 달리 뉴스를 따로 조회하지 않는다 — `get_history` 가 이미 실어 왔다.
    content = StockContent(
        symbol=stock_data.symbol, news=stock_data.news, reports=stock_data.reports
    )

    # LLM 산출물만 캐시에서 온다. 봉·지표·재무는 각자 캐시가 있거나 싸므로 위에서
    # 이미 새로 만들었다 (advice_cache.AdviceOutcome 주석).
    #
    # `peek` 과 `reuse_if_unchanged` 를 잇달아 부르는 스트리밍 경로와 달리 여기서는
    # 지문 비교 한 번으로 끝난다. 이 경로는 뉴스를 어차피 손에 들고 시작하기 때문에
    # "뉴스 조회를 아끼는" 1단계가 성립하지 않는다.
    outcome = advice_cache.peek(stock_data.symbol) or advice_cache.reuse_if_unchanged(
        stock_data.symbol, content
    )

    if outcome is None:
        # 검색 증강. 미설정·실패면 빈 목록이라 아래는 그대로 돈다.
        documents = await rag_service.documents_for_advice(
            stock_data.symbol, stock_data.name, content
        )
        context = build_context(stock_data, metrics, fundamentals=fundamentals, documents=documents)
        opinions = await collect_opinions(context, metrics, documents)
        decision, used_fallback = await decide(
            stock_data, metrics, opinions, fundamentals=fundamentals, documents=documents
        )

        if used_fallback:
            logger.info("%s 판단을 규칙 기반으로 생성했습니다", stock_data.symbol)

        outcome = advice_cache.store(
            stock_data.symbol,
            content,
            opinions=opinions,
            decision=decision,
            used_fallback=used_fallback,
        )
    else:
        logger.info("%s AI 판단을 캐시에서 냅니다", stock_data.symbol)

    # 캐시 **이후**에 계산한다. 적합도는 사람마다 다르지만 시장 판단은 전 사용자
    # 공유이므로, 여기서 갈라야 캐시 적중률이 프로파일 수만큼 나뉘지 않는다.
    # 순수 함수라 LLM 호출도 조회도 늘지 않는다 (계획 5.4 / 7.2).
    personal = (
        combine(outcome.decision, compute_fit(profile, metrics)) if profile is not None else None
    )

    return StockAdviceResponse(
        stock=StockRef(
            name=stock_data.name,
            symbol=stock_data.symbol,
            query=stock_data.query,
        ),
        stock_data=stock_data,
        metrics=metrics,
        agents=outcome.agents,
        verdict=outcome.decision.verdict,
        decision_label=resolve_decision_label(
            outcome.decision.verdict, outcome.decision.decision_label
        ),
        confidence=outcome.decision.confidence,
        answer=outcome.decision.answer,
        buy_conditions=outcome.decision.buy_conditions,
        risk_notes=outcome.decision.risk_notes,
        decision_source="fallback" if outcome.used_fallback else "llm",
        personal=personal,
        updated_at=datetime.now(UTC).isoformat(timespec="seconds"),
    )
