"""종목 엔드포인트 (명세 6.2 / 6.3 / 6.4).

라우터는 파라미터 수신과 서비스 호출만 한다 — 비즈니스 로직은 서비스 계층에 있다.
"""

from collections.abc import AsyncIterator
from datetime import date
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.api.deps import AdviceKeyGuard, ListedCompanyRepo
from app.schemas.advice import StockAdviceRequest, StockAdviceResponse
from app.schemas.stock import (
    ListedCompaniesStatus,
    StockContent,
    StockFundamentals,
    StockHistory,
    StockHistoryParams,
    StockSuggestion,
)
from app.services import (
    advice_cache,
    advice_service,
    advice_stream,
    fundamentals_service,
    listed_company_service,
    stock_service,
)

router = APIRouter(prefix="/stocks", tags=["stocks"])


@router.get("/history", response_model=StockHistory, summary="주가 히스토리 + 보조지표")
async def get_stock_history(
    repo: ListedCompanyRepo,
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
    # 공급자를 부르기 전에 KRX 목록에서 심볼·상호를 확정한다. 6자리 코드만 넘기면
    # `.KS`/`.KQ` 를 추측하게 되는데, 야후는 틀린 접미사에도 응답을 준다 —
    # 247540(에코프로비엠, 코스닥)을 `.KS` 로 물으면 하루 늦은 시세와
    # `"247540.KS,0P0001GZPV,623889"` 라는 이름이 돌아온다.
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
        listing=await listed_company_service.resolve_listing(repo, symbol),
    )


@router.get("/content", response_model=StockContent, summary="종목 뉴스 · 애널리스트 리포트")
async def get_stock_content(
    symbol: Annotated[str, Query(min_length=1, max_length=80)],
) -> StockContent:
    """`/stocks/history` 응답의 `symbol`을 그대로 넘긴다 (이미 해석된 심볼)."""
    return await stock_service.get_content(symbol)


@router.get("/fundamentals", response_model=StockFundamentals, summary="재무 · 밸류에이션")
async def get_stock_fundamentals(
    symbol: Annotated[str, Query(min_length=1, max_length=80)],
) -> StockFundamentals:
    """`/stocks/history` 응답의 `symbol`을 그대로 넘긴다 (이미 해석된 심볼).

    항목별 실패는 `null`로 흡수한다 — 전 필드가 `null`이어도 200이다.
    종목당 캐시가 있어 두 번째 호출부터는 즉시 응답한다.
    """
    return await fundamentals_service.get_fundamentals(symbol)


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


@router.get(
    "/listed-companies",
    response_model=ListedCompaniesStatus,
    summary="상장사 목록 준비 상태",
)
async def get_listed_companies_status(repo: ListedCompanyRepo) -> ListedCompaniesStatus:
    """첫 자동완성 지연 배너가 폴링한다. 수집을 유발하지 않고 상태만 읽는다."""
    return await listed_company_service.get_status(repo)


@router.post("/advice", response_model=StockAdviceResponse, summary="AI 멀티 에이전트 판단")
async def create_stock_advice(
    repo: ListedCompanyRepo, payload: StockAdviceRequest, _: AdviceKeyGuard = None
) -> StockAdviceResponse:
    listing = await listed_company_service.resolve_listing(repo, payload.symbol)
    try:
        async with advice_cache.reserve_slot():
            return await advice_service.generate_advice(payload.symbol, listing=listing)
    except advice_cache.AdviceBusyError as exc:
        raise _busy(exc) from exc


@router.post(
    "/advice/stream",
    summary="AI 멀티 에이전트 판단 (SSE 스트리밍)",
    response_class=StreamingResponse,
)
async def stream_stock_advice(
    repo: ListedCompanyRepo, payload: StockAdviceRequest, _: AdviceKeyGuard = None
) -> StreamingResponse:
    """`/advice`와 같은 결과를 4단계로 나눠 흘린다.

    종목당 LLM 4회라 완료까지 수십 초가 걸린다 — 진행 단계를 보여주려면
    스트리밍이 필요하다. 응답 본문은 `AdviceStreamEvent` JSON 한 줄씩이다.
    """
    # 스트림이 열리기 전에 읽어 값으로 넘긴다 — 제너레이터 안에서 DB를 만지면
    # 수십 초 동안 세션이 붙잡힌다.
    listing = await listed_company_service.resolve_listing(repo, payload.symbol)

    # 슬롯도 스트림을 열기 **전에** 잡는다. 제너레이터 안에서 잡으면 상한 초과를
    # 알릴 때 이미 200 + text/event-stream 헤더가 나간 뒤라, 클라이언트는 429 대신
    # "빈 스트림"을 받는다 — 거절인지 장애인지 구분할 수 없다.
    try:
        advice_cache.reserve_slot_now()
    except advice_cache.AdviceBusyError as exc:
        raise _busy(exc) from exc

    async def events() -> AsyncIterator[bytes]:
        try:
            async for event in advice_stream.stream_advice(
                payload.symbol, listing=listing
            ):
                yield f"data: {event.model_dump_json()}\n\n".encode()
        finally:
            # 소비자가 중간에 끊어도(GeneratorExit) 반드시 반납한다. 안 그러면
            # 사용자가 드로어를 몇 번 여닫는 것만으로 상한이 영구히 차 버린다.
            advice_cache.release_slot()

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            # nginx 등 리버스 프록시가 SSE를 버퍼링하지 않도록.
            "X-Accel-Buffering": "no",
        },
    )


def _busy(exc: Exception) -> HTTPException:
    """동시 실행 상한 초과 → 429.

    503(일시적 장애)이 아니라 429(요청이 너무 많음)인 이유: 서버는 멀쩡하고, 잠시 뒤
    다시 보내면 되는 상황이라는 뜻이 정확하다. `Retry-After` 로 그 '잠시'를 명시한다.
    """
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=str(exc),
        headers={"Retry-After": "20"},
    )
