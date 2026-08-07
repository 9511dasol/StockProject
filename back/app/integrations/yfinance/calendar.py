"""실적발표·배당락 일정 수집 ('오늘의 일정').

## 왜 파일을 따로 두나

날짜 두 개(`exDividendDate` · `earningsTimestampStart`)를 읽는 규칙은 원래
`fundamentals.py` 안에만 있었다. 그 규칙에는 **실측으로만 알 수 있는 함정 셋**이 있어
(아래 `extract_calendar_dates` 주석) 두 벌로 두면 한쪽만 고쳐 조용히 어긋난다.
그래서 규칙은 여기가 단일 출처이고 `fundamentals.py` 가 이것을 부른다.

## 왜 `fetch_stock_fundamentals` 를 배치에 그대로 쓰지 않나

그 함수는 `ticker.info` 외에 `get_valuation_measures()` 와 `get_income_stmt()` 까지
부른다. 일정만 필요한 배치에서 종목당 3배를 낼 이유가 없다 — 200종목이면 그 차이가
분 단위다.
"""

import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta, timezone
from typing import Any

from app.schemas.stock import CalendarDates, CalendarRecord

logger = logging.getLogger(__name__)

# ZoneInfo 는 Windows 에서 tzdata 패키지를 따로 요구한다. KST 는 서머타임이 없어
# 고정 오프셋이 정확하며 의존성도 늘지 않는다.
KST = timezone(timedelta(hours=9))

#: 동시 요청 수. 시총 폴백(`krx/market_cap.py`)과 같은 값이다 — 더 올리면 Yahoo 가 조인다.
_WORKERS = 8


def _date_from_epoch(value: Any, tz: Any) -> str | None:
    """unix 초 → `YYYY-MM-DD`."""
    from app.utils.numbers import int_or_none

    seconds = int_or_none(value)
    if seconds is None:
        return None

    try:
        return datetime.fromtimestamp(seconds, tz=tz).strftime("%Y-%m-%d")
    except (OverflowError, OSError, ValueError) as exc:
        logger.debug("epoch 변환 실패 (%r): %s", value, exc)
        return None


def _from_calendar(ticker: Any) -> tuple[str | None, str | None]:
    """`(배당락일, 다음 실적발표일)` 폴백. info 에 값이 없을 때만 부른다.

    yfinance 의 `_fetch_calendar` 는 naive `datetime.fromtimestamp()` 를 쓰므로 서버
    로컬 시간대에 따라 하루가 밀린다. 그래서 1차 경로는 원본 epoch 를 직접 변환하고,
    여기는 진짜 마지막 수단이다.
    """
    try:
        calendar = ticker.calendar
    except Exception as exc:  # noqa: BLE001 - 폴백이 예외를 올리면 1차 값까지 잃는다
        logger.debug("calendar 조회 실패: %s", exc)
        return None, None

    if not isinstance(calendar, dict):
        return None, None

    def _as_text(value: Any) -> str | None:
        if isinstance(value, list | tuple):
            value = value[0] if value else None
        return value.strftime("%Y-%m-%d") if hasattr(value, "strftime") else None

    return _as_text(calendar.get("Ex-Dividend Date")), _as_text(calendar.get("Earnings Date"))


def extract_calendar_dates(ticker: Any, info: dict) -> tuple[str | None, str | None]:
    """`(배당락일, 다음 실적발표일)`. 둘 다 `YYYY-MM-DD` 또는 None.

    **실측으로만 알 수 있는 함정 셋이 여기 모여 있다.**

    1. `earningsTimestamp` 는 **직전** 발표일이다. 다음 발표일은
       `earningsTimestampStart` 다 (실측: 005930.KS 가 2026-08-04 시점에 각각
       2026-07-29 / 2026-10-28). 이걸 헷갈리면 '오늘의 일정' 이 과거를 가리킨다.
    2. `exDividendDate` 의 원본 epoch 는 **UTC 자정 정각**이다
       (1782691200 / 86400 = 20633.0). KST 로 읽으면 09:00 이 되어 날짜는 같지만,
       의미상 UTC 로 읽는 것이 맞다. 실적 쪽은 반대로 KST 로 읽는다.
    3. `ticker.calendar` 폴백은 하루가 밀릴 수 있다 (위 `_from_calendar`).
       그래서 1차는 항상 원본 epoch 다.

    호출자가 `info` 를 넘기는 이유: `ticker.info` 는 0.5~1.5초짜리라 이 함수가 다시
    부르면 안 된다. 이미 가진 것을 재사용한다.
    """
    ex_dividend = _date_from_epoch(info.get("exDividendDate"), UTC)
    next_earnings = _date_from_epoch(info.get("earningsTimestampStart"), KST)

    if ex_dividend is None or next_earnings is None:
        calendar_ex, calendar_earnings = _from_calendar(ticker)
        ex_dividend = ex_dividend or calendar_ex
        next_earnings = next_earnings or calendar_earnings

    return ex_dividend, next_earnings


def _fetch_one(symbol: str) -> tuple[str, CalendarDates | None]:
    """종목 하나의 일정.

    **`None` 과 빈 `CalendarDates` 는 다르다.**

        None            응답을 못 받았다 (예외 · 빈 info). 아무것도 모르는 상태다
        CalendarDates() 응답은 받았고 일정이 없다. 이건 **사실**이라 그대로 반영한다

    처음에는 둘을 같은 값으로 뭉갰다. "일정 없는 종목이 어차피 다수라 구분할 실익이
    없다" 고 봤는데 틀렸다 — 저장 계층이 이 값으로 **덮어쓰기** 때문이다. 야후가
    요청을 거부하는 순간 전 종목이 "일정 없음" 이 되어 이미 수집한 날짜를 지운다
    (`schemas/stock.CalendarRecord` 주석에 실제로 겪은 내용을 적어 뒀다).

    `info` 가 비어 있는 것을 실패로 보는 근거: 살아 있는 종목의 `get_info()` 는 항상
    채워진 dict 를 준다. 빈 dict 는 조회가 막혔거나 심볼이 죽었다는 뜻이고, 어느
    쪽이든 "일정이 없다" 고 단정할 근거가 되지 못한다.
    """
    import yfinance as yf

    try:
        ticker = yf.Ticker(symbol)
        info = ticker.get_info() or {}
    except Exception:  # noqa: BLE001 - 종목 하나가 배치 전체를 세우면 안 된다
        return symbol, None

    if not info:
        return symbol, None

    ex_dividend, next_earnings = extract_calendar_dates(ticker, info)
    return symbol, CalendarDates(
        ex_dividend_date=ex_dividend, next_earnings_date=next_earnings
    )


def fetch_calendar_dates(symbols: list[str]) -> CalendarRecord:
    """종목 목록의 일정을 모아 온다. 블로킹이므로 서비스가 `to_thread` 로 감싼다.

    `answered` 에는 **응답을 받은 심볼만** 담는다. 일정이 없다는 응답도 포함이다 —
    그건 사실이므로 저장 계층이 반영하고 `calendar_updated_at` 을 찍어야 배치가
    앞으로 나아간다. 반면 응답을 못 받은 종목은 빠지므로 아무것도 기록되지 않고
    다음 배치가 다시 물어본다.
    """
    if not symbols:
        return CalendarRecord()

    dates: dict[str, CalendarDates] = {}
    answered: list[str] = []
    with ThreadPoolExecutor(max_workers=_WORKERS) as pool:
        for symbol, value in pool.map(_fetch_one, symbols):
            if value is None:
                continue
            answered.append(symbol)
            if value.ex_dividend_date or value.next_earnings_date:
                dates[symbol] = value

    logger.info(
        "일정 수집: %d종목에 물어 %d종목이 응답, 그중 %d종목에서 날짜를 얻음",
        len(symbols),
        len(answered),
        len(dates),
    )
    return CalendarRecord(
        as_of=datetime.now(KST).date().isoformat(),
        attempted=len(symbols),
        answered=answered,
        dates=dates,
    )
