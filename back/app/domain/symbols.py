"""종목 코드 · 종목명 정규화 (명세 6.2).

전부 순수 함수라 네트워크나 DB 없이 단위 테스트할 수 있다.
"""

import re

from app.domain.constants import (
    COMMON_STOCK_NAMES,
    COMMON_STOCK_SYMBOLS,
    KOREAN_STOCK_NAMES_BY_SYMBOL,
)
from app.utils.text import clean_text

_DIGITS_ONLY = re.compile(r"\D")
_SIX_DIGITS = re.compile(r"\d{6}")
_KOSDAQ_MARKERS = ("KOSDAQ", "KONEX", "코스닥", "코넥스")


def _alias_key(symbol: str) -> str:
    return symbol.strip().replace(" ", "").lower()


def normalize_stock_candidates(symbol: str) -> list[str]:
    """입력 한 건을 yfinance에 순서대로 시도할 후보 심볼 목록으로 바꾼다."""
    raw_symbol = symbol.strip()
    key = _alias_key(raw_symbol)

    if key in COMMON_STOCK_SYMBOLS:
        return [COMMON_STOCK_SYMBOLS[key]]

    if raw_symbol.isdigit() and len(raw_symbol) == 6:
        # 코스피/코스닥 접미사를 모르면 둘 다 시도한다.
        return [f"{raw_symbol}.KS", f"{raw_symbol}.KQ", raw_symbol]

    return [raw_symbol.upper()]


def get_common_stock_name(symbol: str) -> str | None:
    return COMMON_STOCK_NAMES.get(_alias_key(symbol))


def normalize_stock_code(symbol: str) -> str:
    """`005930.KS` → `005930`. 숫자가 아닌 문자는 버린다."""
    return _DIGITS_ONLY.sub("", symbol.split(".", 1)[0])[:6]


def get_korean_stock_name(symbol: str) -> str | None:
    return KOREAN_STOCK_NAMES_BY_SYMBOL.get(normalize_stock_code(symbol))


def krx_symbol_to_yfinance(symbol: str, market: str | None) -> str:
    """KRX 6자리 코드 + 시장 구분 → yfinance 심볼 (`.KS` / `.KQ`)."""
    code = clean_text(symbol).split(".", 1)[0]
    if not _SIX_DIGITS.fullmatch(code):
        return code or symbol

    market_text = clean_text(market).upper()
    suffix = ".KQ" if any(marker in market_text for marker in _KOSDAQ_MARKERS) else ".KS"
    return f"{code}{suffix}"
