"""OHLCV 히스토리 + 보조지표 파생 (명세 6.3).

동기 함수다 — 서비스 계층이 `asyncio.to_thread`로 호출한다.
"""

import logging
from datetime import date, timedelta
from typing import Any

from app.core.exceptions import StockNotFoundError
from app.domain.constants import STOCK_TIMEFRAMES
from app.domain.symbols import (
    get_common_stock_name,
    get_korean_stock_name,
    normalize_stock_candidates,
)
from app.integrations.yfinance.client import get_stock_name, load_yfinance
from app.integrations.yfinance.news import fetch_stock_news
from app.integrations.yfinance.reports import fetch_analyst_reports
from app.schemas.stock import StockHistory, StockRow
from app.utils.numbers import int_or_none, number_or_none

logger = logging.getLogger(__name__)

_SMA_SHORT = 5
_SMA_LONG = 20
_BOLLINGER_STD = 2
_NEWS_LIMIT = 3
_REPORT_LIMIT = 3


def _with_indicators(history: Any) -> Any:
    """SMA5/SMA20 · 볼린저밴드 · 골든/데드크로스 신호를 붙인다."""
    history = history.copy()
    history["SMA5"] = history["Close"].rolling(_SMA_SHORT).mean()
    history["SMA20"] = history["Close"].rolling(_SMA_LONG).mean()

    std20 = history["Close"].rolling(_SMA_LONG).std()
    history["BB_upper"] = history["SMA20"] + _BOLLINGER_STD * std20
    history["BB_lower"] = history["SMA20"] - _BOLLINGER_STD * std20

    # SMA5가 SMA20을 상향 돌파하면 golden, 하향 이탈하면 dead.
    ma_cross = (history["SMA5"] > history["SMA20"]).astype(int).diff()
    history["CrossSignal"] = None
    history.loc[ma_cross == 1, "CrossSignal"] = "golden"
    history.loc[ma_cross == -1, "CrossSignal"] = "dead"

    return history


def _date_text(date_value: Any) -> str:
    if hasattr(date_value, "date"):
        return date_value.date().isoformat()

    return str(date_value)[:10]


def _build_rows(history: Any, stock_name: str, symbol: str, limit: int) -> list[StockRow]:
    rows: list[StockRow] = []
    for date_value, row in history.tail(limit).iterrows():
        rows.append(
            StockRow(
                name=stock_name,
                symbol=symbol,
                date=_date_text(date_value),
                open=number_or_none(row.get("Open")),
                close=number_or_none(row.get("Close")),
                high=number_or_none(row.get("High")),
                low=number_or_none(row.get("Low")),
                volume=int_or_none(row.get("Volume")),
                sma5=number_or_none(row.get("SMA5")),
                sma20=number_or_none(row.get("SMA20")),
                bb_upper=number_or_none(row.get("BB_upper")),
                bb_lower=number_or_none(row.get("BB_lower")),
                cross_signal=row.get("CrossSignal"),
            )
        )
    return rows


def fetch_stock_history(
    symbol: str,
    timeframe: str,
    period: str | None,
    limit: int,
    start_date: date | None = None,
    end_date: date | None = None,
    *,
    include_content: bool = True,
) -> StockHistory:
    """후보 심볼을 순서대로 시도해 첫 성공을 반환한다.

    파라미터 검증(timeframe/period/날짜 범위)은 서비스 계층에서 이미 끝난 상태로
    들어온다 — 이 함수는 공급자 호출과 변환만 담당한다.
    """
    yf = load_yfinance()

    has_date_range = bool(start_date or end_date)
    selected_period = None if has_date_range else period or STOCK_TIMEFRAMES[timeframe]["period"]
    interval = STOCK_TIMEFRAMES[timeframe]["interval"]
    requested_name = get_common_stock_name(symbol)

    for candidate in normalize_stock_candidates(symbol):
        ticker = yf.Ticker(candidate)

        history_kwargs: dict[str, Any] = {"interval": interval, "auto_adjust": False}
        if has_date_range:
            if start_date:
                history_kwargs["start"] = start_date.isoformat()
            if end_date:
                # yfinance의 end는 배타적이라 하루를 더해 종료일을 포함시킨다.
                history_kwargs["end"] = (end_date + timedelta(days=1)).isoformat()
        else:
            history_kwargs["period"] = selected_period

        try:
            history = ticker.history(**history_kwargs)
        except Exception as exc:
            logger.info("%s 히스토리 조회 실패 (%s) → 다음 후보", candidate, exc)
            continue

        if history.empty:
            logger.info("%s 히스토리가 비어 있습니다 → 다음 후보", candidate)
            continue

        history = _with_indicators(history)
        stock_name = (
            requested_name or get_korean_stock_name(candidate) or get_stock_name(ticker, candidate)
        )

        return StockHistory(
            name=stock_name,
            symbol=candidate,
            query=symbol,
            timeframe=timeframe,  # type: ignore[arg-type]  # 서비스 계층에서 검증됨
            period=selected_period or "custom",
            interval=interval,
            start_date=start_date.isoformat() if start_date else None,
            end_date=end_date.isoformat() if end_date else None,
            rows=_build_rows(history, stock_name, candidate, limit),
            news=fetch_stock_news(ticker, _NEWS_LIMIT) if include_content else [],
            reports=(
                fetch_analyst_reports(ticker, candidate, _REPORT_LIMIT) if include_content else []
            ),
        )

    raise StockNotFoundError
