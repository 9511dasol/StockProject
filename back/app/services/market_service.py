"""시장 개요 서비스 (명세 6.1)."""

import asyncio

from app.integrations.yfinance.market import fetch_market_overview
from app.schemas.market import MarketOverview


async def get_overview(category: str = "index") -> MarketOverview:
    return await asyncio.to_thread(fetch_market_overview, category)
