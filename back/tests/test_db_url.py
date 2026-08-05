"""Postgres 접속 문자열 정규화 (`core/db_url.py`).

이 파일이 중요한 이유는 하나다. **여기가 틀리면 앱이 DB에 아예 못 붙는다.** 그런데
실패가 붙는 시점에 나므로 로컬 SQLite 로 개발하는 동안에는 전부 초록이고, 배포에서
처음 드러난다. 그래서 실제 Supabase 문자열 형태를 그대로 넣고 결과를 고정한다.

접속하지 않는다 — 순수 문자열 변환이라 네트워크가 필요 없고, 그래야 Supabase 가
꺼져 있어도 이 계약이 검증된다.
"""

from app.core.db_url import (
    is_pooler,
    is_postgres,
    normalize_url,
    to_sync_url,
)

# Supabase 대시보드 > Project Settings > Database > Connection string 이 주는 형태.
# (값은 가짜다)
_TRANSACTION_POOLER = (
    "postgresql://postgres.abcd:pw@aws-0-ap-northeast-2.pooler.supabase.com"
    ":6543/postgres?sslmode=require"
)
_SESSION_POOLER = (
    "postgresql://postgres.abcd:pw@aws-0-ap-northeast-2.pooler.supabase.com"
    ":5432/postgres?sslmode=require"
)
_SQLITE = "sqlite+aiosqlite:///./stock.db"


def test_driver_is_added_for_asyncpg() -> None:
    """SQLAlchemy 는 드라이버를 알아야 한다. `postgresql://` 만으로는 psycopg 를 찾는다."""
    url, _ = normalize_url(_TRANSACTION_POOLER)

    assert url.startswith("postgresql+asyncpg://")


def test_explicit_driver_is_not_overwritten() -> None:
    """이미 드라이버를 적어 둔 사람의 의도를 덮지 않는다."""
    url, _ = normalize_url("postgresql+asyncpg://u:p@host:5432/db")

    assert url.startswith("postgresql+asyncpg://")


def test_sslmode_is_stripped_but_tls_is_kept() -> None:
    """`sslmode` 는 libpq 전용이다 — asyncpg 에 넘기면 TypeError 가 난다.

    그렇다고 TLS 를 끄면 안 되므로 파라미터는 버리고 **컨텍스트로 바꿔** 넘긴다.
    이 둘을 함께 하지 않으면 "연결은 되는데 평문" 이거나 "아예 안 붙거나" 둘 중 하나다.
    """
    url, connect_args = normalize_url(_TRANSACTION_POOLER)

    assert "sslmode" not in url
    assert connect_args["ssl"] is not None


def test_transaction_pooler_disables_prepared_statements() -> None:
    """6543 은 PgBouncer 다. 세션마다 백엔드가 바뀌므로 프리페어드 캐시를 켜 두면
    `prepared statement _pg_N already exists` 로 깨진다.

    **캐시가 둘이라 둘 다 꺼야 한다** — asyncpg 자체(`statement_cache_size`)와
    SQLAlchemy asyncpg 방언(`prepared_statement_cache_size`)은 별개다.
    """
    url, connect_args = normalize_url(_TRANSACTION_POOLER)

    assert connect_args["statement_cache_size"] == 0
    assert "prepared_statement_cache_size=0" in url
    assert is_pooler(_TRANSACTION_POOLER)


def test_session_pooler_keeps_prepared_statements() -> None:
    """5432 세션 풀러는 커넥션을 붙들고 있어 프리페어드가 정상 동작한다.

    여기까지 캐시를 끄면 이유 없이 느려진다 — 포트로 갈리는 것이 핵심이다.
    """
    url, connect_args = normalize_url(_SESSION_POOLER)

    assert "statement_cache_size" not in connect_args
    assert "prepared_statement_cache_size" not in url
    assert not is_pooler(_SESSION_POOLER)


def test_localhost_does_not_force_tls() -> None:
    """로컬 Postgres 는 대개 TLS 를 안 켠다. 강제하면 개발 환경이 안 붙는다."""
    _, connect_args = normalize_url("postgresql://u:p@localhost:5432/db")

    assert "ssl" not in connect_args


def test_sqlite_is_not_postgres() -> None:
    """분기의 기준. 이게 틀리면 SQLite 에 asyncpg 정규화를 걸어 로컬이 깨진다."""
    assert not is_postgres(_SQLITE)
    assert not is_postgres(None)
    assert is_postgres(_TRANSACTION_POOLER)
    assert is_postgres("postgresql+asyncpg://u:p@h/db")


def test_sync_url_keeps_libpq_params_for_alembic() -> None:
    """alembic 은 psycopg 로 돈다 — asyncpg 용 변환을 그대로 쓰면 안 된다.

    `sslmode` 는 오히려 **있어야** 하고 `prepared_statement_cache_size` 는 모른다.
    """
    normalized, _ = normalize_url(_TRANSACTION_POOLER)
    sync = to_sync_url(normalized)

    assert sync.startswith("postgresql://")
    assert "prepared_statement_cache_size" not in sync


def test_vector_dsn_falls_back_to_main_database(monkeypatch) -> None:
    """`VECTOR_DATABASE_URL` 이 없으면 주 DB(Postgres)를 그대로 쓴다.

    두 곳에 같은 주소를 적어 두면 한쪽만 바꿔 어긋난다. 분리가 필요했던 이유는
    주 DB 가 SQLite 였기 때문이고, Postgres 인 지금은 그 이유가 없다.
    """
    from app.core.config import settings

    monkeypatch.setattr(settings, "vector_database_url", None)
    monkeypatch.setattr(settings, "database_url", _TRANSACTION_POOLER)
    assert settings.vector_database_dsn == _TRANSACTION_POOLER
    assert settings.rag_enabled

    # 주 DB 가 SQLite 면 벡터 저장소가 될 수 없다 — 확장을 못 올린다.
    monkeypatch.setattr(settings, "database_url", _SQLITE)
    assert settings.vector_database_dsn is None
    assert not settings.rag_enabled


def test_explicit_vector_url_wins(monkeypatch) -> None:
    """벡터만 다른 인스턴스로 빼고 싶을 때를 위해 변수를 남겨 뒀다."""
    from app.core.config import settings

    monkeypatch.setattr(settings, "database_url", _SESSION_POOLER)
    monkeypatch.setattr(settings, "vector_database_url", _TRANSACTION_POOLER)

    assert settings.vector_database_dsn == _TRANSACTION_POOLER


def test_reasoning_is_only_sent_to_models_that_accept_it() -> None:
    """`reasoning` 은 gpt-5 계열·o 시리즈만 받는다.

    비추론 모델(gpt-4o-mini 등)에 붙여 보내면 **요청 자체가 400** 이라 응답을 한 줄도
    못 받고, 화면에는 "AI 판단 실패" 로만 보여 원인이 모델 선택에 있다는 것을 알기 어렵다.
    """
    from app.integrations.llm import supports_reasoning

    assert supports_reasoning("gpt-5.4-mini")
    assert supports_reasoning("gpt-5")
    assert supports_reasoning("o3-mini")
    assert not supports_reasoning("gpt-4o-mini")
    assert not supports_reasoning("gpt-4.1")
