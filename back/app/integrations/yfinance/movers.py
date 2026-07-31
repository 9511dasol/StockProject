"""등락률 랭킹 스캔 (홈 화면 상승/하락 상위).

동기 함수다 — 서비스 계층이 `asyncio.to_thread`로 호출한다.

**왜 yfinance 벌크인가.** 원래 자리는 KRX다: pykrx의 `get_market_price_change`
한 번이면 전 종목 등락률이 나온다. 그런데 KRX 데이터포털이 로그인을 요구하도록
바뀌어 `KRX_ID`/`KRX_PW` 없이는 전부 실패한다 (시가총액 배치가 같은 이유로
yfinance 폴백을 두고 있다). 그래서 여기서는 `yf.download` 로 여러 종목을 한 번에
받아 등락률을 직접 계산한다.

전 종목(2,700+)을 훑지 않고 모집단을 시가총액 상위로 좁히는 이유는 시간이다 —
200종목이 약 7초다. 모집단은 호출자가 정해 넘기므로(`settings.market_movers_universe_size`)
이 파일에는 종목 목록이 박혀 있지 않다.
"""

import logging
from collections.abc import Sequence
from typing import Any

from app.domain.symbols import normalize_stock_code
from app.integrations.yfinance.client import load_yfinance
from app.schemas.market import MoverRow, MoversScan
from app.schemas.stock import ListedCompanyRecord
from app.utils.numbers import number_or_none

logger = logging.getLogger(__name__)

#: 스파크라인 점 개수. 홈 카드가 76×24px 라 그 이상은 그려도 보이지 않는다.
_SPARK_POINTS = 24
#: 24봉을 채우고도 휴장·신규상장 여유가 남는 길이.
_HISTORY_PERIOD = "3mo"


def _closes_of(frame: Any, symbol: str, single: bool) -> Any | None:
    """벌크 프레임에서 한 종목의 종가 시리즈를 꺼낸다.

    `yf.download` 는 종목이 하나면 컬럼에 티커 레벨을 만들지 않는다 — 모집단이
    1종목까지 줄어든 환경에서 조용히 전부 실패하지 않도록 두 형태를 모두 받는다.
    """
    try:
        series = frame["Close"] if single else frame[symbol]["Close"]
    except (KeyError, IndexError):
        return None
    return series.dropna()


def scan_movers(
    universe: Sequence[ListedCompanyRecord],
    *,
    universe_label: str,
) -> MoversScan:
    """모집단의 전일 대비 등락률을 계산해 내림차순 전체를 돌려준다.

    이름은 넘겨받은 KRX 상호를 쓴다. 공급자의 `shortName` 은 영문이거나
    (ECOPROBM) 아예 이름이 아닐 수 있어(`"247540.KS,0P0001GZPV,623889"`)
    목록·검색·상세와 표기가 어긋난다.
    """
    if not universe:
        return MoversScan(universe_label=universe_label)

    yf = load_yfinance()
    symbols = [record.symbol for record in universe]

    frame = yf.download(
        tickers=symbols,
        period=_HISTORY_PERIOD,
        interval="1d",
        group_by="ticker",
        auto_adjust=False,
        threads=True,
        progress=False,
    )
    if frame is None or frame.empty:
        logger.warning("등락률 스캔: 응답이 비었습니다 (모집단 %d종목)", len(symbols))
        return MoversScan(universe_label=universe_label, universe_size=len(symbols))

    single = len(symbols) == 1
    rows: list[MoverRow] = []

    for record in universe:
        closes = _closes_of(frame, record.symbol, single)
        # 전일 종가가 있어야 등락률이 성립한다 — 신규 상장·거래정지는 여기서 빠진다.
        if closes is None or len(closes) < 2:
            continue

        previous = number_or_none(closes.iloc[-2])
        latest = number_or_none(closes.iloc[-1])
        if not previous or latest is None:
            continue

        change = latest - previous
        rows.append(
            MoverRow(
                name=record.name,
                symbol=record.symbol,
                code=normalize_stock_code(record.symbol),
                market=record.market,
                price=latest,
                change=round(change, 2),
                change_percent=round(change / previous * 100, 2),
                spark=[
                    value
                    for value in (
                        number_or_none(point) for point in closes.tail(_SPARK_POINTS)
                    )
                    if value is not None
                ],
            )
        )

    rows.sort(key=lambda row: row.change_percent, reverse=True)

    as_of = None
    if len(frame.index):
        as_of = str(frame.index[-1].date())

    logger.info(
        "등락률 스캔 완료: %d/%d종목 (기준일 %s)", len(rows), len(symbols), as_of
    )
    return MoversScan(
        as_of=as_of,
        source="YFINANCE",
        universe_label=universe_label,
        universe_size=len(symbols),
        rows=rows,
    )
