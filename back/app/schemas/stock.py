"""주가 · 뉴스 · 리포트 · 지표 스키마 (명세 6.2 / 6.3).

원본 코드가 dict로 주고받던 구조를 Pydantic v2 모델로 고정했다. API 응답 스키마이면서
동시에 계층 간 데이터 계약으로도 쓰인다 — 그래서 통합 계층이 만든 값을 서비스와
도메인 계산이 타입 안전하게 소비할 수 있다.
"""

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

CrossSignal = Literal["golden", "dead"]
Timeframe = Literal["day", "week", "month"]
# 상장사 목록 수집 경로. KRX 실패 시 KIND, 그것도 실패하면 내부 기본 목록.
ListedSource = Literal["KRX", "KIND", "INTERNAL"]
SourceState = Literal["사용", "실패", "대기"]


class SourceStep(BaseModel):
    """수집 파이프라인 각 단계의 결과 (와이어프레임 1d 폴백 패널)."""

    label: str
    source: ListedSource
    state: SourceState


class ListedCompaniesStatus(BaseModel):
    """`GET /stocks/listed-companies` 응답 — 첫 호출 지연 배너·폴백 경고용."""

    ready: bool
    loaded: int
    total: int
    source: ListedSource
    steps: list[SourceStep] = Field(default_factory=list)


class ListedCompanyRecord(BaseModel):
    """상장사 목록 수집 결과 한 건. 통합 계층 → 리포지토리 계약."""

    symbol: str
    name: str
    market: str | None = None
    initial_consonants: str = ""


class KrxListing(BaseModel):
    """KRX 목록에서 확정한 종목 한 건. 리포지토리 → 서비스 → 통합 계층 계약.

    yfinance보다 우선하는 신원이다. 6자리 코드만으로는 접미사(`.KS`/`.KQ`)를 알
    수 없어 둘 다 시도하게 되는데, 야후는 틀린 접미사에도 **다른 종목의 계열**을
    돌려주므로(`247540.KS`는 하루 늦은 시세와 쓰레기 이름) 추측 대신 이 값을 쓴다.
    """

    #: yfinance에 그대로 넘길 수 있는 심볼 (247540.KQ)
    symbol: str
    #: KRX 상호 (에코프로비엠) — 공급자 영문명보다 우선한다
    name: str


class MarketCapRecord(BaseModel):
    """시가총액 배치 1회분. `caps` 는 6자리 코드 → 시총(원)."""

    # 실제로 값을 가져온 영업일. 한 번도 성공하지 못했으면 None.
    as_of: str | None = None
    caps: dict[str, int] = Field(default_factory=dict)


class StockSuggestion(BaseModel):
    """자동완성 후보 (명세 6.2)."""

    model_config = ConfigDict(from_attributes=True)

    symbol: str
    name: str
    market: str | None = None
    initial_consonants: str = ""


class StockRow(BaseModel):
    """OHLCV 한 봉 + 파생 보조지표."""

    name: str
    symbol: str
    date: str
    open: float | None = None
    close: float | None = None
    high: float | None = None
    low: float | None = None
    volume: int | None = None
    sma5: float | None = None
    sma20: float | None = None
    sma60: float | None = None
    bb_upper: float | None = None
    bb_lower: float | None = None
    cross_signal: CrossSignal | None = None


class NewsItem(BaseModel):
    title: str
    publisher: str = ""
    published_at: str = ""
    summary: str = ""
    url: str = ""
    thumbnail: str = ""


class AnalystReport(BaseModel):
    title: str
    publisher: str = ""
    published_at: str = ""
    summary: str = ""
    url: str = ""


class StockMetrics(BaseModel):
    """지표 요약 (명세 6.3). 에이전트 컨텍스트와 규칙 기반 판단의 입력."""

    latest_date: str | None = None
    latest_close: float | None = None
    day_change: float | None = None
    day_change_pct: float | None = None
    return_20d_pct: float | None = None
    return_60d_pct: float | None = None
    sma5: float | None = None
    sma20: float | None = None
    sma60: float | None = None
    trend: str = "중립/약세"
    bollinger_position: str = "중립"
    volume_ratio_20d: float | None = None
    recent_cross_signal: CrossSignal | None = None
    recent_cross_date: str | None = None
    # 화면의 '52주 위치' — 52주 최저~최고 구간에서 현재가가 놓인 백분위(0~100).
    week52_position_pct: float | None = None
    week52_high: float | None = None
    week52_low: float | None = None
    # 화면의 '변동성 20D' — 최근 20일 일간수익률 표준편차(%).
    volatility_20d_pct: float | None = None


class StockHistory(BaseModel):
    """`GET /stocks/history` 응답."""

    name: str
    symbol: str
    query: str
    timeframe: Timeframe
    period: str
    interval: str
    start_date: str | None = None
    end_date: str | None = None
    rows: list[StockRow] = Field(default_factory=list)
    news: list[NewsItem] = Field(default_factory=list)
    reports: list[AnalystReport] = Field(default_factory=list)
    # 서비스 계층이 rows에서 파생해 채운다. 프런트가 같은 계산을 다시 구현하지
    # 않도록 응답에 포함한다 — 지표 계산의 소유자는 백엔드 한 곳이다.
    metrics: StockMetrics | None = None


class StockContent(BaseModel):
    """`GET /stocks/content` 응답 — 뉴스와 리포트만.

    주가와 분리된 이유: 이쪽이 응답 시간의 대부분(측정치 95%)을 차지해, 함께 두면
    차트가 뉴스를 기다리게 된다.
    """

    symbol: str
    news: list[NewsItem] = Field(default_factory=list)
    reports: list[AnalystReport] = Field(default_factory=list)


class StockHistoryParams(BaseModel):
    """히스토리 조회 파라미터. 검증은 서비스 계층에서 도메인 규칙으로 수행한다."""

    symbol: str = Field(min_length=1, max_length=80)
    timeframe: str = "day"
    period: str | None = None
    limit: int = Field(default=504, ge=1, le=5000)
    start_date: date | None = None
    end_date: date | None = None
