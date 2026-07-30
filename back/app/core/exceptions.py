"""도메인 예외와 FastAPI 예외 핸들러.

계층 규칙: 서비스·통합 계층은 `HTTPException`을 절대 던지지 않는다. 도메인 예외를
던지고, HTTP 상태 코드로의 변환은 여기 등록된 핸들러가 담당한다. 덕분에 서비스
계층을 FastAPI 없이도 테스트할 수 있다.
"""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


class AppError(Exception):
    """모든 도메인 예외의 베이스."""

    status_code: int = 500
    code: str = "internal_error"
    message: str = "요청을 처리하지 못했습니다."

    def __init__(self, message: str | None = None, *, detail: str | None = None) -> None:
        self.message = message or self.message
        self.detail = detail
        super().__init__(self.message)


class StockNotFoundError(AppError):
    status_code = 404
    code = "stock_not_found"
    message = "주가 데이터를 찾을 수 없습니다. 예: AAPL, MSFT, 005930.KS"


class UnsupportedTimeframeError(AppError):
    status_code = 400
    code = "unsupported_timeframe"
    message = "지원하지 않는 조회 단위입니다."


class UnsupportedPeriodError(AppError):
    status_code = 400
    code = "unsupported_period"
    message = "지원하지 않는 조회 기간입니다."


class InvalidDateRangeError(AppError):
    status_code = 400
    code = "invalid_date_range"
    message = "시작일은 종료일보다 늦을 수 없습니다."


class UnsupportedMarketCategoryError(AppError):
    status_code = 400
    code = "unsupported_market_category"
    message = "지원하지 않는 시장 구분입니다."


class MarketDataUnavailableError(AppError):
    status_code = 503
    code = "market_data_unavailable"
    message = "시장 데이터를 불러오지 못했습니다."


class ProviderUnavailableError(AppError):
    status_code = 503
    code = "provider_unavailable"
    message = "시세 공급자를 사용할 수 없습니다."


class LLMUnavailableError(AppError):
    """LLM 호출이 실패했고 규칙 기반 대체도 불가능한 경우."""

    status_code = 502
    code = "llm_unavailable"
    message = "AI 분석을 완료하지 못했습니다."


class LLMRefusedError(LLMUnavailableError):
    """안전 분류기가 요청을 거절한 경우 (`stop_reason == "refusal"`).

    HTTP 200으로 돌아오므로 SDK 예외가 아니다 — 응답을 읽기 전에 직접 검사해야 한다.
    """

    code = "llm_refused"
    message = "AI가 이 요청에 답변하지 않았습니다."


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        if exc.status_code >= 500:
            logger.error("%s: %s (detail=%s)", exc.code, exc.message, exc.detail)
        else:
            logger.info("%s: %s", exc.code, exc.message)
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.code, "message": exc.message}},
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "validation_error",
                    "message": "요청 값을 확인해주세요.",
                    "fields": exc.errors(),
                }
            },
        )
