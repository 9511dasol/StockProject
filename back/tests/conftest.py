"""테스트 픽스처. 인메모리 SQLite를 쓰고 외부 호출은 하지 않는다."""

from collections.abc import AsyncIterator, Iterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api.deps import get_listed_company_repository
from app.core.database import get_db
from app.main import create_app
from app.models.base import Base
from app.repositories.listed_company import ListedCompanyRepository
from app.services import fundamentals_service


@pytest.fixture(autouse=True)
def reset_fundamentals_cache() -> Iterator[None]:
    """재무 캐시는 모듈 전역이라 테스트 사이로 샌다 — 매번 비운다."""
    fundamentals_service._cache.clear()
    fundamentals_service._locks.clear()
    yield
    fundamentals_service._cache.clear()
    fundamentals_service._locks.clear()


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    await engine.dispose()


@pytest.fixture
def repo(db_session: AsyncSession) -> ListedCompanyRepository:
    return ListedCompanyRepository(db_session)


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncIterator[AsyncClient]:
    """스키마 자동 생성과 실제 DB를 끄고, 테스트 세션을 주입한 앱."""
    app = create_app()

    async def override_db() -> AsyncIterator[AsyncSession]:
        yield db_session

    def override_repo() -> ListedCompanyRepository:
        return ListedCompanyRepository(db_session)

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_listed_company_repository] = override_repo

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as async_client:
        yield async_client
