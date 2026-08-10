"""v1 라우터 통합."""

from fastapi import APIRouter

from app.api.v1.endpoints import admin, markets, profile, stocks, watchlist

api_router = APIRouter()
api_router.include_router(stocks.router)
api_router.include_router(markets.router)
api_router.include_router(watchlist.router)
api_router.include_router(profile.router)
# 관리자 라우터는 **전체가 X-Admin-Key 로 잠겨 있다** (endpoints/admin.py 모듈 주석).
api_router.include_router(admin.router)
