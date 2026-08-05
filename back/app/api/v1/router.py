"""v1 라우터 통합."""

from fastapi import APIRouter

from app.api.v1.endpoints import markets, stocks, watchlist

api_router = APIRouter()
api_router.include_router(stocks.router)
api_router.include_router(markets.router)
api_router.include_router(watchlist.router)
