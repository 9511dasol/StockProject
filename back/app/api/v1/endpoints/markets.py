"""시장 개요 엔드포인트 (명세 6.1)."""

from typing import Annotated

from fastapi import APIRouter, Query

from app.schemas.market import MarketOverview
from app.services import market_service

router = APIRouter(prefix="/markets", tags=["markets"])


@router.get("/overview", response_model=MarketOverview, summary="카테고리별 시장 개요")
async def get_market_overview(
    category: Annotated[str, Query()] = "index",
) -> MarketOverview:
    return await market_service.get_overview(category)
