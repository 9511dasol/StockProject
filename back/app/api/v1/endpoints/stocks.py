"""종목 엔드포인트 (명세 6.2 / 6.3 / 6.4).

라우터는 파라미터 수신과 서비스 호출만 한다 — 비즈니스 로직은 서비스 계층에 있다.
"""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import ListedCompanyRepo
from app.schemas.advice import StockAdviceRequest, StockAdviceResponse
from app.schemas.stock import StockContent, StockHistory, StockHistoryParams, StockSuggestion
from app.services import advice_service, listed_company_service, stock_service

router = APIRouter(prefix="/stocks", tags=["stocks"])


@router.get("/history", response_model=StockHistory, summary="주가 히스토리 + 보조지표")
async def get_stock_history(
    symbol: Annotated[str, Query(min_length=1, max_length=80)],
    timeframe: Annotated[str, Query()] = "day",
    period: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=5000)] = 504,
    start_date: Annotated[date | None, Query()] = None,
    end_date: Annotated[date | None, Query()] = None,
    include_content: Annotated[
        bool,
        Query(
            description=(
                "뉴스·리포트를 함께 담을지. false면 응답이 20배 가까이 빨라진다"
                " (뉴스·리포트가 소요 시간의 약 95%). 차트만 먼저 그릴 때 쓴다."
            )
        ),
    ] = True,
) -> StockHistory:
    return await stock_service.get_history(
        StockHistoryParams(
            symbol=symbol,
            timeframe=timeframe,
            period=period,
            limit=limit,
            start_date=start_date,
            end_date=end_date,
        ),
        include_content=include_content,
    )


@router.get("/content", response_model=StockContent, summary="종목 뉴스 · 애널리스트 리포트")
async def get_stock_content(
    symbol: Annotated[str, Query(min_length=1, max_length=80)],
) -> StockContent:
    """`/stocks/history` 응답의 `symbol`을 그대로 넘긴다 (이미 해석된 심볼)."""
    return await stock_service.get_content(symbol)


@router.get(
    "/suggestions",
    response_model=list[StockSuggestion],
    summary="종목명 · 코드 · 초성 자동완성",
)
async def get_stock_suggestions(
    repo: ListedCompanyRepo,
    query: Annotated[str, Query(min_length=1)],
    limit: Annotated[int, Query(ge=1, le=10)] = 5,
) -> list[StockSuggestion]:
    return await listed_company_service.search(repo, query, limit)


@router.post("/advice", response_model=StockAdviceResponse, summary="AI 멀티 에이전트 판단")
async def create_stock_advice(payload: StockAdviceRequest) -> StockAdviceResponse:
    return await advice_service.generate_advice(payload.symbol)
