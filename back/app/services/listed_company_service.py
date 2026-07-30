"""상장사 목록 · 자동완성 서비스 (명세 6.2)."""

import logging

from app.core.config import settings
from app.integrations.krx.client import collect_listed_companies
from app.models.listed_company import ListedCompany
from app.repositories.listed_company import ListedCompanyRepository
from app.schemas.stock import StockSuggestion
from app.utils.text import get_initial_consonants, normalize_search_text

logger = logging.getLogger(__name__)

# 검색 결과 정렬 우선순위. 낮을수록 먼저 나온다.
_RANK_SYMBOL_PREFIX = 0
_RANK_NAME_PREFIX = 1
_RANK_INITIALS_PREFIX = 2
_RANK_NAME_CONTAINS = 3
_RANK_INITIALS_CONTAINS = 4
_RANK_NO_MATCH = 99


async def ensure_seeded(repo: ListedCompanyRepository) -> None:
    """저장된 상장사가 임계값보다 적으면 수집을 시도한다.

    첫 호출은 외부 수집 때문에 느릴 수 있다 — 프런트에서 스켈레톤과
    "목록 준비 중" 안내를 보여주는 근거가 이 지연이다 (와이어프레임 1d).
    """
    count = await repo.count()
    if count >= settings.listed_company_min_count:
        return

    logger.info(
        "상장사 %d건 저장됨 (임계값 %d) → 수집 시작", count, settings.listed_company_min_count
    )
    records = await collect_listed_companies()
    written = await repo.upsert_many(records)
    logger.info("상장사 %d건 반영 완료", written)


def _rank(company: ListedCompany, keyword: str, initials: str) -> tuple[int, str]:
    """(순위, 종목명) — 원본과 동일한 스코어링."""
    if keyword and company.search_symbol.startswith(keyword):
        return (_RANK_SYMBOL_PREFIX, company.name)
    if keyword and company.search_name.startswith(keyword):
        return (_RANK_NAME_PREFIX, company.name)
    if initials and company.initial_consonants.startswith(initials):
        return (_RANK_INITIALS_PREFIX, company.name)
    if keyword and keyword in company.search_name:
        return (_RANK_NAME_CONTAINS, company.name)
    if initials and initials in company.initial_consonants:
        return (_RANK_INITIALS_CONTAINS, company.name)
    return (_RANK_NO_MATCH, company.name)


async def search(
    repo: ListedCompanyRepository,
    query: str,
    limit: int,
) -> list[StockSuggestion]:
    """종목명 · 코드 · 초성 검색."""
    await ensure_seeded(repo)

    keyword = normalize_search_text(query)
    initials = get_initial_consonants(query)
    if not keyword and not initials:
        return []

    candidates = await repo.find_candidates(keyword, initials, settings.suggestion_candidate_limit)
    matches = [c for c in candidates if _rank(c, keyword, initials)[0] < _RANK_NO_MATCH]
    matches.sort(key=lambda c: _rank(c, keyword, initials))

    return [StockSuggestion.model_validate(company) for company in matches[:limit]]
