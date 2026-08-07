"""오늘의 일정 — 실적발표 · 배당락 (P1).

## 왜 미리 적재하나

yfinance 는 종목당 1회 호출(~1초)이라 "이번 주에 실적발표가 있는 종목" 을 요청 시점에
찾으려면 전 종목(2,700+)을 훑어야 한다. 답이 나올 무렵이면 사용자는 이미 떠났다.
그래서 하루 1회 배치가 `listed_companies` 의 날짜 컬럼을 채우고, 조회는 인덱스를 타는
SQL 한 번이 된다 (`models/listed_company.py` 주석).

## 배치가 시총 배치와 다른 점 하나

**일정은 만료된다.** 시총은 며칠 스테일해도 랭킹 순서가 안 바뀌지만, 실적발표일은
지나가면 그 값이 과거를 가리킨다. 그래서 "아직 없는 종목" 이 아니라 **"가장 오래
안 물어본 종목"** 부터 채운다 (`symbols_for_calendar_refresh`).
"""

import asyncio
import logging
from datetime import UTC, date, datetime, timedelta

from app.core.config import settings
from app.domain.symbols import board_of
from app.integrations.yfinance.calendar import KST, fetch_calendar_dates
from app.repositories.listed_company import ListedCompanyRepository
from app.schemas.market import CalendarEvent, CalendarKind, MarketCalendar

logger = logging.getLogger(__name__)

_CALENDAR_TTL = timedelta(days=1)

#: 응답의 `kind` → 저장 컬럼. 리포지토리가 이 문자열만 받는다.
_COLUMNS: dict[CalendarKind, str] = {
    "earnings": "next_earnings_date",
    "ex_dividend": "ex_dividend_date",
}

_refresh_lock = asyncio.Lock()
_background_tasks: set[asyncio.Task[int]] = set()
#: 마지막 '시도' 시각. DB 조회 없이 스케줄 자체를 걸러내기 위한 메모리 가드다 —
#: 매 홈 요청마다 세션을 열어 TTL 을 확인하면 그 자체가 낭비다.
_last_refresh_attempt: datetime | None = None


async def refresh_calendar(repo: ListedCompanyRepository, *, force: bool = False) -> int:
    """일정을 하루 1회 갱신한다. 날짜를 얻은 종목 수를 돌려준다.

    실패해도 예외를 올리지 않는다 — 일정은 얹는 기능이고, 이것 때문에 홈이 죽으면
    안 된다. 값이 없으면 화면에서 섹션이 비어 보일 뿐이다.
    """
    async with _refresh_lock:
        try:
            if not force:
                latest = await repo.latest_calendar_update()
                if latest and datetime.now(UTC) - latest < _CALENDAR_TTL:
                    return 0

            symbols = await repo.symbols_for_calendar_refresh(settings.calendar_batch_limit)
            if not symbols:
                logger.info("일정 배치: 물어볼 종목이 없습니다 (상장사 목록이 비었는가)")
                return 0

            record = await asyncio.to_thread(fetch_calendar_dates, symbols)
            filled = await repo.update_calendar_dates(record.dates, record.asked)

            # 0건이 사실일 수 있다 — 배당도 안 하고 발표일도 안 잡힌 종목만 걸린 경우다.
            # 그래도 **한 건도 없으면** 공급자 응답 형태가 바뀌었을 가능성을 남긴다
            # (14회차의 0건 경보와 같은 결).
            if not filled:
                logger.warning(
                    "일정 배치: %d종목에 물었지만 날짜를 하나도 얻지 못했습니다 — "
                    "yfinance 응답 형태를 확인하세요 (예: %s)",
                    len(symbols),
                    symbols[0],
                )
            else:
                logger.info(
                    "일정 배치: %d/%d종목에서 날짜 반영 (기준일 %s)",
                    filled,
                    len(symbols),
                    record.as_of,
                )
            return filled
        except Exception:  # noqa: BLE001 - 일정 실패가 홈을 죽이면 안 된다
            logger.exception("일정 배치 실패 — 기존 값으로 계속합니다")
            return 0


async def _refresh_in_new_session() -> int:
    """요청 세션은 응답과 함께 닫히므로 백그라운드 작업은 자기 세션을 연다."""
    from app.core.database import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        return await refresh_calendar(ListedCompanyRepository(session))


def schedule_calendar_refresh() -> None:
    """갱신을 백그라운드로 띄운다. 홈 요청이 수집(수십 초)을 기다리지 않는다.

    `listed_company_service._schedule_market_cap_refresh` 와 같은 모양이다 — 태스크
    참조를 보관하는 것은 GC 가 실행 중인 태스크를 수거하지 못하게 하기 위함이다.
    """
    global _last_refresh_attempt

    now = datetime.now(UTC)
    if _last_refresh_attempt and now - _last_refresh_attempt < _CALENDAR_TTL:
        return
    _last_refresh_attempt = now

    task = asyncio.create_task(_refresh_in_new_session())
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)


def _event(company, kind: CalendarKind, value: date, today: date) -> CalendarEvent:
    return CalendarEvent(
        name=company.name,
        symbol=company.symbol,
        code=company.symbol.split(".", 1)[0],
        board=board_of(company.symbol),
        kind=kind,
        date=value.isoformat(),
        d_day=(value - today).days,
        market_cap=company.market_cap,
    )


async def get_calendar(
    repo: ListedCompanyRepository,
    *,
    kind: CalendarKind | None = None,
    days: int = 7,
    limit: int = 20,
    today: date | None = None,
) -> MarketCalendar:
    """오늘부터 `days` 일 안의 일정. `kind` 가 없으면 둘 다 섞어 날짜순으로 낸다.

    `today` 를 주입받는 것은 테스트 때문이다 — 실제 날짜에 의존하면 그 테스트는
    내일 빨개진다. 기본값은 **KST 기준 오늘**이다: 사용자도 종목도 한국에 있는데
    서버가 UTC 면 자정 근처에서 하루가 밀린다.
    """
    reference = today or datetime.now(KST).date()
    end = reference + timedelta(days=days)
    kinds: tuple[CalendarKind, ...] = (kind,) if kind else ("earnings", "ex_dividend")

    events: list[CalendarEvent] = []
    total = 0
    for target in kinds:
        column = _COLUMNS[target]
        total += await repo.count_upcoming_calendar(column, reference, end)
        # 종류별로 limit 만큼 가져와 합친 뒤 다시 자른다. 한쪽이 창을 독차지해도
        # 다른 쪽이 사라지지 않게 하려면 각자 뽑아야 한다.
        for company in await repo.upcoming_calendar(column, reference, end, limit):
            value = getattr(company, column)
            if value is not None:
                events.append(_event(company, target, value, reference))

    # 날짜 오름차순 → 같은 날은 시총 큰 순. 이 목록의 축은 종목이 아니라 날짜다.
    events.sort(key=lambda item: (item.date, -(item.market_cap or 0)))

    covered, universe = await repo.calendar_coverage()
    latest = await repo.latest_calendar_update()

    return MarketCalendar(
        as_of=latest.astimezone(KST).date().isoformat() if latest else None,
        days=days,
        total=total,
        events=events[:limit],
        covered=covered,
        universe_size=universe,
        updated_at=datetime.now(UTC).isoformat(timespec="seconds"),
    )
