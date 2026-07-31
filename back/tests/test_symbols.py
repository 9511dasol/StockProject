"""종목 코드 · 이름 정규화 (명세 6.2)."""

import pytest

from app.domain.symbols import (
    get_common_stock_name,
    get_korean_stock_name,
    is_usable_stock_name,
    krx_symbol_to_yfinance,
    normalize_stock_candidates,
    normalize_stock_code,
)
from app.integrations.yfinance.history import _candidates
from app.schemas.stock import KrxListing
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


@pytest.mark.parametrize(
    ("name", "symbol", "expected"),
    [
        # 야후에 없는 심볼을 물었을 때 shortName 에 섞여 나오는 검색 결과.
        # 이 값이 통과하면 상세 화면 제목이 그대로 이렇게 뜬다.
        ("247540.KS,0P0001GZPV,623889", "247540.KS", False),
        ("", "247540.KQ", False),
        (None, "247540.KQ", False),
        # 심볼·코드를 되돌려준 것은 이름이 아니다
        ("247540.KQ", "247540.KQ", False),
        ("247540", "247540.KQ", False),
        ("AAPL", "AAPL", False),
        # 정상 이름 — 쉼표가 있어도 공백이 섞이면 상호다
        ("에코프로비엠", "247540.KQ", True),
        ("ECOPROBM", "247540.KQ", True),
        ("Alphabet Inc., Class A", "GOOGL", True),
    ],
)
def test_is_usable_stock_name(name: str | None, symbol: str, expected: bool) -> None:
    assert is_usable_stock_name(name, symbol) is expected


def test_candidates_try_resolved_symbol_first() -> None:
    """확정 심볼이 있으면 맨 앞. 없으면 기존 추측 순서 그대로."""
    listing = KrxListing(symbol="247540.KQ", name="에코프로비엠")

    assert _candidates("247540", listing) == ["247540.KQ", "247540.KS", "247540"]
    # 확정 심볼이 실패했을 때 되돌아갈 자리는 남겨 둔다 (KRX 목록이 늦을 수 있다)
    assert _candidates("247540", None) == ["247540.KS", "247540.KQ", "247540"]


def test_initial_consonants() -> None:
    assert get_initial_consonants("삼성전자") == "ㅅㅅㅈㅈ"
    assert get_initial_consonants("LG에너지솔루션") == "lgㅇㄴㅈㅅㄹㅅ"


def test_normalize_search_text_drops_symbols() -> None:
    assert normalize_search_text("LG에너지솔루션 (주)") == "lg에너지솔루션주"
