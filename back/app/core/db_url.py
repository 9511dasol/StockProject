"""Postgres 접속 문자열 정규화. 주 DB·벡터 DB가 함께 쓴다.

## 왜 정규화가 필요한가

Supabase 대시보드가 주는 문자열을 **그대로 붙여넣을 수 있어야 한다.** 그런데 그
문자열은 libpq(psql·psycopg) 기준이고 우리는 asyncpg 를 쓴다. 셋이 어긋난다.

    postgresql://postgres.<ref>:PW@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require
    └── ①                                                                    └── ②   └── ③

  ① `postgresql://` → SQLAlchemy 는 드라이버를 알아야 한다 (`+asyncpg`)
  ② 6543 은 **트랜잭션 풀러**(PgBouncer)다. 세션마다 백엔드가 바뀌므로 프리페어드
     스테이트먼트를 캐시하면 `prepared statement _pg_N already exists` 로 깨진다
  ③ `sslmode` 는 libpq 전용이다. asyncpg 에 넘기면 TypeError 가 난다

## 왜 파일로 뺐나

예전에는 이 로직이 `vector_database.py` 안에만 있었다. 주 DB 가 로컬 SQLite 라
필요가 없었기 때문이다. 주 DB 를 Supabase 로 옮기는 순간 **같은 처리가 양쪽에 필요**해졌고,
한쪽에만 있으면 "벡터 검색은 되는데 앱이 DB에 못 붙는" 상태가 된다.
"""

import ssl
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

#: 트랜잭션 풀러(PgBouncer) 포트. 여기서는 프리페어드 스테이트먼트를 못 쓴다.
POOLER_PORTS = {"6543"}
_LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}
#: asyncpg 가 모르는 libpq 전용 파라미터. 남겨 두면 연결 시 TypeError.
_LIBPQ_ONLY_PARAMS = {
    "sslmode",
    "pgbouncer",
    "options",
    "target_session_attrs",
    "channel_binding",
}


def is_postgres(raw: str | None) -> bool:
    if not raw:
        return False
    return urlsplit(raw).scheme.split("+", 1)[0] in {"postgres", "postgresql"}


def normalize_url(raw: str) -> tuple[str, dict[str, object]]:
    """접속 문자열을 asyncpg용으로 고치고 connect_args를 함께 만든다.

    이미 `postgresql+asyncpg://` 로 적혀 있어도 그대로 통과한다 — 드라이버를 직접
    적어 둔 사람의 의도를 덮지 않는다.

    Returns:
        (SQLAlchemy URL, create_async_engine 에 넘길 connect_args)
    """
    parts = urlsplit(raw.strip())

    scheme = parts.scheme
    if scheme in {"postgres", "postgresql"}:
        scheme = "postgresql+asyncpg"

    query = [
        (key, value)
        for key, value in parse_qsl(parts.query)
        if key not in _LIBPQ_ONLY_PARAMS
    ]

    connect_args: dict[str, object] = {}

    # TLS — 원격은 항상 켠다. Supabase 는 공인 인증서라 기본 컨텍스트로 검증된다.
    host = (parts.hostname or "").lower()
    if host and host not in _LOCAL_HOSTS:
        connect_args["ssl"] = ssl.create_default_context()

    # 풀러 뒤에서는 양쪽 캐시를 모두 끈다 — asyncpg 자체 캐시(statement_cache_size)와
    # SQLAlchemy asyncpg 방언의 캐시(prepared_statement_cache_size)는 별개다.
    if is_pooler(raw):
        connect_args["statement_cache_size"] = 0
        query.append(("prepared_statement_cache_size", "0"))

    url = urlunsplit((scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))
    return url, connect_args


def is_pooler(raw: str) -> bool:
    """트랜잭션 풀러 뒤인가. 포트로 판별한다 (Supabase 는 6543)."""
    return str(urlsplit(raw.strip()).port or "") in POOLER_PORTS


def to_sync_url(raw: str) -> str:
    """alembic 등 동기 드라이버용. `+asyncpg` 를 떼고 libpq 파라미터는 남긴다.

    마이그레이션은 psycopg 가 돌리므로 asyncpg 용 정규화를 그대로 쓰면 안 된다 —
    `sslmode` 는 오히려 **있어야** 하고, `prepared_statement_cache_size` 는 모른다.
    """
    parts = urlsplit(raw.strip())
    scheme = parts.scheme.split("+", 1)[0]
    query = [
        (key, value)
        for key, value in parse_qsl(parts.query)
        if key != "prepared_statement_cache_size"
    ]
    return urlunsplit((scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))
