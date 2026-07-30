"""지표 계산 (명세 6.3). 순수 함수 — I/O 없음."""

from app.schemas.stock import StockMetrics, StockRow
from app.utils.numbers import is_number, percent_change

_VOLUME_WINDOW = 20
_CROSS_LOOKBACK = 45
_RETURN_20D_OFFSET = 21
_RETURN_60D_OFFSET = 61


def get_latest_valid_rows(rows: list[StockRow]) -> list[StockRow]:
    """날짜 오름차순으로 정렬하고 종가가 없는 봉을 제거한다."""
    return [row for row in sorted(rows, key=lambda item: item.date or "") if is_number(row.close)]


def build_stock_metrics(rows: list[StockRow]) -> StockMetrics | None:
    """OHLCV 시계열에서 지표 요약을 만든다. 유효한 봉이 없으면 None."""
    valid = get_latest_valid_rows(rows)
    if not valid:
        return None

    latest = valid[-1]
    previous = valid[-2] if len(valid) >= 2 else None
    latest_close = latest.close
    previous_close = previous.close if previous else None

    volumes = [
        row.volume
        for row in valid[-_VOLUME_WINDOW:]
        if is_number(row.volume) and row.volume and row.volume > 0
    ]
    avg_volume = sum(volumes) / len(volumes) if volumes else None
    volume_ratio = (
        round(latest.volume / avg_volume, 2) if is_number(latest.volume) and avg_volume else None
    )

    recent_cross = next(
        (row for row in reversed(valid[-_CROSS_LOOKBACK:]) if row.cross_signal is not None),
        None,
    )

    return_20 = (
        percent_change(valid[-_RETURN_20D_OFFSET].close, latest_close)
        if len(valid) >= _RETURN_20D_OFFSET
        else None
    )
    return_60 = (
        percent_change(valid[-_RETURN_60D_OFFSET].close, latest_close)
        if len(valid) >= _RETURN_60D_OFFSET
        else None
    )

    bb_position = "중립"
    if is_number(latest_close) and is_number(latest.bb_upper) and latest_close > latest.bb_upper:
        bb_position = "상단 돌파"
    elif is_number(latest_close) and is_number(latest.bb_lower) and latest_close < latest.bb_lower:
        bb_position = "하단 이탈"

    trend = (
        "상승 우위"
        if is_number(latest.sma5) and is_number(latest.sma20) and latest.sma5 > latest.sma20
        else "중립/약세"
    )

    return StockMetrics(
        latest_date=latest.date,
        latest_close=latest_close,
        day_change=(
            round(latest_close - previous_close, 2)
            if is_number(latest_close) and is_number(previous_close)
            else None
        ),
        day_change_pct=percent_change(previous_close, latest_close),
        return_20d_pct=return_20,
        return_60d_pct=return_60,
        sma5=latest.sma5,
        sma20=latest.sma20,
        trend=trend,
        bollinger_position=bb_position,
        volume_ratio_20d=volume_ratio,
        recent_cross_signal=recent_cross.cross_signal if recent_cross else None,
        recent_cross_date=recent_cross.date if recent_cross else None,
    )
