"""시장 개요 카테고리 카탈로그."""

from typing import Final, TypedDict


class MarketSymbol(TypedDict):
    name: str
    symbol: str


class MarketCategory(TypedDict):
    label: str
    symbols: list[MarketSymbol]


MARKET_OVERVIEW_CATEGORIES: Final[dict[str, MarketCategory]] = {
    "forex": {
        "label": "외환",
        "symbols": [
            {"name": "달러/원", "symbol": "KRW=X"},
            {"name": "유로/달러", "symbol": "EURUSD=X"},
            {"name": "브라질 헤알/원", "symbol": "BRLKRW=X"},
            {"name": "엔/원", "symbol": "JPYKRW=X"},
            {"name": "파운드/달러", "symbol": "GBPUSD=X"},
            {"name": "태국 바트/원", "symbol": "THBKRW=X"},
            {"name": "달러/엔", "symbol": "JPY=X"},
        ],
    },
    "index": {
        "label": "지수",
        "symbols": [
            {"name": "코스피지수", "symbol": "^KS11"},
            {"name": "코스피200", "symbol": "^KS200"},
            {"name": "US 500", "symbol": "^GSPC"},
            {"name": "US Tech 100", "symbol": "^NDX"},
            {"name": "DAX", "symbol": "^GDAXI"},
            {"name": "닛케이", "symbol": "^N225"},
            {"name": "미국 달러 지수", "symbol": "DX-Y.NYB"},
            {"name": "필라델피아 반도체 지수", "symbol": "^SOX"},
        ],
    },
    "commodity": {
        "label": "원자재",
        "symbols": [
            {"name": "금", "symbol": "GC=F"},
            {"name": "은", "symbol": "SI=F"},
            {"name": "브렌트유", "symbol": "BZ=F"},
            {"name": "WTI유", "symbol": "CL=F"},
            {"name": "천연가스", "symbol": "NG=F"},
            {"name": "구리", "symbol": "HG=F"},
            {"name": "미국 옥수수", "symbol": "ZC=F"},
        ],
    },
    "stock": {
        "label": "주식",
        "symbols": [
            {"name": "AAPL", "symbol": "AAPL"},
            {"name": "BABA", "symbol": "BABA"},
            {"name": "TSLA", "symbol": "TSLA"},
            {"name": "AA", "symbol": "AA"},
            {"name": "BAC", "symbol": "BAC"},
            {"name": "KO", "symbol": "KO"},
            {"name": "XOM", "symbol": "XOM"},
        ],
    },
}
