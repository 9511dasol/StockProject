"""상장사 영속성 계층. 여기서만 SQL을 작성한다."""

import logging
from collections.abc import Sequence
from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.listed_company import ListedCompany
from app.schemas.stock import ListedCompanyRecord
from app.utils.text import get_initial_consonants, normalize_search_text

logger = logging.getLogger(__name__)


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
