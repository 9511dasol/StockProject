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

    async def latest_market_cap_update(self) -> datetime | None:
        """가장 최근 시총 갱신 시각. 하루 1회 배치의 TTL 판단에 쓴다."""
        result = await self._db.execute(
            select(func.max(ListedCompany.market_cap_updated_at))
        )
        value = result.scalar_one_or_none()
        if value is None:
            return None
        # SQLite 는 tz 정보를 잃어버린다 — 비교 전에 UTC 로 되살린다.
        return value if value.tzinfo else value.replace(tzinfo=UTC)

    async def symbols_without_market_cap(self, limit: int) -> list[str]:
        """아직 시총이 없는 종목 심볼. yfinance 폴백이 한 번에 처리할 만큼만 가져온다.

        KOSPI 를 먼저 채운다 — 대형주가 몰려 있어 랭킹 개선 효과가 가장 크다.
        """
        stmt = (
            select(ListedCompany.symbol)
            .where(ListedCompany.market_cap.is_(None))
            .order_by((ListedCompany.market == "KOSPI").desc(), ListedCompany.symbol)
            .limit(limit)
        )
        result = await self._db.execute(stmt)
        return list(result.scalars().all())

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
