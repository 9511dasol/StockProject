"""SSE 스트림 배선 계약 테스트.

`test_agents.py`가 에이전트 한 명씩을 덮는다면, 여기서는 **4단계 이벤트가 프런트와의
계약대로 흐르는지**를 본다. 스트림 경로는 상류(yfinance)가 막히면 확인할 수 없어서
그동안 사각지대였다 — 실제로 Yahoo 429 한 번에 수동 확인이 통째로 막혔다.

네트워크·LLM·벡터 DB를 전부 대역으로 바꾸고 오케스트레이션만 검증한다.
"""

import pytest

from app.agents import analysts, decision
from app.core.config import settings
from app.schemas.advice import AnalystOutput, InvestmentDecision
from app.schemas.profile import InvestorProfile
from app.schemas.rag import RetrievedDoc
from app.schemas.stock import (
    NewsItem,
    StockContent,
    StockHistory,
    StockMetrics,
    StockRow,
)
from app.services import advice_stream, fundamentals_service, rag_service, stock_service

_HISTORY = StockHistory(
    name="삼성전자",
    symbol="005930.KS",
    query="005930",
    timeframe="day",
    period="2y",
    interval="1d",
    rows=[StockRow(name="삼성전자", symbol="005930.KS", date="2026-07-30", close=70000.0)],
    metrics=StockMetrics(latest_close=70000.0, trend="상승 우위", return_20d_pct=4.0),
)

_CONTENT = StockContent(
    symbol="005930.KS",
    news=[NewsItem(title="실적 발표", summary="영업이익 증가", url="https://example.com/1")],
)

_DOC = RetrievedDoc(
    doc_id="D1",
    title="3분기 영업이익 컨센서스 상회",
    publisher="매일경제",
    url="https://example.com/1",
    published_at="2026-07-28",
    snippet="영업이익이 시장 기대를 넘었다.",
)


@pytest.fixture
def wired(monkeypatch: pytest.MonkeyPatch) -> None:
    """상류·LLM·RAG 를 전부 대역으로 세운다."""

    async def fake_history(params, **kwargs):
        return _HISTORY

    async def fake_content(symbol: str):
        return _CONTENT

    async def fake_fundamentals(symbol: str):
        return None

    # 그래프는 `documents_for_advice` 가 아니라 색인·검색을 **따로** 부른다 —
    # 질의를 고쳐 다시 검색할 때 같은 기사를 또 색인하지 않기 위해서다. 그래서
    # 대역도 그 두 지점에 세운다.
    async def fake_retrieve(symbol: str, query: str):
        return [_DOC]

    async def fake_index(symbol: str, content):
        from app.schemas.rag import IngestResult

        return IngestResult()

    async def fake_analyst(system_prompt: str, user_content: str, output_model):
        return AnalystOutput(summary="분석 결과", stance="긍정", cited_doc_ids=["D1"])

    async def fake_decision(system_prompt: str, user_content: str, output_model):
        return InvestmentDecision(
            verdict="BUY", decision_label="무시될 라벨", confidence=71, answer="BUY. 참고용."
        )

    monkeypatch.setattr(stock_service, "get_history", fake_history)
    monkeypatch.setattr(stock_service, "get_content", fake_content)
    monkeypatch.setattr(fundamentals_service, "get_fundamentals_or_none", fake_fundamentals)
    monkeypatch.setattr(rag_service, "retrieve", fake_retrieve)
    monkeypatch.setattr(rag_service, "index_content", fake_index)
    # 그래프는 rag_enabled 를 보고 검색 루프에 들어갈지 정한다. conftest 가
    # 기본으로 꺼 두므로 이 테스트는 명시적으로 켠다.
    monkeypatch.setattr(settings, "vector_database_url", "postgresql://x:y@h:6543/db")
    monkeypatch.setattr(analysts, "ask_structured", fake_analyst)
    monkeypatch.setattr(decision, "ask_structured", fake_decision)


async def test_stream_emits_four_stages_in_order(wired: None) -> None:
    events = [event async for event in advice_stream.stream_advice("005930")]

    # 1 → 2 → 3×3 → 4. 프런트 진행 바가 이 순서를 그대로 그린다.
    assert [event.stage for event in events] == [1, 2, 3, 3, 3, 4]
    assert all(event.error is None for event in events)


async def test_agent_events_carry_stance_and_verified_sources(wired: None) -> None:
    events = [event async for event in advice_stream.stream_advice("005930")]
    agents = [event.agent for event in events if event.agent]

    assert len(agents) == 3
    assert all(opinion.status == "done" for opinion in agents)
    assert all(opinion.stance == "긍정" for opinion in agents)
    # 인용한 D1 이 실제 문서로 해석돼 화면에 쓸 수 있는 형태로 실린다.
    assert all(opinion.sources[0].title == "3분기 영업이익 컨센서스 상회" for opinion in agents)
    assert agents[0].sources[0].url == "https://example.com/1"


async def test_decision_event_uses_canonical_label(wired: None) -> None:
    events = [event async for event in advice_stream.stream_advice("005930")]
    decision_event = events[-1].decision

    assert decision_event is not None
    assert decision_event.verdict == "BUY"
    assert decision_event.decision_label == "매수 가능"  # LLM 라벨보다 표준 매핑이 우선
    assert decision_event.decision_source == "llm"
    assert decision_event.stock.symbol == "005930.KS"


async def test_rag_failure_does_not_stop_the_stream(
    wired: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    """벡터 DB가 죽어도 판단은 나와야 한다.

    `documents_for_advice` 는 스스로 실패를 삼키도록 만들어져 있지만, 그 계약이
    깨졌을 때 스트림이 stage 0 으로 떨어지는지까지 여기서 잡는다.
    """

    async def no_documents(symbol: str, query: str):
        return []

    monkeypatch.setattr(rag_service, "retrieve", no_documents)

    events = [event async for event in advice_stream.stream_advice("005930")]
    agents = [event.agent for event in events if event.agent]

    assert [event.stage for event in events] == [1, 2, 3, 3, 3, 4]
    # 문서가 없으면 인용도 없다 — 있는 척하지 않는다.
    assert all(opinion.sources == [] for opinion in agents)


async def test_upstream_failure_becomes_stage_zero(monkeypatch: pytest.MonkeyPatch) -> None:
    """주가 조회 실패(예: yfinance 429)는 복구 불가라 stage 0 에러로 나간다."""

    async def failing_history(params, **kwargs):
        raise RuntimeError("Too Many Requests. Rate limited.")

    monkeypatch.setattr(stock_service, "get_history", failing_history)

    events = [event async for event in advice_stream.stream_advice("005930")]

    assert len(events) == 1
    assert events[0].stage == 0
    assert "Rate limited" in (events[0].error or "")


# ---------------------------------------------------------------------------
# 2축 판단이 **이 경로**로 흐르는지 (사주 통합 계획 5.4).
#
# 이 테스트가 따로 필요한 이유: 프런트는 비스트리밍 `/advice` 를 부르지 않는다.
# 그쪽에만 personal 을 얹었을 때 백엔드 테스트는 전부 초록인데 화면에는 2축 판단이
# 영영 나타나지 않았다 — 계층별 테스트가 배선을 검증해 주지 않는다는 사례다.
# ---------------------------------------------------------------------------

_CAUTIOUS = InvestorProfile(
    risk_appetite=25, patience=15, decisiveness=80, loss_aversion=90, herd_tendency=85
)

_VOLATILE_METRICS = StockMetrics(
    latest_close=82_000.0,
    day_change_pct=7.1,
    volatility_20d_pct=34.0,
    week52_position_pct=93.0,
    volume_ratio_20d=2.8,
    sma5=80_000.0,
    sma20=76_000.0,
    trend="상승 우위",
)


@pytest.fixture
def volatile(monkeypatch: pytest.MonkeyPatch, wired: None) -> None:
    """적합도가 확실히 낮게 나오는 종목으로 바꾼다."""
    history = _HISTORY.model_copy(update={"metrics": _VOLATILE_METRICS})

    async def fake_history(params, **kwargs):
        return history

    monkeypatch.setattr(stock_service, "get_history", fake_history)
    monkeypatch.setattr(stock_service, "get_metrics", lambda data: _VOLATILE_METRICS)


async def test_stream_omits_personal_without_a_profile(wired: None) -> None:
    """프로파일이 없으면 종전 이벤트 그대로다 — 개인화는 얹는 기능이다."""
    events = [event async for event in advice_stream.stream_advice("005930")]

    assert events[-1].decision is not None
    assert events[-1].decision.personal is None


async def test_stream_carries_the_two_axis_verdict_when_a_profile_is_given(
    volatile: None,
) -> None:
    events = [
        event
        async for event in advice_stream.stream_advice("005930", profile=_CAUTIOUS)
    ]

    decision_event = events[-1].decision
    assert decision_event is not None
    # 상단은 여전히 시장 판단 — 기존 클라이언트가 보는 필드는 안 바뀐다.
    assert decision_event.verdict == "BUY"

    personal = decision_event.personal
    assert personal is not None
    assert personal.market_verdict == "BUY"
    assert personal.verdict == "WATCH"      # 단방향 보정
    assert personal.adjusted is True
    assert personal.fit_level == "low"
    assert personal.concerns and personal.guardrails


async def test_stage_order_is_unchanged_by_personalisation(volatile: None) -> None:
    """개인화가 이벤트 순서·개수를 건드리지 않는다 — 진행 바 계약은 그대로다."""
    events = [
        event
        async for event in advice_stream.stream_advice("005930", profile=_CAUTIOUS)
    ]

    assert [event.stage for event in events] == [1, 2, 3, 3, 3, 4]
