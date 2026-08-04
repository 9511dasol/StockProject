"""SSE 스트림 배선 계약 테스트.

`test_agents.py`가 에이전트 한 명씩을 덮는다면, 여기서는 **4단계 이벤트가 프런트와의
계약대로 흐르는지**를 본다. 스트림 경로는 상류(yfinance)가 막히면 확인할 수 없어서
그동안 사각지대였다 — 실제로 Yahoo 429 한 번에 수동 확인이 통째로 막혔다.

네트워크·LLM·벡터 DB를 전부 대역으로 바꾸고 오케스트레이션만 검증한다.
"""

import pytest

from app.agents import analysts, decision
from app.schemas.advice import AnalystOutput, InvestmentDecision
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

    async def fake_documents(symbol: str, name: str, content):
        return [_DOC]

    async def fake_analyst(system_prompt: str, user_content: str, output_model):
        return AnalystOutput(summary="분석 결과", stance="긍정", cited_doc_ids=["D1"])

    async def fake_decision(system_prompt: str, user_content: str, output_model):
        return InvestmentDecision(
            verdict="BUY", decision_label="무시될 라벨", confidence=71, answer="BUY. 참고용."
        )

    monkeypatch.setattr(stock_service, "get_history", fake_history)
    monkeypatch.setattr(stock_service, "get_content", fake_content)
    monkeypatch.setattr(fundamentals_service, "get_fundamentals_or_none", fake_fundamentals)
    monkeypatch.setattr(rag_service, "documents_for_advice", fake_documents)
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

    async def no_documents(symbol: str, name: str, content):
        return []

    monkeypatch.setattr(rag_service, "documents_for_advice", no_documents)

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
