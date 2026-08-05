"""환경 변수 기반 애플리케이션 설정 (Pydantic v2 BaseSettings)."""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

EffortLevel = Literal["low", "medium", "high", "xhigh", "max"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- 앱 ---
    app_name: str = "Stock AI API"
    api_v1_prefix: str = "/api/v1"
    debug: bool = False
    log_level: str = "INFO"
    # 리스트/딕트 타입은 pydantic-settings가 JSON으로 파싱한다 → .env에 JSON 배열로 기입
    cors_origins: list[str] = ["http://localhost:3000"]

    # --- DB ---
    database_url: str = "sqlite+aiosqlite:///./stock.db"
    db_echo: bool = False
    # 개발 편의용. 운영에서는 alembic 마이그레이션을 쓰고 False로 둔다.
    db_create_all_on_startup: bool = True

    # --- 외부 HTTP ---
    http_timeout_seconds: float = Field(default=20.0, gt=0)

    # --- 상장사 목록 ---
    # 이 값보다 적게 저장돼 있으면 자동완성 첫 호출 때 수집을 시도한다.
    listed_company_min_count: int = Field(default=100, ge=1)
    # 검색 후보를 DB에서 가져올 때의 상한. 초과분은 경고 로그로 남긴다.
    suggestion_candidate_limit: int = Field(default=500, ge=10)
    # 시가총액 배치의 yfinance 폴백이 한 번에 채우는 종목 수.
    # KRX 벌크가 되면 쓰이지 않는다 — 종목당 1회 호출이라 상한이 필요하다.
    market_cap_batch_limit: int = Field(default=400, ge=0)
    # 기동 직후 상장사 목록을 배경에서 채운다. 첫 검색·상세 요청이 KRX 수집(수 초)을
    # 기다리지 않게 하는 것이 목적이다. 테스트·오프라인에서는 끈다.
    seed_listed_companies_on_startup: bool = True

    # --- 등락률 랭킹 ---
    # 등락률을 스캔할 종목 수. 시가총액 상위부터 채운다 — 전 종목(2,700+)을
    # 매번 훑을 수는 없고, 상위권 밖은 등락 상위에 올라와도 의미가 옅다.
    # KRX 벌크(전 종목 한 번에)가 열리면 이 상한 자체가 불필요해진다.
    market_movers_universe_size: int = Field(default=200, ge=10, le=2000)
    # 랭킹 스냅샷 수명(초). 만료되면 다음 요청이 배경 갱신을 예약하고,
    # 그동안은 직전 스냅샷을 그대로 낸다 — 스캔이 수 초라 동기로 기다릴 수 없다.
    market_movers_ttl_seconds: int = Field(default=300, ge=0)
    # 기동 직후 랭킹을 미리 데워 첫 홈 화면이 예시 데이터로 떨어지지 않게 한다.
    warm_market_movers_on_startup: bool = True

    # --- 재무·밸류에이션 ---
    # 종목당 캐시 수명(초). ticker.info 한 번이 0.5~1.5초이고 밸류에이션·손익까지
    # 합치면 1~2초라 요청마다 부를 수 없다. 그렇다고 PER/PBR 은 주가를 따라
    # 움직이므로 하루 단위로 둘 수도 없다 — 15분이 그 사이의 타협점이다.
    stock_fundamentals_ttl_seconds: int = Field(default=900, ge=0)
    # 캐시에 담아 둘 종목 수 상한. 임의 심볼이 키라 상한이 없으면 무한히 증가한다.
    stock_fundamentals_cache_size: int = Field(default=512, ge=1)

    # --- AI 판단 캐시·상한 ---
    # 종목 하나를 분석하면 LLM 4회(에이전트 3 + 판단 1)가 나간다. 여기 있는 값들이
    # 이 프로젝트에서 **유일하게 돈이 새는 경로**의 수도꼭지다.
    #
    # 이 시간 안에는 같은 종목을 다시 물어도 **뉴스 조회조차 하지 않고** 캐시를 낸다.
    # 만료 뒤에는 뉴스 지문만 비교해서, 기사가 그대로면 LLM 없이 수명을 연장하고
    # 새 기사가 있을 때만 다시 분석한다 (advice_cache.py).
    advice_cache_ttl_seconds: int = Field(default=600, ge=0)
    # 캐시에 담아 둘 종목 수 상한. 임의 심볼이 키라 상한이 없으면 무한히 증가한다.
    advice_cache_size: int = Field(default=256, ge=1)
    # 동시에 돌릴 수 있는 분석 수. 초과 요청은 429다 — 큐에 쌓아 두면 상한이 아니라
    # 지연이 되고, LLM 호출 총량은 그대로 나간다.
    # 프런트 일괄 분석이 3개씩 여는 것을 감안한 값이다 (useBulkAdvice MAX_CONCURRENT).
    advice_max_concurrent: int = Field(default=4, ge=1)

    # --- LLM (OpenAI) ---
    # 미설정 시 SDK가 OPENAI_API_KEY 환경 변수를 읽는다.
    openai_api_key: str | None = None
    # 추론 강도(llm_effort)를 쓰므로 gpt-5 계열이나 o 시리즈여야 한다.
    # 비추론 모델로 바꾸면 reasoning 파라미터에서 400이 날 수 있다.
    openai_model: str = "gpt-5.4"
    # 추론 토큰도 이 상한을 함께 먹는다 — 너무 낮으면 본문이 빈 채로 incomplete 가 된다.
    llm_max_tokens: int = Field(default=16000, ge=1024)
    llm_effort: EffortLevel = "medium"
    llm_timeout_seconds: float = Field(default=300.0, gt=0)
    llm_max_retries: int = Field(default=2, ge=0)

    # --- RAG (벡터 검색) ---
    # 주 DB(`database_url`)와 분리한다. 벡터 검색은 pgvector 확장이 필요한데 로컬
    # 개발 DB는 SQLite라 확장을 못 올린다. 비워 두면 **RAG 계층만** 꺼지고 나머지는
    # 그대로 동작한다 — 에이전트는 예전처럼 최신 뉴스 3건을 직접 받는다.
    # Supabase의 URI를 그대로 붙여넣으면 된다 (postgres:// · sslmode · 6543 포트
    # 풀러 모두 vector_database.py 가 정규화한다).
    vector_database_url: str | None = None
    embedding_model: str = "text-embedding-3-small"
    # 테이블 DDL의 `vector(N)`이 이 값으로 만들어진다. 색인을 만든 뒤 모델을 바꾸면
    # 차원이 어긋나 검색이 실패한다 — 그때는 테이블을 지우고 다시 적재해야 한다.
    embedding_dimensions: int = Field(default=1536, ge=64)

    # 청크 길이. 뉴스 요약은 대개 한 청크에 들어가고, 긴 리포트만 쪼개진다.
    rag_chunk_chars: int = Field(default=900, ge=200)
    rag_chunk_overlap: int = Field(default=150, ge=0)
    # 벡터·키워드 검색기가 **각각** 뽑는 후보 수. 융합 뒤 rag_top_k만 남는다.
    rag_candidate_k: int = Field(default=24, ge=1)
    rag_top_k: int = Field(default=6, ge=1)
    # 이보다 오래된 문서는 검색 대상에서 뺀다. 3개월 지난 뉴스로 오늘의 매수 판단을
    # 하면 근거처럼 보이는 헛소리가 된다.
    rag_recency_days: int = Field(default=120, ge=1)
    # 판단 요청이 들어올 때 그 종목의 새 뉴스를 색인할지. 끄면 배치·스크립트로만 채운다.
    rag_ingest_on_advice: bool = True
    # 색인+검색 전체 예산. 초과하면 문서 없이 진행한다 — RAG 때문에 판단이
    # 늦어지거나 실패하면 안 된다.
    rag_timeout_seconds: float = Field(default=15.0, gt=0)

    @property
    def rag_enabled(self) -> bool:
        """접속 정보가 있어야 RAG를 켠다. 그 외에는 조용히 비활성이다."""
        return bool(self.vector_database_url)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
