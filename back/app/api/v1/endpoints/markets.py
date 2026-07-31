"""시장 개요 엔드포인트 (명세 6.1)."""

from typing import Annotated

from fastapi import APIRouter, Query

from app.schemas.market import MarketMovers, MarketOverview
from app.services import market_service

router = APIRouter(prefix="/markets", tags=["markets"])


@router.get("/overview", response_model=MarketOverview, summary="카테고리별 시장 개요")
async def get_market_overview(
    category: Annotated[str, Query()] = "index",
) -> MarketOverview:
    return await market_service.get_overview(category)


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
