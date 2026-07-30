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

    # --- LLM ---
    anthropic_api_key: str | None = None
    # 미설정 시 SDK가 ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / `ant auth login`
    # 프로필 순서로 자격 증명을 해석한다.
    anthropic_model: str = "claude-opus-5"
    llm_max_tokens: int = Field(default=16000, ge=1024)
    llm_effort: EffortLevel = "medium"
    llm_timeout_seconds: float = Field(default=300.0, gt=0)
    llm_max_retries: int = Field(default=2, ge=0)
    # 안전 분류기가 요청을 거절하면 서버 측에서 권장 대체 모델로 재실행한다.
    # 베타 기능이라 조직별로 사용 가능 여부가 다르다 — 400이 나면 false로 두면 된다.
    # 끄더라도 이 앱은 규칙 기반 판단으로 자체 폴백한다.
    llm_server_side_fallback: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
