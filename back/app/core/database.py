"""비동기 SQLAlchemy 엔진 · 세션 · FastAPI 의존성."""

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.core.db_url import is_pooler, is_postgres, normalize_url


def _create_engine():
    """주 DB 엔진.

    로컬 SQLite 는 예전 그대로 만들고, Postgres 면 접속 문자열을 정규화해서 만든다
    (`core/db_url.py`). 정규화 없이 Supabase 풀러 URI 를 그대로 넘기면 `sslmode` 에서
    TypeError 가 나거나 프리페어드 스테이트먼트 충돌로 깨진다 — 붙여넣기만으로
    돌아가야 하는 값이라 그 처리를 여기서 흡수한다.
    """
    if not is_postgres(settings.database_url):
        return create_async_engine(
            settings.database_url, echo=settings.db_echo, pool_pre_ping=True
        )

    url, connect_args = normalize_url(settings.database_url)
    return create_async_engine(
        url,
        echo=settings.db_echo,
        # 풀러가 이미 커넥션을 관리한다. 여기서 또 풀을 잡으면 유휴 커넥션이 이중으로
        # 쌓여 Supabase 무료 티어의 연결 상한에 먼저 닿는다.
        poolclass=NullPool if is_pooler(settings.database_url) else None,
        pool_pre_ping=True,
        connect_args=connect_args,
    )


engine = _create_engine()

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncIterator[AsyncSession]:
    """요청 스코프 세션. 예외 시 롤백하고 종료 시 항상 닫는다."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


async def create_all() -> None:
    """개발 편의용 스키마 생성. 운영에서는 alembic을 사용한다."""
    from app.models.base import Base

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def dispose_engine() -> None:
    await engine.dispose()
