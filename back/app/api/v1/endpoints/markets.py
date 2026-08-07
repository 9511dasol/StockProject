"""시장 개요 엔드포인트 (명세 6.1)."""

from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import ListedCompanyRepo
from app.core.config import settings
from app.schemas.market import (
    CalendarKind,
    MarketCalendar,
    MarketMovers,
    MarketOverview,
    MarketRanking,
    RankingBoard,
    RankingSort,
)
from app.services import calendar_service, market_service

router = APIRouter(prefix="/markets", tags=["markets"])


@router.get("/overview", response_model=MarketOverview, summary="카테고리별 시장 개요")
async def get_market_overview(
    category: Annotated[str, Query()] = "index",
) -> MarketOverview:
    return await market_service.get_overview(category)


@router.get("/ranking", response_model=MarketRanking, summary="시가총액 · 등락률 랭킹")
async def get_market_ranking(
    repo: ListedCompanyRepo,
    sort: Annotated[RankingSort, Query()] = "market_cap",
    board: Annotated[RankingBoard, Query()] = "ALL",
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0, le=2000)] = 0,
) -> MarketRanking:
    """종목 탐색 화면용 목록. `/movers` 와 같은 스냅샷을 다르게 자른다.

    `/movers` 의 `limit` 상한을 올리지 않고 따로 둔 이유: movers 는 부호로 갈린 두
    목록이고 이쪽은 필터가 적용된 한 목록 + `total` 이라 응답 형태가 다르다.
    """
    return await market_service.get_ranking(
        repo, sort=sort, board=board, limit=limit, offset=offset
    )


@router.get("/movers", response_model=MarketMovers, summary="상승률 · 하락률 상위")
async def get_market_movers(
    limit: Annotated[int, Query(ge=1, le=20)] = 5,
) -> MarketMovers:
    """시가총액 상위 종목을 스캔해 만든 전일 대비 등락률 랭킹.

    항상 즉시 응답한다 — 스캔(수 초)은 배경에서 돌고 여기서는 최신 스냅샷만
    자른다. 스냅샷이 아직 없으면 `gainers`/`losers` 가 비어 나오므로, 호출부는
    빈 목록을 '데이터 없음'으로 다루면 된다.
    """
    return await market_service.get_movers(limit)


@router.get("/calendar", response_model=MarketCalendar, summary="오늘의 일정 (실적발표 · 배당락)")
async def get_market_calendar(
    repo: ListedCompanyRepo,
    kind: Annotated[CalendarKind | None, Query()] = None,
    days: Annotated[int | None, Query(ge=1, le=90)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> MarketCalendar:
    """오늘부터 `days` 일 안의 실적발표·배당락. `kind` 를 비우면 둘 다 섞어 날짜순이다.

    항상 즉시 응답한다 — 수집(수십 초)은 하루 1회 배경 배치가 하고 여기서는 적재된
    날짜를 읽을 뿐이다. 배치가 아직 한 바퀴 못 돌았으면 `covered`/`universe_size` 로
    진행률이 나가므로, 호출부는 빈 목록을 '데이터 없음'이 아니라 '아직 채우는 중'으로
    구분해 보여줄 수 있다.
    """
    calendar_service.schedule_calendar_refresh()
    return await calendar_service.get_calendar(
        repo,
        kind=kind,
        days=days if days is not None else settings.calendar_default_days,
        limit=limit,
    )
