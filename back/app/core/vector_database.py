"""RAG 전용 Postgres(pgvector) 엔진.

주 DB 엔진(`core/database.py`)과 **분리한다.** 이유는 둘이다.

1. 벡터 검색은 `vector` 확장이 필요한데 로컬 개발 DB는 SQLite라 확장을 못 올린다.
   같은 `Base.metadata`에 벡터 테이블을 얹으면 `create_all()`이 SQLite에서 깨진다.
2. RAG는 **없으면 없는 대로 돌아가야 한다.** `VECTOR_DATABASE_URL`이 비어 있거나
   Supabase가 죽어 있어도 종목 상세·AI 판단은 그대로 나와야 하므로, 실패를 이
   경계 안에 가둔다 (`get_engine()`이 None을 돌려주면 호출부는 문서 없이 진행한다).

Supabase가 주는 URI를 **그대로** 붙여넣을 수 있게 정규화를 여기서 흡수한다.
그 문자열은 `postgresql://...?sslmode=require` 형태인데 asyncpg는 `sslmode`를
모르고(TypeError), 6543 풀러는 프리페어드 스테이트먼트를 허용하지 않는다.
"""

import logging
import ssl
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings

logger = logging.getLogger(__name__)

_engine: AsyncEngine | None = None
_engine_failed = False

# 트랜잭션 풀러(PgBouncer). 세션마다 백엔드가 바뀌므로 프리페어드 스테이트먼트를
# 캐시하면 "prepared statement _pg_N already exists"로 깨진다.
_POOLER_PORTS = {"6543"}
_LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}
# asyncpg가 모르는 libpq 전용 파라미터. 남겨 두면 연결 시 TypeError가 난다.
_LIBPQ_ONLY_PARAMS = {"sslmode", "pgbouncer", "options", "target_session_attrs", "channel_binding"}


def normalize_url(raw: str) -> tuple[str, dict[str, object]]:
    """접속 문자열을 asyncpg용으로 고치고 connect_args를 함께 만든다.

    Returns:
        (SQLAlchemy URL, create_async_engine 에 넘길 connect_args)
    """
    parts = urlsplit(raw.strip())

    scheme = parts.scheme
    if scheme in {"postgres", "postgresql"}:
        scheme = "postgresql+asyncpg"

    query = [(key, value) for key, value in parse_qsl(parts.query) if key not in _LIBPQ_ONLY_PARAMS]

    connect_args: dict[str, object] = {}

    # TLS — 원격은 항상 켠다. Supabase는 공인 인증서라 기본 컨텍스트로 검증된다.
    host = (parts.hostname or "").lower()
    if host and host not in _LOCAL_HOSTS:
        connect_args["ssl"] = ssl.create_default_context()

    # 풀러 뒤에서는 양쪽 캐시를 모두 끈다 — asyncpg 자체 캐시(statement_cache_size)와
    # SQLAlchemy asyncpg 방언의 캐시(prepared_statement_cache_size)는 별개다.
    if str(parts.port or "") in _POOLER_PORTS:
        connect_args["statement_cache_size"] = 0
        query.append(("prepared_statement_cache_size", "0"))

    url = urlunsplit((scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))
    return url, connect_args


def get_engine() -> AsyncEngine | None:
    """벡터 DB 엔진. 미설정이거나 생성에 실패하면 None (= RAG 비활성)."""
    global _engine, _engine_failed

    if _engine is not None:
        return _engine
    if _engine_failed or not settings.vector_database_url:
        return None

    try:
        url, connect_args = normalize_url(settings.vector_database_url)
        _engine = create_async_engine(
            url,
            echo=settings.db_echo,
            # 풀러가 이미 커넥션을 관리한다. 여기서 또 풀을 잡으면 유휴 커넥션이
            # 이중으로 쌓이고, Supabase 무료 티어의 연결 상한에 먼저 닿는다.
            poolclass=NullPool,
            connect_args=connect_args,
        )
    except Exception as exc:  # noqa: BLE001 - 주소가 틀렸다고 서버가 못 뜨면 안 된다
        _engine_failed = True
        logger.warning("벡터 DB 엔진 생성 실패 (%s) → RAG 없이 동작합니다", exc)
        return None

    logger.info(
        "벡터 DB 엔진 준비 (model=%s, dim=%d)",
        settings.embedding_model,
        settings.embedding_dimensions,
    )
    return _engine


async def dispose_vector_engine() -> None:
    global _engine, _engine_failed
    if _engine is not None:
        await _engine.dispose()
        _engine = None
    _engine_failed = False
