"""재무 · 밸류에이션 수집 (명세 6.3).

주가·뉴스와 분리한 이유는 비용이다. `ticker.info` 한 번이 0.5~1.5초이고 여기에
밸류에이션·손익계산서 호출이 붙어 종목당 1~2초가 든다. 차트가 이걸 기다리면 안 된다.

동기 함수다 — 서비스 계층이 `asyncio.to_thread`로 호출하고, 캐시도 그쪽이 소유한다.

**이 파일에서 반드시 알아야 할 세 가지** (전부 실측으로 확인했다, 추측이 아니다):

1. 국내 종목은 `info["trailingPE"]`/`["priceToBook"]`가 **항상 None**이다.
   (005930.KS · 000660.KS · 247540.KQ 전부 None, AAPL은 34.84/41.23으로 정상)
   `get_valuation_measures()`가 유일한 경로이며 yfinance >= 1.5에만 있다.
2. `returnOnEquity`는 소수(0.30792)인데 `dividendYield`는 백분율(0.57)이다.
   같은 dict, 같은 호출, 단위 규약이 다르다. `_roe_pct`·`_dividend_yield_pct` 주석 참고.
3. `earningsTimestamp`는 **직전** 발표일이다. 다음 발표일은 `earningsTimestampStart`.
"""

import logging
from datetime import UTC, datetime, timedelta, timezone
from typing import Any

from app.integrations.yfinance.client import is_empty_frame, load_yfinance
from app.schemas.stock import AnnualFinancial, StockFundamentals
from app.utils.numbers import int_or_none, is_number, number_or_none

logger = logging.getLogger(__name__)

_ANNUAL_YEARS = 4

# yfinance scrapers/quote.py 의 _VALUATION_MEASURE_LABELS 값과 정확히 일치해야 한다.
_PE_LABEL = "Trailing P/E"
_PB_LABEL = "Price/Book"
_CURRENT_COLUMN = "Current"

# 손익계산서 행 이름. get_income_stmt(pretty=False) 의 원본 camelCase 라벨이다.
# pretty=True(= income_stmt 프로퍼티)는 camel2title 로 "Total Revenue"가 되는
# 표시용 변환이라 계약으로 삼지 않는다.
_REVENUE_KEYS = ("TotalRevenue", "OperatingRevenue")
_OPERATING_INCOME_KEYS = ("OperatingIncome", "TotalOperatingIncomeAsReported")

# ZoneInfo 는 Windows 에서 tzdata 패키지를 따로 요구한다. KST 는 서머타임이 없어
# 고정 오프셋이 정확하며 의존성도 늘지 않는다.
_KST = timezone(timedelta(hours=9))


def _info(ticker: Any) -> dict:
    """`ticker.info`는 느리고 자주 실패한다 — 실패하면 빈 dict로 계속 진행한다."""
    try:
        info = ticker.info
    except Exception as exc:
        logger.debug("ticker.info 조회 실패: %s", exc)
        return {}

    return info if isinstance(info, dict) else {}


def _valuation(ticker: Any) -> dict[str, float | None]:
    """PER · PBR · 시가총액을 밸류에이션 표에서 읽는다.

    국내 종목에서 PER/PBR 의 **유일한** 소스다. `AttributeError` 는 yfinance 가
    1.5 미만이라는 뜻이므로 debug 가 아니라 warning 으로 남긴다 — 그러지 않으면
    전 종목 PER 이 조용히 비어도 아무도 모른다.
    """
    empty: dict[str, float | None] = {_PE_LABEL: None, _PB_LABEL: None, "Market Cap": None}

    try:
        frame = ticker.get_valuation_measures(freq="yearly", periods=0)
    except AttributeError as exc:
        logger.warning(
            "get_valuation_measures 를 찾을 수 없습니다 (%s). yfinance>=1.5 가 필요합니다 "
            "— 국내 종목 PER/PBR 이 전부 비게 됩니다.",
            exc,
        )
        return empty
    except Exception as exc:
        logger.debug("밸류에이션 조회 실패: %s", exc)
        return empty

    if is_empty_frame(frame) or _CURRENT_COLUMN not in frame.columns:
        return empty

    return {
        label: number_or_none(frame.loc[label, _CURRENT_COLUMN]) if label in frame.index else None
        for label in empty
    }


def _price(ticker: Any, info: dict) -> float | None:
    """현재가. EPS/BPS 역산에만 쓴다 (market.py `_previous_close` 와 같은 체인)."""
    price = number_or_none(info.get("regularMarketPrice"))
    if price:
        return price

    try:
        return number_or_none(ticker.fast_info.get("last_price"))
    except Exception as exc:
        logger.debug("fast_info.last_price 조회 실패: %s", exc)
        return None


def _roe_pct(info: dict) -> float | None:
    """`returnOnEquity`는 **소수**다 — 0.30792 → 30.79%.

    바로 아래 `_dividend_yield_pct`와 단위 규약이 반대다. 실측: 005930.KS 0.30792,
    AAPL 1.4875(=148.75%). 크기로 소수/백분율을 판별하려는 시도는 하지 마라 —
    AAPL 의 1.49 를 걸러내는 임계값은 정상적인 고ROE 종목도 같이 망가뜨린다.
    """
    value = number_or_none(info.get("returnOnEquity"), digits=6)
    return round(value * 100, 2) if is_number(value) else None


def _dividend_yield_pct(info: dict) -> float | None:
    """`dividendYield`는 **이미 백분율**이다 — 0.57 이 곧 0.57%다. 100을 곱하지 마라.

    실측 검증(005930.KS): dividendRate 1496 / regularMarketPrice 233,750 = 0.64%.
    dividendYield 값은 0.57 — 소수였다면 57%여야 하므로 백분율이 맞다.
    야후가 2025년 초 이 필드만 백분율로 바꿨고 yfinance 는 formatted=false 원본을
    그대로 통과시킨다(정규화 코드가 없다). 되돌아갈 수 있으니 화면에 57%가 뜨면
    가장 먼저 여기를 본다.
    """
    return number_or_none(info.get("dividendYield"))


def _date_from_epoch(value: Any, tz: Any) -> str | None:
    """unix 초 → `YYYY-MM-DD`."""
    seconds = int_or_none(value)
    if seconds is None:
        return None

    try:
        return datetime.fromtimestamp(seconds, tz=tz).strftime("%Y-%m-%d")
    except (OverflowError, OSError, ValueError) as exc:
        logger.debug("epoch 변환 실패 (%r): %s", value, exc)
        return None


def _calendar_dates(ticker: Any) -> tuple[str | None, str | None]:
    """`(배당락일, 다음 실적발표일)` 폴백. info 에 값이 없을 때만 부른다.

    yfinance 의 `_fetch_calendar` 는 naive `datetime.fromtimestamp()` 를 쓰므로
    서버 로컬 시간대에 따라 하루가 밀린다. 그래서 1차 경로는 원본 epoch 를 직접
    변환하고, 여기는 진짜 마지막 수단이다.
    """
    try:
        calendar = ticker.calendar
    except Exception as exc:
        logger.debug("calendar 조회 실패: %s", exc)
        return None, None

    if not isinstance(calendar, dict):
        return None, None

    def _as_text(value: Any) -> str | None:
        if isinstance(value, list | tuple):
            value = value[0] if value else None
        return value.strftime("%Y-%m-%d") if hasattr(value, "strftime") else None

    return _as_text(calendar.get("Ex-Dividend Date")), _as_text(calendar.get("Earnings Date"))


def _first_row(frame: Any, keys: tuple[str, ...]) -> Any:
    for key in keys:
        if key in frame.index:
            return frame.loc[key]
    return None


def _annual(ticker: Any) -> list[AnnualFinancial]:
    """연간 매출 · 영업이익 최대 4개년. 컬럼은 공급자가 이미 최신 우선으로 정렬해 준다."""
    try:
        frame = ticker.get_income_stmt(pretty=False, freq="yearly")
    except Exception as exc:
        logger.debug("연간 손익계산서 조회 실패: %s", exc)
        return []

    if is_empty_frame(frame):
        return []

    revenue_row = _first_row(frame, _REVENUE_KEYS)
    income_row = _first_row(frame, _OPERATING_INCOME_KEYS)
    if revenue_row is None and income_row is None:
        return []

    rows: list[AnnualFinancial] = []
    for column in list(frame.columns)[:_ANNUAL_YEARS]:
        year = getattr(column, "year", None)
        if year is None:
            continue

        rows.append(
            AnnualFinancial(
                fiscal_year=int(year),
                revenue=number_or_none(revenue_row[column]) if revenue_row is not None else None,
                operating_income=(
                    number_or_none(income_row[column]) if income_row is not None else None
                ),
            )
        )

    return rows


def _derive(numerator: float | None, denominator: float | None) -> float | None:
    """현재가 ÷ PER → EPS. 0 나눗셈과 None 을 한 곳에서 막는다."""
    if not is_number(numerator) or not is_number(denominator) or denominator == 0:
        return None

    return round(numerator / denominator, 2)


def build_fundamentals(ticker: Any, symbol: str) -> StockFundamentals:
    """Ticker 하나에서 재무·밸류에이션을 조립한다. 네트워크 생성과 분리해 둔 이유는
    테스트에서 스텁 ticker 를 그대로 주입하기 위해서다 (`tests/test_fundamentals_parse.py`).

    항목별 실패는 `None` 으로 흡수한다. 전 필드가 `None` 이어도 예외를 올리지 않는다.
    """
    info = _info(ticker)
    valuation = _valuation(ticker)

    per = valuation[_PE_LABEL] or number_or_none(info.get("trailingPE"))
    pbr = valuation[_PB_LABEL] or number_or_none(info.get("priceToBook"))
    price = _price(ticker, info)

    # 국내 종목은 trailingEps/bookValue 도 None 이라 역산이 유일한 경로다.
    # 화면의 PER·PBR 과 곱셈이 맞아떨어지는 값이지만 공시 EPS 와는 다르다.
    eps = number_or_none(info.get("trailingEps")) or _derive(price, per)
    bps = number_or_none(info.get("bookValue")) or _derive(price, pbr)

    # exDividendDate 의 원본 epoch 는 UTC 자정 정각이다(1782691200 / 86400 = 20633.0).
    # KST 로 변환하면 09:00 이 되어 날짜가 그대로지만, 의미상 UTC 로 읽는 게 맞다.
    ex_dividend = _date_from_epoch(info.get("exDividendDate"), UTC)
    # earningsTimestamp 가 아니다 — 그건 직전 발표일이다(실측: 005930.KS 2026-07-29,
    # 조회 시점 2026-08-04). 다음 발표일은 earningsTimestampStart(2026-10-28)이며
    # calendar["Earnings Date"] 와 일치한다.
    next_earnings = _date_from_epoch(info.get("earningsTimestampStart"), _KST)

    if ex_dividend is None or next_earnings is None:
        calendar_ex, calendar_earnings = _calendar_dates(ticker)
        ex_dividend = ex_dividend or calendar_ex
        next_earnings = next_earnings or calendar_earnings

    return StockFundamentals(
        symbol=symbol,
        currency=info.get("currency") or None,
        per=per,
        pbr=pbr,
        eps=eps,
        bps=bps,
        roe_pct=_roe_pct(info),
        # 앱의 다른 곳(krx/market_cap.py)도 info["marketCap"] 을 쓴다. 밸류에이션 표의
        # Market Cap 은 야후의 다른 가격 기준이라 10% 가까이 어긋나므로 2차로 둔다.
        market_cap=number_or_none(info.get("marketCap")) or valuation["Market Cap"],
        dividend_yield_pct=_dividend_yield_pct(info),
        dividend_per_share=(
            number_or_none(info.get("dividendRate"))
            or number_or_none(info.get("lastDividendValue"))
        ),
        ex_dividend_date=ex_dividend,
        next_earnings_date=next_earnings,
        annual=_annual(ticker),
    )


def fetch_stock_fundamentals(symbol: str) -> StockFundamentals:
    """이미 해석된 심볼(예: `005930.KS`)의 재무·밸류에이션을 가져온다.

    후보 심볼 탐색을 하지 않는다 — 호출자는 `/stocks/history` 응답의 `symbol`을
    그대로 넘기므로 어떤 심볼이 유효한지 이미 알고 있다 (`/stocks/content`와 같은 계약).
    """
    yf = load_yfinance()
    return build_fundamentals(yf.Ticker(symbol), symbol)
