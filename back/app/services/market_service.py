"""시장 개요 · 등락률 랭킹 서비스 (명세 6.1)."""

import asyncio
import logging
from datetime import UTC, datetime, timedelta

from app.core.config import settings
from app.integrations.yfinance.market import fetch_market_overview
from app.integrations.yfinance.movers import scan_movers
from app.repositories.listed_company import ListedCompanyRepository
from app.schemas.market import MarketMovers, MarketOverview, MoversScan
from app.schemas.stock import ListedCompanyRecord

logger = logging.getLogger(__name__)


async def get_overview(category: str = "index") -> MarketOverview:
    return await asyncio.to_thread(fetch_market_overview, category)


# ── 등락률 랭킹 스냅샷 ────────────────────────────────────────────────
# 스캔 한 번이 200종목 기준 약 7초다. 요청마다 돌 수 없고, 그렇다고 첫 요청을
# 7초 기다리게 할 수도 없다(프런트의 캐시 조회 타임아웃이 5초다). 그래서
# stale-while-revalidate: 만료된 스냅샷도 일단 그대로 내보내고 갱신은 배경으로
# 던진다. 시가총액 배치(`listed_company_service`)가 쓰는 방식과 같다.
#
# 프로세스 메모리에만 있다. 재시작하면 비고, 기동 시 warm-up 이 다시 채운다.
_scan: MoversScan | None = None
# 성공·실패와 무관한 '마지막 시도' 시각. 실패했을 때 이 값을 갱신하지 않으면
# 매 요청이 갱신을 예약해 실패를 계속 두드린다.
_scanned_at: datetime | None = None
_scan_lock = asyncio.Lock()
_refresh_task: asyncio.Task[None] | None = None


def _is_fresh() -> bool:
    if _scanned_at is None:
        return False
    return datetime.now(UTC) - _scanned_at < timedelta(
        seconds=settings.market_movers_ttl_seconds
    )


async def _load_universe(repo: ListedCompanyRepository) -> list[ListedCompanyRecord]:
    """스캔 모집단. 종목 목록을 코드에 박지 않고 KRX 수집 결과에서 뽑는다."""
    companies = await repo.top_by_market_cap(settings.market_movers_universe_size)
    return [
        ListedCompanyRecord(symbol=company.symbol, name=company.name, market=company.market)
        for company in companies
    ]


async def refresh_movers(repo: ListedCompanyRepository) -> MoversScan | None:
    """등락률 스냅샷을 다시 만든다. 실패하면 직전 스냅샷을 그대로 둔다."""
    global _scan, _scanned_at

    async with _scan_lock:
        # 락을 기다리는 동안 다른 요청이 이미 채웠을 수 있다.
        if _is_fresh():
            return _scan

        universe = await _load_universe(repo)
        if not universe:
            logger.info("등락률 스캔: 상장사 목록이 비어 있어 건너뜁니다")
            _scanned_at = datetime.now(UTC)
            return _scan

        label = f"시가총액 상위 {len(universe)}종목"
        try:
            scan = await asyncio.to_thread(scan_movers, universe, universe_label=label)
        except Exception:  # noqa: BLE001 - 랭킹 실패가 홈 화면을 죽이면 안 된다
            logger.exception("등락률 스캔 실패 — 직전 스냅샷을 유지합니다")
            _scanned_at = datetime.now(UTC)
            return _scan

        # 시도 시각은 결과와 무관하게 갱신한다 (실패 연타 방지).
        _scanned_at = datetime.now(UTC)
        if not scan.rows:
            logger.warning("등락률 스캔 결과가 비어 직전 스냅샷을 유지합니다")
            return _scan

        _scan = scan
        return scan


async def _refresh_in_new_session() -> None:
    """요청 세션은 응답과 함께 닫히므로 배경 갱신은 자기 세션을 연다."""
    from app.core.database import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        await refresh_movers(ListedCompanyRepository(session))


def _schedule_movers_refresh() -> None:
    """갱신을 배경 태스크로 띄운다. 이미 도는 중이면 아무것도 하지 않는다.

    태스크 참조를 모듈 변수로 잡아 두는 것은 GC 가 실행 중인 태스크를 수거하지
    못하게 하기 위함이다.
    """
    global _refresh_task

    if _refresh_task is not None and not _refresh_task.done():
        return
    _refresh_task = asyncio.create_task(_refresh_in_new_session())


def _to_response(scan: MoversScan | None, limit: int) -> MarketMovers:
    """스냅샷을 상승/하락 상위로 자른다.

    부호로 갈라 담는다 — 전 종목이 하락한 날 '상승률 상위'에 마이너스 종목이
    올라오면 그건 랭킹이 아니라 거짓말이다. 그런 날은 그쪽 목록이 짧아진다.
    """
    updated_at = (_scanned_at or datetime.now(UTC)).isoformat(timespec="seconds")
    if scan is None:
        return MarketMovers(updated_at=updated_at)

    gainers = [row for row in scan.rows if row.change_percent > 0][:limit]
    losers = [row for row in reversed(scan.rows) if row.change_percent < 0][:limit]

    return MarketMovers(
        as_of=scan.as_of,
        source=scan.source,
        universe_label=scan.universe_label,
        universe_size=scan.universe_size,
        scanned=len(scan.rows),
        gainers=gainers,
        losers=losers,
        updated_at=updated_at,
    )


async def get_movers(limit: int) -> MarketMovers:
    """상승률·하락률 상위. 만료됐으면 배경 갱신을 예약하고 즉시 응답한다.

    리포지토리를 받지 않는다 — 갱신은 배경 태스크가 자기 세션으로 하므로 요청
    세션과 무관하다. 스냅샷이 아직 없으면 빈 응답이고, 프런트는 그때 예시
    데이터로 내려간다 (기동 시 warm-up 이 이 창을 없앤다).
    """
    if not _is_fresh():
        _schedule_movers_refresh()

    return _to_response(_scan, limit)
