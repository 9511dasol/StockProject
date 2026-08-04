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


class MoverRow(BaseModel):
    """등락률 랭킹 한 줄. 이름은 KRX 상호이고 시세는 공급자에서 온다."""

    name: str
    #: yfinance 심볼 (247540.KQ)
    symbol: str
    #: 라우팅용 6자리 코드 (247540)
    code: str
    #: KRX 시장 구분 원문 (유가 · 코스닥 · 코넥스)
    market: str | None = None
    price: float
    change: float | None = None
    change_percent: float
    #: 스파크라인 원본 종가
    spark: list[float] = Field(default_factory=list)


class MoversScan(BaseModel):
    """스캔 1회분. 등락률 내림차순 **전체**를 담는다.

    상위 N만 잘라 담지 않는 이유: 서비스가 이 스냅샷 하나를 캐시해 두고
    요청마다 `limit`을 다르게 잘라 쓴다 — limit이 바뀔 때마다 수 초짜리
    스캔을 다시 돌 이유가 없다.
    """

    #: 기준 봉 날짜 (YYYY-MM-DD). 스캔이 비면 None
    as_of: str | None = None
    #: 등락률을 얻어온 경로
    source: Literal["YFINANCE", "KRX"] = "YFINANCE"
    #: 화면에 그대로 노출하는 모집단 설명 ("시가총액 상위 200종목")
    universe_label: str = ""
    #: 모집단으로 넘긴 종목 수 (스캔 실패분 포함)
    universe_size: int = 0
    rows: list[MoverRow] = Field(default_factory=list)


class MarketMovers(BaseModel):
    """상승률·하락률 상위 응답. 서비스가 `MoversScan`을 잘라 만든다."""

    as_of: str | None = None
    source: Literal["YFINANCE", "KRX"] = "YFINANCE"
    universe_label: str = ""
    universe_size: int = 0
    #: 등락률을 실제로 산출한 종목 수 (모집단보다 작을 수 있다)
    scanned: int = 0
    gainers: list[MoverRow] = Field(default_factory=list)
    losers: list[MoverRow] = Field(default_factory=list)
    updated_at: str


RankingSort = Literal["market_cap", "change"]
RankingBoard = Literal["ALL", "KOSPI", "KOSDAQ"]


class RankingRow(MoverRow):
    """탐색 화면(`/stocks`)의 한 줄. `MoverRow` + 순위·시총·시장 구분."""

    #: 심볼 접미사에서 유도한 값. 위 `market`(유가·코스닥 원문)과 달리 프런트 계약이다.
    board: Literal["KOSPI", "KOSDAQ"]
    #: 원. 시가총액 배치가 아직 안 채운 종목은 None (전 종목의 30%가량)
    market_cap: int | None = None
    #: 1부터. offset을 반영한 절대 순위라 페이지를 넘겨도 이어진다
    rank: int


class MarketRanking(BaseModel):
    """`GET /markets/ranking` 응답.

    `MarketMovers`와 달리 부호로 가르지 않는다 — 필터가 적용된 **한 목록** + `total`이다.
    같은 `MoversScan` 스냅샷에서 나오므로 랭킹 때문에 스캔이 추가로 돌지는 않는다.
    """

    as_of: str | None = None
    source: Literal["YFINANCE", "KRX"] = "YFINANCE"
    universe_label: str = ""
    sort: RankingSort = "market_cap"
    board: RankingBoard = "ALL"
    #: 필터 적용 **후** 전체 건수. 페이지네이션의 근거다
    total: int = 0
    rows: list[RankingRow] = Field(default_factory=list)
    updated_at: str
