"""테스트 픽스처. 인메모리 SQLite를 쓰고 외부 호출은 하지 않는다."""

from collections.abc import AsyncIterator, Iterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api.deps import get_listed_company_repository
from app.core.config import settings
from app.core.database import get_db
from app.main import create_app
from app.models.base import Base
from app.repositories.listed_company import ListedCompanyRepository
from app.services import advice_cache, fundamentals_service


@pytest.fixture(autouse=True)
def reset_fundamentals_cache() -> Iterator[None]:
    """재무 캐시는 모듈 전역이라 테스트 사이로 샌다 — 매번 비운다."""
    fundamentals_service._cache.clear()
    fundamentals_service._locks.clear()
    yield
    fundamentals_service._cache.clear()
    fundamentals_service._locks.clear()


@pytest.fixture(autouse=True)
def rag_off_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    """테스트는 기본적으로 RAG 를 끈다 — **실제 벡터 DB 를 치지 않게 한다.**

    `vector_database_dsn` 이 `VECTOR_DATABASE_URL` 이 없을 때 주 DB 로 폴백하면서,
    개발자 `.env` 의 Supabase 주소가 그대로 테스트에 새어 들어왔다. 실제로 한 테스트가
    **닿지 않는 DB 덕분에** 통과하고 있었고(연결 실패 → 문서 0건), 주소를 고쳐 DB 가
    살아나는 순간 실패로 바뀌었다 — 그때까지 그 테스트는 아무것도 검증하지 않았다.

    RAG 를 쓰는 테스트는 `vector_database_url` 을 직접 설정해 **명시적으로 켠다.**
    """
    monkeypatch.setattr(settings, "vector_database_url", None)
    monkeypatch.setattr(settings, "database_url", "sqlite+aiosqlite:///:memory:")


@pytest.fixture(autouse=True)
def reset_advice_cache() -> Iterator[None]:
    """AI 판단 캐시도 모듈 전역이다.

    비우지 않으면 **한 테스트가 다른 테스트를 통과시킨다** — 앞 테스트가 넣어 둔
    판단을 뒤 테스트가 캐시에서 받아 LLM 대역을 한 번도 안 부르고 초록이 된다.
    동시 실행 카운터도 함께 되돌린다: 429 를 확인하는 테스트가 상한을 채운 채
    끝나면 그 뒤 advice 테스트가 전부 429 가 된다.
    """
    advice_cache.reset_for_tests()
    yield
    advice_cache.reset_for_tests()


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
