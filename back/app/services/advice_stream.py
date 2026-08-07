"""AI 판단 진행 상황 스트리밍 (명세 6.4).

`generate_advice()`는 전부 끝난 뒤 결과 하나를 돌려준다. 그런데 종목당 LLM 호출이
4회라 수십 초가 걸리고, 그동안 화면이 아무것도 말하지 못한다. 그래서 같은 오케스트
레이션을 단계별로 쪼개 이벤트로 흘린다.

이벤트는 프런트가 기대하는 4단계와 1:1로 대응한다.
    {"stage": 1}                      주가 데이터 조회 완료
    {"stage": 2}                      뉴스·리포트 수집 완료
    {"stage": 3, "agent": {...}} × 3  에이전트 의견 (끝나는 순서대로)
    {"stage": 4, "decision": {...}}   최종 판단 종합
    {"stage": n, "error": "..."}      복구 불가능한 실패

## 11회차 — 오케스트레이션을 그래프로 옮겼다

예전에는 이 파일이 순서를 직접 들고 있었다(주가 → 뉴스 → 검색 → 에이전트 → 판단).
지금은 **`app/graph` 의 상태 그래프가 순서를 소유하고, 이 파일은 통역만 한다** —
그래프가 내보내는 "어떤 노드가 끝났다" 를 프런트가 아는 4단계로 옮긴다.

그 덕분에 이 파일에서 사라진 것이 있다: 검색 재시도 루프, 판단 재시도, 캐시 분기.
전부 그래프의 조건부 엣지로 표현되고, 여기서는 **결과만 통역**하면 된다.

## 왜 stream_mode="updates" 인가

LangGraph 의 스트림 모드는 여러 가지다.

    values   매 단계 **상태 전체**를 준다 — 봉 504개가 매번 실려 온다
    updates  그 노드가 **바꾼 것만** 준다 ← 우리가 쓰는 것
    messages 토큰 단위 (LLM 래퍼를 쓸 때만)

`updates` 는 `{"journalist": {"opinions": [의견]}}` 처럼 온다. 노드 이름이 곧 "어디까지
왔는가" 라서 4단계 매핑이 그대로 된다. 무엇보다 **에이전트가 끝나는 순서대로** 온다 —
`as_completed` 로 손수 만들던 동작을 그래프가 공짜로 준다.
"""

import asyncio
import logging
from collections.abc import AsyncIterator
from datetime import UTC, datetime

from app.domain.fit import compute_fit
from app.domain.verdict import combine
from app.graph import get_graph
from app.schemas.advice import (
    AdviceStreamDecision,
    AdviceStreamEvent,
    AgentOpinion,
    StockRef,
    resolve_decision_label,
)
from app.schemas.profile import InvestorProfile
from app.schemas.stock import KrxListing

logger = logging.getLogger(__name__)

#: 노드 이름 → 이 노드가 끝나면 프런트에 알릴 단계.
#:
#: 여기 없는 노드(check_cache · grade_documents · rewrite_query · verify …)는 이벤트를
#: 만들지 않는다. 내부 판단이라 사용자에게 보여 줄 것이 없고, 그런 노드가 늘어도
#: **프런트와의 4단계 계약은 그대로**다 — 그래프를 키워도 화면을 안 건드린다.
_STAGE_OF: dict[str, int] = {
    "collect_price": 1,
    "check_fingerprint": 2,
    "replay": 2,
}

#: 판단이 **확정되는** 노드들. 어느 경로로 끝나든 stage 4 를 한 번만 낸다.
#:
#: `decide` 가 아니라 그 뒤 노드들인 것이 핵심이다 — `decide` 직후에는 `verify` 가
#: 판단을 물릴 수 있어, 거기서 흘리면 폐기될 판단이 화면에 먼저 뜬다.
_DECISION_NODES = frozenset({"store_result", "force_fallback", "replay"})


def _decision_event(
    stock_ref: StockRef,
    state: dict,
    opinions: list[AgentOpinion],
    profile: InvestorProfile | None = None,
) -> AdviceStreamEvent | None:
    decision = state.get("decision")
    if decision is None:
        return None

    # 2축 판단은 그래프 **밖**에서 만든다. 시장 판단은 전 사용자 공유라 캐시되지만
    # 적합도는 사람마다 다르다 — 그래프 안에 넣으면 캐시 키에 프로파일이 섞여
    # 적중률이 프로파일 수만큼 쪼개진다 (advice_service 의 같은 판단).
    metrics = state.get("metrics")
    personal = (
        combine(decision, compute_fit(profile, metrics))
        if profile is not None and metrics is not None
        else None
    )

    return AdviceStreamEvent(
        stage=4,
        decision=AdviceStreamDecision(
            stock=stock_ref,
            verdict=decision.verdict,
            decision_label=resolve_decision_label(
                decision.verdict, decision.decision_label
            ),
            confidence=decision.confidence,
            answer=decision.answer,
            buy_conditions=decision.buy_conditions,
            risk_notes=decision.risk_notes,
            decision_source="fallback" if state.get("used_fallback") else "llm",
            personal=personal,
            updated_at=datetime.now(UTC).isoformat(timespec="seconds"),
        ),
    )


async def stream_advice(
    symbol: str,
    *,
    listing: KrxListing | None = None,
    profile: InvestorProfile | None = None,
) -> AsyncIterator[AdviceStreamEvent]:
    """단계 이벤트를 순서대로 내보낸다. 소비자가 끊으면 GeneratorExit로 종료된다.

    `profile` 이 있으면 마지막 stage 4 이벤트에 2축 판단(`personal`)이 함께 실린다.
    없으면 종전 이벤트 그대로다.
    """
    graph = get_graph()

    # `updates` 모드는 **그 노드가 바꾼 것만** 준다. 최종 판단 이벤트에는 여러 노드가
    # 나눠 채운 값이 함께 필요하므로(종목·의견·판단) 여기서 누적한다.
    #
    # 판단을 그때그때 안 내보내고 모아 두는 이유: 판단은 `decide` 가 만들지만 그 뒤에
    # `verify` 가 물릴 수 있다. `decide` 에서 바로 흘리면 **검증에 걸려 폐기될 판단이
    # 이미 화면에 뜬 뒤**가 된다. 확정되는 노드(store_result·force_fallback·replay)에서
    # 한 번만 낸다.
    stock_ref: StockRef | None = None
    opinions: list[AgentOpinion] = []
    latest: dict = {}
    emitted_stages: set[int] = set()
    decided = False

    try:
        async for update in graph.astream(
            {"symbol": symbol, "listing": listing},
            stream_mode="updates",
        ):
            for node, raw in update.items():
                # **아무것도 바꾸지 않은 노드는 `None` 으로 온다** (빈 dict 가 아니다).
                # `store_result` 가 정확히 그런 노드다 — 캐시에 넣기만 하고 상태는
                # 안 건드린다. 여기서 걸러 버리면 그 노드가 담당하는 stage 4 가
                # 통째로 사라진다. 실측으로 확인한 동작이다.
                patch: dict = raw if isinstance(raw, dict) else {}

                # 판단·폴백 여부는 마지막 값이 이긴다 (재시도가 앞의 것을 덮는다).
                #
                # `metrics` 도 함께 모은다 — 적합도 계산의 종목 쪽 입력이다.
                # `updates` 모드는 그 노드가 **바꾼 것만** 주므로, 지표를 만든
                # 노드(collect_price)가 지나간 뒤에는 다시 오지 않는다.
                for key in ("decision", "used_fallback", "metrics"):
                    if key in patch:
                        latest[key] = patch[key]

                stock_data = patch.get("stock_data")
                if stock_data is not None:
                    stock_ref = StockRef(
                        name=stock_data.name,
                        symbol=stock_data.symbol,
                        query=stock_data.query,
                    )

                # 1) 진행 단계 — 같은 단계를 두 번 내지 않는다. 캐시 경로에서
                #    check_fingerprint 와 replay 가 둘 다 stage 2 를 가리킨다.
                stage = _STAGE_OF.get(node)
                if stage is not None and stage not in emitted_stages:
                    emitted_stages.add(stage)
                    yield AdviceStreamEvent(stage=stage)

                # 2) 에이전트 의견 — 끝나는 순서대로 흘린다.
                for opinion in patch.get("opinions") or []:
                    opinions.append(opinion)
                    yield AdviceStreamEvent(stage=3, agent=opinion)

                # 3) 최종 판단 — 확정되는 노드에서 한 번만.
                if node in _DECISION_NODES and not decided and stock_ref is not None:
                    event = _decision_event(stock_ref, latest, opinions, profile)
                    if event is not None:
                        decided = True
                        yield event

    except asyncio.CancelledError:
        raise
    except Exception as exc:
        # 주가 조회 실패처럼 복구 불가능한 경우. 에이전트·판단 실패는 각 계층이
        # 이미 규칙 기반으로 흡수하므로 여기까지 오지 않는다.
        logger.warning("AI 판단 스트림 실패 (%s)", exc)
        yield AdviceStreamEvent(stage=0, error=str(exc))
