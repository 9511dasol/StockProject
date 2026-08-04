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
