"""문서 청크 저장·검색 (pgvector).

ORM을 쓰지 않고 원시 SQL을 쓰는 이유:

* 벡터 연산자(`<=>`)와 트라이그램 연산자(`<%`)는 SQLAlchemy 표현식으로 옮기면
  오히려 읽기 어려워진다. 하이브리드 검색은 SQL 자체가 명세다.
* 이 테이블은 주 DB(SQLite)의 `Base.metadata`에 들어가면 안 된다. 같은 메타데이터에
  얹으면 개발용 `create_all()`이 `vector` 타입에서 깨진다.

스키마는 `ensure_schema()`가 멱등으로 만든다 — alembic이 주 DB(SQLite) 기준으로
설정돼 있어 다른 DB의 마이그레이션을 함께 관리할 수 없다.
"""

import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.config import settings
from app.schemas.rag import DocumentChunk

logger = logging.getLogger(__name__)


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
                # 빈 문자열을 date 컬럼에 넣을 수 없다 — 날짜를 모르는 기사는 NULL 이고
                # 최신성 필터에서 제외된다.
                "published_at": chunk.published_at or None,
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
