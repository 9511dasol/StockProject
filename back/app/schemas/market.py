"""시장 개요 스키마 (명세 6.1)."""

from typing import Literal

from pydantic import BaseModel, Field


class MarketRow(BaseModel):
    name: str
    symbol: str
    value: float
    change: float | None = None
    change_percent: float | None = None
    tone: Literal["up", "down"] = "up"
    highlight: bool = False
    chart_points: list[float] = Field(default_factory=list)
    chart_labels: list[str] = Field(default_factory=list)


class MarketOverview(BaseModel):
    category: str
    label: str
    rows: list[MarketRow] = Field(default_factory=list)
    chart_points: list[float] = Field(default_factory=list)
    chart_labels: list[str] = Field(default_factory=list)
    updated_at: str
