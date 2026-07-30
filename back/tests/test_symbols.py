"""종목 코드 · 이름 정규화 (명세 6.2)."""

import pytest

from app.domain.symbols import (
    get_common_stock_name,
    get_korean_stock_name,
    krx_symbol_to_yfinance,
    normalize_stock_candidates,
    normalize_stock_code,
)
from app.utils.text import get_initial_consonants, normalize_search_text


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("삼성전자", ["005930.KS"]),
        ("삼성", ["005930.KS"]),
        ("NAVER", ["035420.KS"]),
        ("005930", ["005930.KS", "005930.KQ", "005930"]),
        ("aapl", ["AAPL"]),
    ],
)
def test_normalize_stock_candidates(value: str, expected: list[str]) -> None:
    assert normalize_stock_candidates(value) == expected


def test_normalize_stock_code_strips_suffix() -> None:
    assert normalize_stock_code("005930.KS") == "005930"
    assert normalize_stock_code("AAPL") == ""


@pytest.mark.parametrize(
    ("code", "market", "expected"),
    [
        ("005930", "KOSPI", "005930.KS"),
        ("035720", "KOSDAQ", "035720.KQ"),
        ("322310", "코스닥", "322310.KQ"),
        ("AAPL", None, "AAPL"),
    ],
)
def test_krx_symbol_to_yfinance(code: str, market: str | None, expected: str) -> None:
    assert krx_symbol_to_yfinance(code, market) == expected


def test_display_name_lookups() -> None:
    assert get_common_stock_name("네이버") == "NAVER"
    assert get_korean_stock_name("005930.KS") == "삼성전자"
    assert get_common_stock_name("없는종목") is None


def test_initial_consonants() -> None:
    assert get_initial_consonants("삼성전자") == "ㅅㅅㅈㅈ"
    assert get_initial_consonants("LG에너지솔루션") == "lgㅇㄴㅈㅅㄹㅅ"


def test_normalize_search_text_drops_symbols() -> None:
    assert normalize_search_text("LG에너지솔루션 (주)") == "lg에너지솔루션주"
