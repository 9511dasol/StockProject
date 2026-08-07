"""문서 청크 저장·검색 (pgvector).

ORM을 쓰지 않고 원시 SQL을 쓰는 이유:

* 벡터 연산자(`<=>`)와 트라이그램 연산자(`<%`)는 SQLAlchemy 표현식으로 옮기면
  오히려 읽기 어려워진다. 하이브리드 검색은 SQL 자체가 명세다.
* 이 테이블은 `Base.metadata`에 들어가면 안 된다. `vector(N)` 타입과 HNSW·트라이그램
  인덱스를 SQLAlchemy 모델로 표현할 수 없고, 얹어 두면 alembic 이 자기가 관리하는
  테이블로 착각한다 (`alembic/env.py` 의 `_FOREIGN_TABLES` 가 그래서 필요하다).

스키마는 `ensure_schema()`가 멱등으로 만든다 — 벡터 저장소는 주 DB 와 다른 인스턴스일
수 있어(`VECTOR_DATABASE_URL`) 주 DB 의 마이그레이션 이력으로 함께 관리할 수 없다.
"""

import logging
from datetime import date

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.config import settings
from app.schemas.rag import DocumentChunk

logger = logging.getLogger(__name__)


def _as_date(value: str | None) -> date | None:
    """`'2026-08-04'` → `date`. 비었거나 형식이 다르면 None.

    **문자열 그대로 넘기면 안 된다.** SQL 이 `cast(:published_at as date)` 라
    asyncpg 가 그 파라미터를 date 로 추론하고, 문자열을 받으면 바인딩 단계에서
    터진다 — `'str' object has no attribute 'toordinal'`. SQL 캐스트는 값이 서버에
    닿은 **뒤에** 일어나므로 바인딩을 구해 주지 못한다.

    이 경로는 예전에 로컬 SQLite 로 개발하던 시절 아무도 실행해 보지 못했고(벡터
    테이블 자체가 Postgres 전용), 그래서 5회차부터 색인이 한 번도 성공한 적 없이
    남아 있었다. 개발 DB 를 Postgres 로 통일한 이유가 정확히 이런 종류다.

    형식이 다르면 예외 대신 None 이다. 공급자가 준 이상한 날짜 하나가 색인 전체를
    죽이면, 나머지 정상 기사까지 검색에서 사라진다.
    """
    text_value = (value or "").strip()
    if not text_value:
        return None
    try:
        return date.fromisoformat(text_value[:10])
    except ValueError:
        logger.debug("published_at 을 날짜로 읽지 못했습니다: %r", value)
        return None


def _vector_literal(embedding: list[float]) -> str:
    """pgvector 입력 형식. `'[0.1,0.2]'::vector` 로 캐스팅해 넘긴다."""
    return "[" + ",".join(repr(float(value)) for value in embedding) + "]"


class DocumentChunkRepository:
    """벡터 DB 접근 경계. 엔진을 받아 쓰므로 세션 의존성이 없다."""

    def __init__(self, engine: AsyncEngine) -> None:
        self._engine = engine

    # --- 스키마 -------------------------------------------------------------

    async def ensure_schema(self) -> None:
        """확장·테이블·인덱스를 멱등으로 만든다.

        HNSW 인덱스는 문서가 없어도 만들어 둔다 — 적재 후에 만들면 그 시점에 테이블
        전체를 훑어 잠기는데, 색인 배치가 도는 중에 그 비용을 치를 이유가 없다.
        """
        dim = settings.embedding_dimensions
        statements = [
            "create extension if not exists vector",
            "create extension if not exists pg_trgm",
            f"""
            create table if not exists document_chunks (
                id          bigserial primary key,
                symbol      text        not null,
                doc_type    text        not null,
                doc_key     text        not null,
                chunk_index integer     not null,
                title       text        not null default '',
                publisher   text        not null default '',
                url         text        not null default '',
                published_at date,
                content     text        not null,
                embedding   vector({dim}) not null,
                created_at  timestamptz not null default now(),
                unique (doc_key, chunk_index)
            )
            """,
            """
            create index if not exists document_chunks_symbol_idx
                on document_chunks (symbol, published_at desc)
            """,
            """
            create index if not exists document_chunks_content_trgm_idx
                on document_chunks using gin (content gin_trgm_ops)
            """,
            """
            create index if not exists document_chunks_embedding_idx
                on document_chunks using hnsw (embedding vector_cosine_ops)
            """,
        ]

        async with self._engine.begin() as conn:
            for statement in statements:
                await conn.execute(text(statement))

    async def count(self, symbol: str | None = None) -> int:
        sql = "select count(*) from document_chunks"
        params: dict[str, object] = {}
        if symbol:
            sql += " where symbol = :symbol"
            params["symbol"] = symbol

        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql), params)
            return int(result.scalar_one())

    # --- 적재 ---------------------------------------------------------------

    async def existing_doc_keys(self, doc_keys: list[str]) -> set[str]:
        """이미 색인된 원문 키. 재임베딩(=비용)을 건너뛰기 위한 조회다."""
        if not doc_keys:
            return set()

        async with self._engine.connect() as conn:
            result = await conn.execute(
                text("select distinct doc_key from document_chunks where doc_key = any(:keys)"),
                {"keys": doc_keys},
            )
            return {row[0] for row in result}

    async def upsert(self, chunks: list[DocumentChunk], embeddings: list[list[float]]) -> int:
        """청크를 저장한다. 같은 (doc_key, chunk_index)는 덮어쓴다.

        덮어쓰기로 두는 이유: 같은 기사가 나중에 본문이 채워진 채로 다시 수집될 수
        있다. 그때 새 내용으로 갱신되어야 검색 결과가 최신 원문을 가리킨다.
        """
        if not chunks:
            return 0
        if len(chunks) != len(embeddings):
            raise ValueError("청크 수와 임베딩 수가 다르다")

        rows = [
            {
                "symbol": chunk.symbol,
                "doc_type": chunk.doc_type,
                "doc_key": chunk.doc_key,
                "chunk_index": chunk.chunk_index,
                "title": chunk.title,
                "publisher": chunk.publisher,
                "url": chunk.url,
                # 날짜를 모르는 기사는 NULL 이고 최신성 필터에서 제외된다.
                "published_at": _as_date(chunk.published_at),
                "content": chunk.content,
                "embedding": _vector_literal(embedding),
            }
            for chunk, embedding in zip(chunks, embeddings, strict=True)
        ]

        async with self._engine.begin() as conn:
            await conn.execute(
                text(
                    """
                    insert into document_chunks
                        (symbol, doc_type, doc_key, chunk_index, title, publisher, url,
                         published_at, content, embedding)
                    values
                        (:symbol, :doc_type, :doc_key, :chunk_index, :title, :publisher, :url,
                         cast(:published_at as date), :content, cast(:embedding as vector))
                    on conflict (doc_key, chunk_index) do update set
                        content = excluded.content,
                        embedding = excluded.embedding,
                        title = excluded.title,
                        publisher = excluded.publisher,
                        url = excluded.url,
                        published_at = excluded.published_at
                    """
                ),
                rows,
            )
        return len(rows)

    async def delete_symbol(self, symbol: str) -> int:
        async with self._engine.begin() as conn:
            result = await conn.execute(
                text("delete from document_chunks where symbol = :symbol"), {"symbol": symbol}
            )
            return int(result.rowcount or 0)

    # --- 검색 ---------------------------------------------------------------

    _SELECT = """
        select id, doc_type, title, publisher, url,
               coalesce(to_char(published_at, 'YYYY-MM-DD'), '') as published_at,
               content
    """
    _RECENCY = """
        and (published_at is null or published_at >= current_date - make_interval(days => :days))
    """

    async def search_vector(self, symbol: str, embedding: list[float], limit: int, days: int):
        """의미 유사도 상위 N. 코사인 거리(`<=>`)가 작을수록 가깝다."""
        sql = (
            self._SELECT
            + """
            from document_chunks
            where symbol = :symbol
            """
            + self._RECENCY
            + """
            order by embedding <=> cast(:embedding as vector)
            limit :limit
            """
        )
        async with self._engine.connect() as conn:
            result = await conn.execute(
                text(sql),
                {
                    "symbol": symbol,
                    "embedding": _vector_literal(embedding),
                    "limit": limit,
                    "days": days,
                },
            )
            return result.mappings().all()

    async def search_keyword(self, symbol: str, query: str, limit: int, days: int):
        """어휘 일치 상위 N.

        `word_similarity(질의, 본문)`을 쓴다. 일반 `similarity()`는 짧은 질의와 긴
        본문을 통째로 비교해 항상 낮게 나오는데, `word_similarity`는 질의가 본문
        **안의 어느 부분과** 닮았는지를 본다. 종목명·티커처럼 짧은 키워드가 긴 기사에
        묻히지 않게 하는 것이 목적이고, 한국어라 형태소 사전이 필요한 tsquery보다
        트라이그램이 안전하다.
        """
        sql = (
            self._SELECT
            + """
            from document_chunks
            where symbol = :symbol
              and :query <% content
            """
            + self._RECENCY
            + """
            order by word_similarity(:query, content) desc
            limit :limit
            """
        )
        async with self._engine.connect() as conn:
            result = await conn.execute(
                text(sql),
                {"symbol": symbol, "query": query, "limit": limit, "days": days},
            )
            return result.mappings().all()
