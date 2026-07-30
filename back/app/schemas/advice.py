"""멀티 에이전트 투자 판단 스키마 (명세 6.4)."""

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.stock import StockHistory, StockMetrics

Verdict = Literal["BUY", "WATCH", "AVOID"]
AgentStatus = Literal["done", "fallback"]

VERDICT_LABELS: dict[str, str] = {
    "BUY": "매수 가능",
    "WATCH": "관망",
    "AVOID": "매수 보류",
}


class StockAdviceRequest(BaseModel):
    symbol: str = Field(min_length=1, max_length=80)


class InvestmentDecision(BaseModel):
    """의사결정 에이전트의 구조화 출력 스키마.

    Anthropic SDK의 `messages.parse(output_format=...)`에 그대로 전달된다. 구조화 출력이
    지원하지 않는 수치 제약(`ge`/`le`)은 SDK가 전송 스키마에서 제거하고 클라이언트
    측에서 검증한다.
    """

    verdict: Verdict = Field(description="BUY=매수 가능, WATCH=관망, AVOID=매수 보류")
    decision_label: str = Field(description="사용자에게 보여줄 짧은 투자 판단")
    confidence: int = Field(ge=0, le=100, description="판단 신뢰도")
    answer: str = Field(description="첫 문장에 사도 되는지 여부가 드러나는 최종 답변")
    buy_conditions: list[str] = Field(default_factory=list)
    risk_notes: list[str] = Field(default_factory=list)


class AgentOpinion(BaseModel):
    agent: str
    status: AgentStatus
    summary: str
    error: str | None = None


class StockRef(BaseModel):
    name: str
    symbol: str
    query: str


class StockAdviceResponse(BaseModel):
    """`POST /stocks/advice` 응답."""

    stock: StockRef
    stock_data: StockHistory
    metrics: StockMetrics
    agents: list[AgentOpinion]
    verdict: Verdict
    decision_label: str
    confidence: int
    answer: str
    buy_conditions: list[str] = Field(default_factory=list)
    risk_notes: list[str] = Field(default_factory=list)
    updated_at: str


def resolve_decision_label(verdict: str, fallback_label: str) -> str:
    return VERDICT_LABELS.get(verdict, fallback_label or "관망")
