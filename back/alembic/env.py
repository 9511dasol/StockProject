import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# 앱 설정과 모델을 그대로 재사용한다 — alembic.ini 에 DB 주소를 이중으로 적으면
# .env 와 어긋날 때 조용히 다른 DB 를 마이그레이션하게 된다.
from app.core.config import settings
from app.core.db_url import is_postgres, normalize_url
from app.models.base import Base
from app.models.listed_company import ListedCompany  # noqa: F401  (메타데이터 등록)
from app.models.watchlist import WatchlistItem  # noqa: F401  (메타데이터 등록)

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
target_metadata = Base.metadata

# .env 의 DATABASE_URL 을 단일 출처로 삼는다.
#
# **앱과 같은 정규화를 거친다.** Supabase 풀러 URI 를 그대로 넘기면 `sslmode` 에서
# TypeError 가 나 마이그레이션이 아예 시작되지 않는다 — 앱은 붙는데 alembic 만 안
# 붙는 상태가 되고, 그러면 스키마가 코드보다 뒤처진 채로 오래 간다.
_ALEMBIC_URL, _ALEMBIC_CONNECT_ARGS = (
    normalize_url(settings.database_url)
    if is_postgres(settings.database_url)
    else (settings.database_url, {})
)
config.set_main_option("sqlalchemy.url", _ALEMBIC_URL)

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        # SQLite 는 ALTER TABLE 지원이 좁아 테이블 재생성(batch)이 필요하다.
        render_as_batch=settings.database_url.startswith("sqlite"),
        include_object=_include_object,
    )

    with context.begin_transaction():
        context.run_migrations()


#: alembic 이 **건드리면 안 되는** 테이블 — ORM 메타데이터에 없지만 살아 있어야 하는 것들.
#:
#: 이 목록이 없으면 `--autogenerate` 가 "메타데이터에 없다" 며 **drop_table 을 제안한다.**
#: 그대로 실행하면 데이터가 통째로 사라진다. 실제로 탐침을 돌려 확인한 위험이다.
#:
#: 둘로 나뉜다.
#:   * NextAuth(Auth.js) 계약 — 프런트의 `@auth/pg-adapter` 가 읽고 쓴다.
#:     스키마는 `b3f1c2d47a90` 마이그레이션이 만든다.
#:   * `document_chunks` — `repositories/document_chunk.ensure_schema()` 가 **원시 SQL**로
#:     만든다. pgvector 의 `vector(N)` 타입과 HNSW·트라이그램 인덱스는 SQLAlchemy 모델로
#:     표현할 수 없어 그렇게 둔 것이고, 그 대가로 여기 예외가 필요하다.
_FOREIGN_TABLES = {
    "users",
    "accounts",
    "sessions",
    "verification_token",
    "document_chunks",
}


def _include_object(obj, name, type_, reflected, compare_to) -> bool:
    """자동 생성 대상에서 남의 테이블을 뺀다."""
    if type_ == "table" and name in _FOREIGN_TABLES:
        return False
    # 그 테이블에 달린 인덱스·제약도 함께 뺀다.
    parent = getattr(obj, "table", None)
    return not (parent is not None and parent.name in _FOREIGN_TABLES)


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        render_as_batch=settings.database_url.startswith("sqlite"),
        include_object=_include_object,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """In this scenario we need to create an Engine
    and associate a connection with the context.

    """

    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        # TLS 컨텍스트·프리페어드 캐시 설정은 URL 에 담을 수 없어 따로 넘긴다.
        connect_args=_ALEMBIC_CONNECT_ARGS,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""

    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
