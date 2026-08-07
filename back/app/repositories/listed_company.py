"""상장사 영속성 계층. 여기서만 SQL을 작성한다."""

import logging
from collections.abc import Mapping, Sequence
from datetime import UTC, date, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.listed_company import ListedCompany
from app.schemas.stock import CalendarDates, ListedCompanyRecord
from app.utils.text import get_initial_consonants, normalize_search_text

logger = logging.getLogger(__name__)

#: 일정 조회가 허용하는 컬럼. 호출자가 넘긴 문자열을 SQL 에 그대로 넣지 않기 위한 관문이다.
_CALENDAR_COLUMNS = {
    "next_earnings_date": ListedCompany.next_earnings_date,
    "ex_dividend_date": ListedCompany.ex_dividend_date,
}


def _as_date(value: str | None) -> date | None:
    """`'2026-10-28'` → `date`. 비었거나 형식이 다르면 None.

    `repositories/document_chunk._as_date` 와 같은 이유로 문자열을 그대로 넘기지
    않는다 — 컬럼이 `Date` 라 드라이버가 date 를 기대하고, 문자열은 바인딩에서 터진다.
    형식이 이상한 값 하나가 배치 전체를 죽이지 않도록 예외 대신 None 이다.
    """
    text = (value or "").strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        logger.debug("일정 날짜를 읽지 못했습니다: %r", value)
        return None


class ListedCompanyRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def count(self) -> int:
        result = await self._db.execute(select(func.count()).select_from(ListedCompany))
        return result.scalar_one()

    async def find_by_code(self, code: str) -> ListedCompany | None:
        """6자리 코드로 상장사 한 건. 저장된 심볼은 `247540.KQ` 형태라 접두 매칭한다.

        `search_symbol`이 아니라 `symbol`을 보는 이유: 코드는 이미 정규화된
        숫자열이라 검색용 사본을 거칠 이유가 없고, `symbol`에는 unique 인덱스가 있다.
        """
        if not code:
            return None

        stmt = (
            select(ListedCompany)
            .where(or_(ListedCompany.symbol == code, ListedCompany.symbol.like(f"{code}.%")))
            .limit(1)
        )
        result = await self._db.execute(stmt)
        return result.scalars().first()

    async def find_by_symbols(self, symbols: Sequence[str]) -> Sequence[ListedCompany]:
        """여러 심볼을 한 번에. 관심종목처럼 목록 전체의 상호가 필요할 때 쓴다.

        `find_by_code` 를 N번 도는 대신 IN 하나로 끝낸다 — 관심종목 상한이 200이라
        최악의 경우 쿼리 200개가 왕복한다. 호출부가 순서를 정하므로 정렬은 하지 않는다.
        """
        if not symbols:
            return []

        stmt = select(ListedCompany).where(ListedCompany.symbol.in_(list(symbols)))
        result = await self._db.execute(stmt)
        return result.scalars().all()

    async def find_candidates(
        self,
        keyword: str,
        initials: str,
        candidate_limit: int,
    ) -> Sequence[ListedCompany]:
        """키워드/초성에 걸릴 가능성이 있는 행만 SQL로 좁혀 가져온다.

        순위 계산은 파이썬에서 하지만(원본과 동일한 스코어링), 후보 집합을 SQL로 줄여
        전체 테이블을 ORM 객체로 적재하지 않는다. `candidate_limit`에 걸리면 경고를
        남긴다 — 조용히 잘리면 "다 봤다"로 오해되기 때문이다.
        """
        conditions = []
        if keyword:
            conditions += [
                ListedCompany.search_symbol.like(f"{keyword}%"),
                ListedCompany.search_name.like(f"%{keyword}%"),
            ]
        if initials:
            conditions.append(ListedCompany.initial_consonants.like(f"%{initials}%"))

        if not conditions:
            return []

        stmt = select(ListedCompany).where(or_(*conditions)).limit(candidate_limit + 1)
        result = await self._db.execute(stmt)
        companies = result.scalars().all()

        if len(companies) > candidate_limit:
            logger.warning(
                "자동완성 후보가 상한(%d)을 초과해 잘렸습니다 (keyword=%r, initials=%r)",
                candidate_limit,
                keyword,
                initials,
            )
            return companies[:candidate_limit]

        return companies

    async def top_by_market_cap(self, limit: int) -> Sequence[ListedCompany]:
        """등락률 스캔의 모집단. 시가총액 상위부터, 큰 값 먼저.

        `.KS`/`.KQ` 가 붙은 행만 남긴다 — 접미사 없는 행(수집 원본이 깨진 44건)은
        yfinance 심볼로 쓸 수 없어 스캔 자리만 낭비한다.

        **`nullslast()` 가 반드시 있어야 한다.** 예전에는 없었고, 주석은 "SQLite 는
        NULL 을 가장 작은 값으로 보므로 DESC 에서 뒤로 밀린다" 고 적혀 있었다.
        그 전제는 Postgres 에서 **정반대**다 — `DESC` 의 기본이 `NULLS FIRST` 라
        시총이 아직 없는 종목이 모집단 맨 앞을 채웠다. 배치가 덜 돈 상태에서 랭킹이
        조용히 빈 종목으로 채워지는, 오류 없이 틀리는 종류의 버그였다.
        """
        stmt = (
            select(ListedCompany)
            .where(
                or_(
                    ListedCompany.symbol.like("%.KS"),
                    ListedCompany.symbol.like("%.KQ"),
                )
            )
            .order_by(ListedCompany.market_cap.desc().nullslast(), ListedCompany.symbol)
            .limit(limit)
        )
        result = await self._db.execute(stmt)
        return result.scalars().all()

    async def latest_market_cap_update(self) -> datetime | None:
        """가장 최근 시총 갱신 시각. 하루 1회 배치의 TTL 판단에 쓴다."""
        result = await self._db.execute(
            select(func.max(ListedCompany.market_cap_updated_at))
        )
        value = result.scalar_one_or_none()
        if value is None:
            return None
        # Postgres 의 timestamptz 는 tz 를 실어 오므로 대개 그대로 통과한다.
        # 방어를 남겨 두는 이유는 naive 값 하나가 들어오면 아래 비교가 TypeError 로
        # 배치를 통째로 세우기 때문이다 — 되살리는 비용이 그 위험보다 싸다.
        return value if value.tzinfo else value.replace(tzinfo=UTC)

    async def symbols_without_market_cap(self, limit: int) -> list[str]:
        """아직 시총이 없는 종목 심볼. yfinance 폴백이 한 번에 처리할 만큼만 가져온다.

        KOSPI 를 먼저 채운다 — 대형주가 몰려 있어 랭킹 개선 효과가 가장 크다.

        **`market == "KOSPI"` 로 정렬하면 안 된다.** 그 컬럼의 실제 값은 한글이고
        (실측: 코스닥 1806 · 유가 833 · 코넥스 109) `KOSPI` 문자열은 **0건**이라,
        이 비교는 모든 행에서 거짓이 된다 — 정렬 항이 통째로 죽어 심볼 오름차순만
        남는다. 조용히 틀리는 종류라 오래 살아남았다: 배치는 정상 동작하고 채우는
        순서만 무작위에 가까웠다.

        대신 심볼 접미사를 쓴다. `krx_symbol_to_yfinance` 가 시장 구분을 보고 붙인
        값이고 **실제로 공급자에게 물어본 심볼 그 자체**라 그 행과 어긋날 수 없다
        (`domain/symbols.board_of` 주석과 같은 근거).
        """
        stmt = (
            select(ListedCompany.symbol)
            .where(ListedCompany.market_cap.is_(None))
            .order_by(ListedCompany.symbol.like("%.KS").desc(), ListedCompany.symbol)
            .limit(limit)
        )
        result = await self._db.execute(stmt)
        symbols = list(result.scalars().all())

        # 정렬이 살아 있는지 결과로 확인한다.
        #
        # 이 정렬은 **죽어도 오류가 안 난다** — 실제로 그렇게 오래 살아 있었다.
        # 배치는 정상 동작하고 채우는 순서만 무작위가 되므로, "우선순위가 먹었는가" 를
        # 사람이 눈으로 볼 방법이 없었다. 한 번 물어보는 비용이 그 침묵보다 싸다.
        if symbols and not any(s.endswith(".KS") for s in symbols):
            remaining = await self._count_missing_cap_kospi()
            if remaining:
                logger.warning(
                    "시총 배치 %d건에 .KS 가 하나도 없는데 아직 %d종목 남아 있습니다 — "
                    "우선순위 정렬이 죽었을 수 있습니다",
                    len(symbols),
                    remaining,
                )

        return symbols

    async def _count_missing_cap_kospi(self) -> int:
        """시총이 아직 없는 유가증권 종목 수. 위 경보의 근거로만 쓴다."""
        stmt = (
            select(func.count())
            .select_from(ListedCompany)
            .where(
                ListedCompany.market_cap.is_(None),
                ListedCompany.symbol.like("%.KS"),
            )
        )
        return int((await self._db.execute(stmt)).scalar_one())

    async def update_market_caps(self, caps: dict[str, int]) -> int:
        """6자리 코드 → 시총 매핑을 반영한다. 반영된 행 수를 돌려준다.

        pykrx 는 접미사 없는 6자리 코드를 주고 저장된 심볼은 `005930.KS` 이므로
        접미사를 떼고 맞춘다. 매칭되지 않는 종목(해외·신규 상장)은 그대로 NULL 로 둔다.
        """
        if not caps:
            return 0

        now = datetime.now(UTC)
        result = await self._db.execute(select(ListedCompany))
        updated = 0

        for company in result.scalars().all():
            code = company.symbol.split(".", 1)[0]
            cap = caps.get(code)
            if cap is None:
                continue
            company.market_cap = cap
            company.market_cap_updated_at = now
            updated += 1

        await self._db.commit()

        # 받은 것이 있는데 한 건도 못 붙였다면 코드 형식이 어긋난 것이다.
        #
        # pykrx 가 `005930` 을 주고 우리가 `005930.KS` 를 저장한다는 전제가 이 매칭의
        # 전부다. 공급자가 형식을 바꾸면(접미사를 붙여 준다든가) 조용히 0건이 되고,
        # 배치는 "성공" 으로 끝난 채 시총이 영원히 안 채워진다.
        if not updated:
            logger.warning(
                "시총 %d건을 받았지만 한 종목도 매칭되지 않았습니다 — "
                "공급자 코드 형식이 바뀌었을 수 있습니다 (예: %s)",
                len(caps),
                next(iter(caps)),
            )

        return updated

    # --- 오늘의 일정 (실적발표 · 배당락) --------------------------------------

    async def latest_calendar_update(self) -> datetime | None:
        """가장 최근 일정 갱신 시각. 하루 1회 배치의 TTL 판단에 쓴다."""
        result = await self._db.execute(select(func.max(ListedCompany.calendar_updated_at)))
        value = result.scalar_one_or_none()
        if value is None:
            return None
        # `latest_market_cap_update` 와 같은 방어다 — naive 값 하나가 들어오면
        # 호출부의 비교가 TypeError 로 배치를 통째로 세운다.
        return value if value.tzinfo else value.replace(tzinfo=UTC)

    async def symbols_for_calendar_refresh(self, limit: int) -> list[str]:
        """이번 배치가 물어볼 종목. **가장 오래 안 물어본 순**으로 고른다.

        종목당 1회 호출(~1초)이라 전 종목(2,700+)을 한 번에 돌 수 없다. 그래서 시총
        배치처럼 며칠에 걸쳐 채우는데, 시총과 다른 점이 하나 있다: **일정은 만료된다.**
        실적발표일이 지나면 그 값은 과거를 가리키므로 다시 물어봐야 한다. 그래서
        "아직 없는 것" 이 아니라 "가장 오래된 것" 이 기준이다.

        `nullsfirst()` 가 여기서는 **맞다.** 한 번도 안 물어본 종목(NULL)이 가장 오래된
        것이므로 맨 앞이어야 한다 — `top_by_market_cap` 의 `nullslast()` 와 방향이
        반대인 이유는 거기서는 NULL 이 "값 없음"(뒤로)이고 여기서는 "가장 오래됨"(앞으로)
        이기 때문이다. 둘 다 **명시**한다는 것이 규칙이고, 방향은 뜻이 정한다.

        모집단은 `.KS`/`.KQ` 로 제한한다. 접미사 없는 행은 yfinance 심볼로 쓸 수 없어
        물어봐야 빈손이고 배치 자리만 낭비한다 (`top_by_market_cap` 과 같은 근거).

        ## 같은 시각끼리는 무엇으로 가르나 — 신호 셋을 순서대로

        전 종목이 한 번도 안 물어본 상태(전부 NULL)면 첫 항이 통째로 동점이라 **그
        아래가 실제 순서를 정한다.** 그래서 세 겹을 둔다.

        1. `market_cap desc nullslast` — 있으면 이게 가장 좋은 신호다
        2. `.KS` 먼저 — **시총이 비어 있을 때 실제로 일하는 항이다.** 실측으로 이 DB 는
           2,747건 전부 `market_cap` 이 NULL 이었고(시총 배치가 성공한 적이 없다),
           그 상태에서 1번만 있으면 정렬이 사실상 임의가 된다 — 배치가 무명 종목부터
           채워 홈 화면이 2주 동안 엉뚱한 이름만 보여준다. `symbols_without_market_cap`
           이 같은 이유로 같은 항을 쓴다
        3. `symbol` — 순서를 **결정적으로** 만든다. 없으면 동점 구간이 물리적 행 순서라
           실행마다 달라지고, "왜 이 종목이 먼저인가" 를 설명할 수 없다
        """
        stmt = (
            select(ListedCompany.symbol)
            .where(
                or_(
                    ListedCompany.symbol.like("%.KS"),
                    ListedCompany.symbol.like("%.KQ"),
                )
            )
            .order_by(
                ListedCompany.calendar_updated_at.asc().nullsfirst(),
                ListedCompany.market_cap.desc().nullslast(),
                ListedCompany.symbol.like("%.KS").desc(),
                ListedCompany.symbol,
            )
            .limit(limit)
        )
        result = await self._db.execute(stmt)
        return list(result.scalars().all())

    async def update_calendar_dates(
        self, dates: Mapping[str, CalendarDates], asked: Sequence[str]
    ) -> int:
        """일정을 반영한다. 날짜를 얻은 종목 수를 돌려준다.

        **`asked` 전체에 `calendar_updated_at` 을 찍는다.** 값을 못 받은 종목까지다.
        그러지 않으면 일정이 없는 종목(배당을 안 하거나 발표일이 안 잡힌 곳 — 다수다)이
        `nullsfirst` 정렬의 맨 앞에 영원히 남아, 배치가 같은 종목만 반복해서 물어보고
        나머지는 한 번도 못 채운다. 조용히 제자리를 도는 종류라 로그로도 안 보인다.

        날짜를 **덮어쓰는** 것도 의도다. 실적발표가 끝나면 공급자가 다음 분기 날짜를
        주고, 그때 값이 바뀌어야 '오늘의 일정' 이 과거를 가리키지 않는다. 새 값이
        없어졌으면(`None`) 그것도 그대로 반영한다 — 취소된 일정을 남겨 두면 안 된다.
        """
        if not asked:
            return 0

        now = datetime.now(UTC)
        result = await self._db.execute(
            select(ListedCompany).where(ListedCompany.symbol.in_(list(asked)))
        )

        filled = 0
        for company in result.scalars().all():
            value = dates.get(company.symbol)
            company.ex_dividend_date = _as_date(value.ex_dividend_date) if value else None
            company.next_earnings_date = _as_date(value.next_earnings_date) if value else None
            company.calendar_updated_at = now
            if company.ex_dividend_date or company.next_earnings_date:
                filled += 1

        await self._db.commit()
        return filled

    async def calendar_coverage(self) -> tuple[int, int]:
        """`(일정을 한 번이라도 받은 종목 수, 배치 모집단 크기)`.

        화면이 "아직 채우는 중" 을 말할 근거다. 분모는 전 종목이 아니라 배치가 실제로
        물어보는 모집단(`.KS`/`.KQ`)이다 — 접미사 없는 행을 분모에 넣으면 진행률이
        영원히 100%에 닿지 않는다.
        """
        board_filter = or_(
            ListedCompany.symbol.like("%.KS"), ListedCompany.symbol.like("%.KQ")
        )
        total = int(
            (
                await self._db.execute(
                    select(func.count()).select_from(ListedCompany).where(board_filter)
                )
            ).scalar_one()
        )
        covered = int(
            (
                await self._db.execute(
                    select(func.count())
                    .select_from(ListedCompany)
                    .where(
                        board_filter,
                        or_(
                            ListedCompany.next_earnings_date.is_not(None),
                            ListedCompany.ex_dividend_date.is_not(None),
                        ),
                    )
                )
            ).scalar_one()
        )
        return covered, total

    async def upcoming_calendar(
        self, column: str, start: date, end: date, limit: int
    ) -> Sequence[ListedCompany]:
        """`[start, end]` 안에 해당 일정이 있는 종목. 날짜 오름차순, 같은 날은 시총 큰 순.

        `column` 은 `"next_earnings_date"` 또는 `"ex_dividend_date"` 다. 문자열로 받는
        이유는 두 컬럼의 쿼리가 완전히 같아서인데, **호출자가 넘긴 문자열을 그대로 SQL 에
        넣지 않는다** — 아래 매핑에 없는 값은 거부한다.

        `nullslast()` 가 없다. 여기서는 `between` 이 NULL 을 이미 걸러내므로 정렬에
        NULL 이 도달할 수 없다 — `test_postgres_dialect` 의 규칙 검사기가 이 자리를
        지적하지 않는 것도 그 때문이다(그 검사기는 `DESC` 정렬만 본다).
        시총 정렬에는 `nullslast()` 를 붙인다. 그쪽은 진짜로 NULL 이 섞인다.
        """
        target = _CALENDAR_COLUMNS.get(column)
        if target is None:
            raise ValueError(f"알 수 없는 일정 컬럼: {column!r}")

        stmt = (
            select(ListedCompany)
            .where(target.between(start, end))
            .order_by(target.asc(), ListedCompany.market_cap.desc().nullslast())
            .limit(limit)
        )
        result = await self._db.execute(stmt)
        return result.scalars().all()

    async def count_upcoming_calendar(self, column: str, start: date, end: date) -> int:
        """위 조회의 전체 건수. `limit` 으로 잘리기 전 숫자다."""
        target = _CALENDAR_COLUMNS.get(column)
        if target is None:
            raise ValueError(f"알 수 없는 일정 컬럼: {column!r}")

        stmt = (
            select(func.count())
            .select_from(ListedCompany)
            .where(target.between(start, end))
        )
        return int((await self._db.execute(stmt)).scalar_one())

    async def upsert_many(self, records: Sequence[ListedCompanyRecord]) -> int:
        """심볼 기준 upsert. 중복 심볼은 첫 건만 반영한다."""
        existing_result = await self._db.execute(select(ListedCompany))
        existing_by_symbol = {row.symbol: row for row in existing_result.scalars().all()}

        seen: set[str] = set()
        written = 0

        for record in records:
            if record.symbol in seen:
                continue
            seen.add(record.symbol)

            search_symbol = normalize_search_text(record.symbol)
            search_name = normalize_search_text(record.name)
            initials = record.initial_consonants or get_initial_consonants(record.name)

            company = existing_by_symbol.get(record.symbol)
            if company is None:
                self._db.add(
                    ListedCompany(
                        symbol=record.symbol,
                        name=record.name,
                        market=record.market,
                        search_symbol=search_symbol,
                        search_name=search_name,
                        initial_consonants=initials,
                    )
                )
            else:
                company.name = record.name
                company.market = record.market
                company.search_symbol = search_symbol
                company.search_name = search_name
                company.initial_consonants = initials
            written += 1

        await self._db.commit()
        return written
