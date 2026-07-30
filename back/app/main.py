"""FastAPI 애플리케이션 조립. 라우팅·설정·수명주기만 담당한다."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import create_all, dispose_engine
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging
from app.integrations.llm import close_client

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    configure_logging()
    if settings.db_create_all_on_startup:
        await create_all()
    logger.info("%s 시작 (model=%s)", settings.app_name, settings.anthropic_model)

    yield

    await close_client()
    await dispose_engine()
    logger.info("%s 종료", settings.app_name)


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        debug=settings.debug,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)
    app.include_router(api_router, prefix=settings.api_v1_prefix)

    @app.get("/health", tags=["meta"], summary="헬스체크")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
