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

## ⚠ 시총 배치와 **연달아** 돌리지 않는다

둘 다 종목당 `ticker.get_info()` 를 부른다. 시총 따라잡기(2,747종목) 직후에 이 배치를
2,703종목으로 돌렸더니 야후가 전 종목을 거부했다 — 2,703종목이 113초 만에 "끝나고"
응답 0건이었다(실제 왕복이면 5분 이상이다). 회복까지 시간이 걸린다.

한쪽을 크게 돌렸으면 다른 쪽은 다음 날 돌린다. 평소의 하루 1회 상한(400 / 200)으로는
겪지 않는 문제이고, 따라잡기처럼 상한을 올릴 때만 나온다.
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

#: 이 비율보다 적게 응답하면 배치 결과를 통째로 버린다.
#:
#: 절반으로 잡은 근거: 정상 실행은 30종목 중 30종목이 응답했다(그중 28종목이 날짜를
#: 가졌다). 반대로 막힌 실행은 2,703종목 중 **0종목**이었다. 둘 사이가 크게 벌어져
#: 있어 경계가 예민할 이유가 없고, 상장폐지·해외 계열이 섞여 응답률이 조금 떨어지는
#: 정상 배치를 버리지 않는 편이 중요하다.
_MIN_RESPONSE_RATIO = 0.5

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

            # **응답률이 무너지면 아무것도 쓰지 않는다.**
            #
            # 이 가드가 없어서 실제로 데이터를 지웠다. 시총 배치가 직전에 get_info() 를
            # 2,747번 친 뒤 이 배치가 2,703종목을 돌았는데, 야후가 전부 거부해 113초 만에
            # 0건으로 "끝났다". 저장 계층은 그 0건을 곧이곧대로 반영해 이미 수집돼 있던
            # 29종목의 날짜를 NULL 로 덮었다.
            #
            # 종목별 구분(`_fetch_one` 이 실패를 None 으로 표시)만으로도 그 사고는 막힌다.
            # 그래도 이 층을 하나 더 두는 이유: 공급자가 **에러 대신 빈 응답**을 주기
            # 시작하면 종목별로는 "정상 응답, 일정 없음" 과 구별되지 않는다. 그때
            # 마지막으로 이상을 알아챌 수 있는 신호가 "전 종목이 동시에 비었다" 이다.
            answered = len(record.answered)
            if answered < record.attempted * _MIN_RESPONSE_RATIO:
                logger.error(
                    "일정 배치를 버립니다 — %d종목 중 %d종목만 응답했습니다(%.0f%%). "
                    "공급자가 요청을 막고 있을 가능성이 큽니다. 기존 값은 그대로 둡니다.",
                    record.attempted,
                    answered,
                    100 * answered / record.attempted if record.attempted else 0,
                )
                return 0

            filled = await repo.update_calendar_dates(record.dates, record.answered)

            # 수확 0건은 **버릴 근거가 아니라 볼 근거**다. 소형주만 걸린 배치는 일정이
            # 잡힌 종목이 원래 드물어 0건이 정상일 수 있으므로 여기서 쓰기를 막지
            # 않는다(막으면 그 종목들이 타임스탬프를 못 받아 큐 앞에 영영 남는다).
            # 다만 응답은 멀쩡한데 날짜만 전부 비는 것은 공급자 필드가 바뀌었을 때의
            # 모습이기도 해서, 로그로는 남긴다 (14회차의 0건 경보와 같은 결).
            if answered and not filled:
                logger.warning(
                    "일정 배치: %d종목이 응답했지만 날짜는 0건입니다 — 소형주만 걸린 "
                    "정상일 수 있으나, yfinance 필드가 바뀌었는지 확인하세요 (예: %s)",
                    answered,
                    record.answered[0],
                )

            logger.info(
                "일정 배치: %d종목 응답 중 %d종목에서 날짜 반영 (기준일 %s)",
                answered,
                filled,
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
