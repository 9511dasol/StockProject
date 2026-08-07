"""오늘의 일정 — 실적발표 · 배당락 (P1).

여기서 지키는 것 넷이다.

1. **날짜 추출 규칙** — `earningsTimestamp`(직전)와 `earningsTimestampStart`(다음)를
   헷갈리면 '오늘의 일정' 이 과거를 가리킨다. 오류가 안 나고 그냥 틀린다.
2. **배치가 앞으로 나아가는가** — 값을 못 받은 종목에도 `calendar_updated_at` 을
   찍지 않으면 같은 종목만 영원히 다시 물어본다. 로그로도 안 보이는 제자리걸음이다.
3. **창 밖 일정이 새지 않는가** — 지난 일정이 섞이면 화면이 거짓말을 한다.
4. **정렬 축이 날짜인가** — 이 목록은 종목 목록이 아니라 일정 목록이다.

`today` 를 주입해 실제 날짜에 의존하지 않는다. 그러지 않으면 이 파일은 내일 빨개진다.
"""

from datetime import date, datetime

import pytest

from app.integrations.yfinance.calendar import KST, extract_calendar_dates
from app.repositories.listed_company import ListedCompanyRepository
from app.schemas.stock import CalendarDates, ListedCompanyRecord
from app.services import calendar_service

_TODAY = date(2026, 8, 7)


class _Ticker:
    """`ticker.calendar` 만 흉내 내는 스텁. 네트워크는 타지 않는다."""

    def __init__(self, calendar: dict | None = None) -> None:
        self._calendar = calendar

    @property
    def calendar(self):
        if self._calendar is None:
            raise RuntimeError("calendar 없음")
        return self._calendar


# ── 날짜 추출 규칙 ────────────────────────────────────────────────────────


def test_next_earnings_comes_from_timestamp_start_not_timestamp() -> None:
    """`earningsTimestamp` 는 **직전** 발표일이다 — 그걸 쓰면 일정이 과거를 가리킨다.

    실측값을 그대로 쓴다: 005930.KS 가 2026-08-04 시점에 직전 2026-07-29,
    다음 2026-10-28 이었다.
    """
    info = {
        "earningsTimestamp": 1785283200,  # 2026-07-29 (직전)
        "earningsTimestampStart": 1793142000,  # 2026-10-28 (다음)
    }

    _, next_earnings = extract_calendar_dates(_Ticker(), info)

    assert next_earnings == "2026-10-28"


def test_ex_dividend_is_read_as_utc() -> None:
    """`exDividendDate` 의 원본 epoch 는 UTC 자정 정각이다 (1782691200 / 86400 = 20633.0)."""
    _ex, _ = extract_calendar_dates(_Ticker(), {"exDividendDate": 1782691200})

    assert _ex == "2026-06-29"


def test_calendar_is_only_a_fallback() -> None:
    """info 에 값이 있으면 `ticker.calendar` 를 보지 않는다.

    폴백은 하루가 밀릴 수 있다(yfinance 가 naive `fromtimestamp` 를 쓴다). 그래서
    1차는 항상 원본 epoch 여야 하고, 이 테스트는 그 우선순위를 고정한다.
    """
    ticker = _Ticker({"Earnings Date": [date(2999, 1, 1)]})
    info = {"earningsTimestampStart": 1793142000}

    _, next_earnings = extract_calendar_dates(ticker, info)

    assert next_earnings == "2026-10-28"


def test_missing_dates_do_not_raise() -> None:
    """일정이 없는 종목이 다수다 — 그것은 실패가 아니라 사실이다."""
    assert extract_calendar_dates(_Ticker(), {}) == (None, None)


# ── 배치 저장 ─────────────────────────────────────────────────────────────


@pytest.fixture
async def seeded(db_session) -> ListedCompanyRepository:
    repo = ListedCompanyRepository(db_session)
    await repo.upsert_many(
        [
            ListedCompanyRecord(symbol="005930.KS", name="삼성전자", market="유가"),
            ListedCompanyRecord(symbol="000660.KS", name="SK하이닉스", market="유가"),
            ListedCompanyRecord(symbol="247540.KQ", name="에코프로비엠", market="코스닥"),
        ]
    )
    await repo.update_market_caps({"005930": 400_000_000, "000660": 200_000_000})
    return repo


async def test_answered_symbols_get_a_timestamp_even_without_dates(seeded) -> None:
    """**응답만 받았으면 날짜가 없어도 시각은 찍는다.**

    안 찍으면 일정이 없는 종목(대부분)이 `nullsfirst` 정렬 맨 앞에 영원히 남아,
    배치가 같은 종목만 반복해서 물어보고 나머지는 한 번도 못 채운다. 조용히 제자리를
    도는 종류라 로그로도 안 보인다 — 그래서 테스트가 필요하다.
    """
    answered = ["005930.KS", "000660.KS"]

    filled = await seeded.update_calendar_dates(
        {"005930.KS": CalendarDates(next_earnings_date="2026-10-28")}, answered
    )

    assert filled == 1  # 날짜를 얻은 것은 하나뿐이지만

    # 응답받은 둘 다 정렬 맨 앞에서 빠져야 한다 — 다음 배치는 아직 안 물어본 종목을 본다.
    following = await seeded.symbols_for_calendar_refresh(limit=3)
    assert following[0] == "247540.KQ"


async def test_unanswered_symbols_are_left_completely_alone(seeded) -> None:
    """**응답을 못 받은 종목은 건드리지 않는다 — 실제로 데이터를 지운 자리다.**

    전 종목 배치를 돌렸을 때 야후가 요청을 전부 거부했다(직전에 시총 배치가
    `get_info()` 를 2,747번 쳤다). 2,703종목이 113초 만에 0건으로 "끝났고", 그 0건이
    이미 수집돼 있던 29종목의 날짜를 NULL 로 덮었다. `calendar_updated_at` 까지 찍혀
    방금 확인한 행처럼 보였다.

    지금은 응답 못 받은 종목이 `answered` 에서 빠지므로, 값도 타임스탬프도 그대로다.
    """
    await seeded.update_calendar_dates(
        {"005930.KS": CalendarDates(next_earnings_date="2026-10-28")}, ["005930.KS"]
    )

    # 다음 배치가 005930 은 응답을 못 받고 000660 만 받았다.
    await seeded.update_calendar_dates({}, ["000660.KS"])

    kept = await seeded.upcoming_calendar(
        "next_earnings_date", _TODAY, date(2026, 12, 31), 10
    )
    assert [row.symbol for row in kept] == ["005930.KS"], "응답 못 받은 종목의 날짜가 지워졌다"


async def test_failed_fetch_is_not_the_same_as_no_schedule() -> None:
    """수집기가 **실패(None)** 와 **응답했으나 일정 없음(빈 값)** 을 구분하는가.

    이 구분이 없으면 위 테스트가 지키는 계약을 저장 계층이 아무리 지켜도 소용없다 —
    실패가 "일정 없음" 으로 도착하기 때문이다.
    """
    from app.integrations.yfinance import calendar as calendar_module

    responses = {
        "OK.KS": {"earningsTimestampStart": 1793142000},
        "EMPTY.KS": {"someField": 1},  # 응답은 왔고 일정만 없다
        "BLOCKED.KS": {},  # 빈 info = 막혔다
    }

    def fake_fetch(symbol: str):
        info = responses[symbol]
        if not info:
            return symbol, None
        ex, ne = calendar_module.extract_calendar_dates(_Ticker(), info)
        return symbol, CalendarDates(ex_dividend_date=ex, next_earnings_date=ne)

    original = calendar_module._fetch_one
    calendar_module._fetch_one = fake_fetch
    try:
        record = calendar_module.fetch_calendar_dates(list(responses))
    finally:
        calendar_module._fetch_one = original

    assert record.attempted == 3
    # 막힌 종목은 응답 목록에서 빠진다 → 저장 계층이 건드리지 않는다.
    assert sorted(record.answered) == ["EMPTY.KS", "OK.KS"]
    assert set(record.dates) == {"OK.KS"}


async def test_collapsed_response_rate_discards_the_whole_batch(seeded, monkeypatch) -> None:
    """응답률이 무너지면 **응답받은 소수까지 포함해 통째로 버린다.**

    종목별 구분(`answered` 에서 제외)만으로도 전멸 사고는 막힌다. 이 층을 하나 더 두는
    이유는 **일부만 응답하는 중간 상태** 때문이다 — 공급자가 조이기 시작하면 소수만
    통과하는데, 그 소수의 "일정 없음" 을 곧이곧대로 반영하면 멀쩡하던 날짜가 지워진다.
    표본이 무너진 배치는 부분 반영도 하지 않는 편이 안전하다.

    이 테스트는 처음에 `answered=[]` 로 썼다가 **가드를 빼도 통과**했다. 빈 목록은
    리포지토리가 먼저 걸러내(`if not answered`) 가드까지 가지도 않기 때문이다 —
    검사기가 검사 대상을 안 지나가는, 안 잡는 테스트였다.
    """
    await seeded.update_calendar_dates(
        {"005930.KS": CalendarDates(next_earnings_date="2026-10-28")}, ["005930.KS"]
    )

    from app.schemas.stock import CalendarRecord

    def throttled(symbols):
        # 3종목에 물었지만 하나만 통과했고, 그마저 일정이 비어 있다.
        # 가드가 없으면 이 하나가 005930 의 날짜를 지운다.
        return CalendarRecord(
            as_of="2026-08-07", attempted=3, answered=["005930.KS"], dates={}
        )

    monkeypatch.setattr(calendar_service, "fetch_calendar_dates", throttled)

    filled = await calendar_service.refresh_calendar(seeded, force=True)

    assert filled == 0
    kept = await seeded.upcoming_calendar(
        "next_earnings_date", _TODAY, date(2026, 12, 31), 10
    )
    assert [row.symbol for row in kept] == ["005930.KS"], "버려야 할 배치가 기존 값을 덮었다"


async def test_healthy_batch_is_written_even_with_few_dates(seeded, monkeypatch) -> None:
    """반대 방향도 지킨다 — **응답률이 멀쩡하면 날짜가 적어도 반영한다.**

    가드를 '날짜 수확률' 로 걸면 안 되는 이유다. 소형주 배치는 일정이 잡힌 종목이
    원래 드물어서, 수확 0건이 정상인 날이 있다. 그때 배치를 버리면 그 종목들은
    영원히 타임스탬프를 못 받아 큐 맨 앞에 남는다.
    """
    from app.schemas.stock import CalendarRecord

    def lean(symbols):
        return CalendarRecord(
            as_of="2026-08-07",
            attempted=len(symbols),
            answered=list(symbols),
            dates={},
        )

    monkeypatch.setattr(calendar_service, "fetch_calendar_dates", lean)

    await calendar_service.refresh_calendar(seeded, force=True)

    # 전부 응답받았으므로 타임스탬프가 찍혀 다음 배치가 앞으로 나아간다.
    assert await seeded.latest_calendar_update() is not None


async def test_batch_picks_the_stalest_first(seeded) -> None:
    """가장 오래 안 물어본 순. NULL(한 번도 안 물어봄)이 가장 오래된 것이다."""
    await seeded.update_calendar_dates({}, ["005930.KS"])

    order = await seeded.symbols_for_calendar_refresh(limit=3)

    # 아직 안 물어본 둘이 먼저, 그중에서는 시총 큰 순.
    assert order == ["000660.KS", "247540.KQ", "005930.KS"]


async def test_batch_falls_back_to_kospi_when_no_market_cap(db_session) -> None:
    """**시총이 전부 비어 있어도 순서가 뜻을 가져야 한다.**

    실측으로 이 프로젝트의 DB 는 2,747건 전부 `market_cap` 이 NULL 이었다 — 시총
    배치가 한 번도 성공한 적이 없었다. 그 상태에서 `market_cap desc` 만 타이브레이크로
    두면 정렬 항이 통째로 죽고 물리적 행 순서가 남는다. 배치는 정상 동작하고 채우는
    순서만 무작위가 되어, 홈 화면이 2주 동안 무명 종목만 보여준다 —
    `symbols_without_market_cap` 이 겪었던 것과 정확히 같은 종류의 침묵이다.
    """
    repo = ListedCompanyRepository(db_session)
    await repo.upsert_many(
        [
            ListedCompanyRecord(symbol="900100.KQ", name="코스닥A", market="코스닥"),
            ListedCompanyRecord(symbol="000020.KS", name="유가B", market="유가"),
            ListedCompanyRecord(symbol="900200.KQ", name="코스닥C", market="코스닥"),
            ListedCompanyRecord(symbol="000010.KS", name="유가A", market="유가"),
        ]
    )

    order = await repo.symbols_for_calendar_refresh(limit=4)

    # 유가(.KS)가 먼저, 그 안에서는 심볼 오름차순으로 **결정적**이다.
    assert order == ["000010.KS", "000020.KS", "900100.KQ", "900200.KQ"]


async def test_dates_are_overwritten_including_removal(seeded) -> None:
    """발표가 끝나면 공급자가 다음 분기 날짜를 준다 — 값이 **바뀌어야** 한다.

    없어진 일정(취소·미정)도 그대로 반영한다. 남겨 두면 지난 날짜가 화면에 계속 뜬다.
    """
    await seeded.update_calendar_dates(
        {"005930.KS": CalendarDates(next_earnings_date="2026-08-10")}, ["005930.KS"]
    )
    await seeded.update_calendar_dates({}, ["005930.KS"])

    events = await seeded.upcoming_calendar(
        "next_earnings_date", _TODAY, date(2026, 12, 31), 10
    )
    assert events == []


async def test_unknown_column_is_rejected(seeded) -> None:
    """컬럼 이름을 문자열로 받되 SQL 에 그대로 넣지 않는다."""
    with pytest.raises(ValueError, match="일정 컬럼"):
        await seeded.upcoming_calendar("market_cap; drop table", _TODAY, _TODAY, 1)


# ── 조회 ──────────────────────────────────────────────────────────────────


async def _fill(repo: ListedCompanyRepository) -> None:
    await repo.update_calendar_dates(
        {
            # 같은 날 두 종목 — 시총 큰 쪽이 먼저여야 한다.
            "000660.KS": CalendarDates(next_earnings_date="2026-08-11"),
            "005930.KS": CalendarDates(
                next_earnings_date="2026-08-11", ex_dividend_date="2026-08-09"
            ),
            # 창(7일) 밖.
            "247540.KQ": CalendarDates(next_earnings_date="2026-09-30"),
        },
        ["005930.KS", "000660.KS", "247540.KQ"],
    )


async def test_calendar_is_sorted_by_date_then_size(seeded) -> None:
    """이 목록의 축은 종목이 아니라 **날짜**다."""
    await _fill(seeded)

    result = await calendar_service.get_calendar(seeded, days=7, limit=20, today=_TODAY)

    assert [(e.date, e.code, e.kind) for e in result.events] == [
        ("2026-08-09", "005930", "ex_dividend"),
        ("2026-08-11", "005930", "earnings"),  # 같은 날은 시총 큰 순
        ("2026-08-11", "000660", "earnings"),
    ]


async def test_events_outside_the_window_are_excluded(seeded) -> None:
    """창 밖(9/30)은 안 나온다. 지난 일정도 마찬가지다 — 오늘이 하한이다."""
    await _fill(seeded)

    result = await calendar_service.get_calendar(seeded, days=7, limit=20, today=_TODAY)

    assert "247540" not in {event.code for event in result.events}
    assert all(event.d_day >= 0 for event in result.events)


async def test_one_symbol_can_produce_two_rows(seeded) -> None:
    """실적발표와 배당락이 같은 기간에 있으면 **줄이 둘**이다.

    한 줄에 합치면 날짜순 정렬이 불가능해진다 (`schemas/market.CalendarEvent` 주석).
    """
    await _fill(seeded)

    result = await calendar_service.get_calendar(seeded, days=7, limit=20, today=_TODAY)

    assert [e.kind for e in result.events if e.code == "005930"] == ["ex_dividend", "earnings"]


async def test_kind_filter_narrows_to_one(seeded) -> None:
    await _fill(seeded)

    result = await calendar_service.get_calendar(
        seeded, kind="ex_dividend", days=7, limit=20, today=_TODAY
    )

    assert {e.kind for e in result.events} == {"ex_dividend"}


async def test_d_day_counts_from_the_given_today(seeded) -> None:
    await _fill(seeded)

    result = await calendar_service.get_calendar(seeded, days=7, limit=20, today=_TODAY)

    assert {e.date: e.d_day for e in result.events} == {"2026-08-09": 2, "2026-08-11": 4}


async def test_coverage_reports_batch_progress(seeded) -> None:
    """빈 목록이 '데이터 없음'인지 '아직 채우는 중'인지 호출부가 구분할 근거."""
    before = await calendar_service.get_calendar(seeded, days=7, limit=20, today=_TODAY)
    assert (before.covered, before.universe_size) == (0, 3)

    await _fill(seeded)

    after = await calendar_service.get_calendar(seeded, days=7, limit=20, today=_TODAY)
    assert (after.covered, after.universe_size) == (3, 3)


async def test_as_of_reflects_the_batch_not_the_request(seeded) -> None:
    """`updated_at` 은 응답 시각, `as_of` 는 **배치가 마지막으로 돈 날**이다.

    둘을 합치면 값이 며칠 스테일해도 최신처럼 보인다. 그래서 배치가 한 번도 안 돌면
    `as_of` 는 None 이어야 하고, 그때도 `updated_at` 은 채워져 있어야 한다.
    """
    empty = await calendar_service.get_calendar(seeded, days=7, limit=20, today=_TODAY)
    assert empty.as_of is None
    assert empty.updated_at

    await _fill(seeded)

    filled = await calendar_service.get_calendar(seeded, days=7, limit=20, today=_TODAY)
    # 배치가 방금 돌았으므로 KST 기준 **오늘**이다 — `today` 인자에서 오는 값이 아니다.
    # (그 인자는 조회 창의 기준이지 데이터의 신선도가 아니다. 둘이 같은 날일 수도
    # 있으므로 "다르다" 로는 검증할 수 없고, 출처가 배치 타임스탬프임을 직접 본다.)
    assert filled.as_of == datetime.now(KST).date().isoformat()


# ── 엔드포인트 ─────────────────────────────────────────────────────────────


async def test_endpoint_returns_empty_calendar_without_data(client, monkeypatch) -> None:
    """배치가 안 돌았어도 200 이다. 빈 목록은 오류가 아니다."""
    monkeypatch.setattr(calendar_service, "schedule_calendar_refresh", lambda: None)

    response = await client.get("/api/v1/markets/calendar")

    assert response.status_code == 200
    body = response.json()
    assert body["events"] == []
    assert body["days"] == 7


async def test_endpoint_never_triggers_a_live_fetch(client, monkeypatch) -> None:
    """요청이 수집(수십 초)을 기다리지 않는다 — 배경 배치로만 던진다."""
    scheduled: list[bool] = []
    monkeypatch.setattr(
        calendar_service, "schedule_calendar_refresh", lambda: scheduled.append(True)
    )

    await client.get("/api/v1/markets/calendar?days=3&limit=5")

    assert scheduled == [True]
