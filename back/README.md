# 주식 AI 분석 백엔드

FastAPI · 비동기 · Pydantic v2 · 멀티 에이전트 투자 판단.
프런트엔드 와이어프레임(`front/`)의 명세 6.1–6.4에 대응한다.

## 빠른 시작

```bash
uv sync --all-groups
cp .env.example .env          # ANTHROPIC_API_KEY 채우기 (없으면 규칙 기반으로 동작)
uv run fastapi dev            # 개발 (자동 리로드)
uv run fastapi run            # 운영
```

진입점은 `pyproject.toml`의 `[tool.fastapi] entrypoint = "main:app"`로 고정돼 있다.
루트 `main.py`는 `app/main.py`의 앱을 재노출하기만 하고 로직을 담지 않는다.

- API 문서: http://127.0.0.1:8000/docs
- 헬스체크: http://127.0.0.1:8000/health

```bash
uv run pytest          # 테스트
uv run ruff check .    # 린트
uv run ruff format .   # 포맷
```

## 엔드포인트

전체 파라미터 · 응답 필드 · 오류 코드는 [`docs/api-spec.md`](docs/api-spec.md)에 있다.

| 메서드 | 경로 | 명세 | 설명 |
|---|---|---|---|
| GET | `/api/v1/markets/overview?category=` | 6.1 | 카테고리별 시장 개요 + 스파크라인 |
| GET | `/api/v1/stocks/suggestions?query=` | 6.2 | 종목명 · 코드 · 초성 자동완성 |
| GET | `/api/v1/stocks/listed-companies` | 6.2 | 상장사 목록 준비 상태 (첫 호출 지연 배너용) |
| GET | `/api/v1/stocks/history?symbol=` | 6.3 | OHLCV + SMA/볼린저밴드/교차신호 + 지표 + 뉴스 + 리포트 |
| GET | `/api/v1/stocks/content?symbol=` | 6.3 | 뉴스 · 애널리스트 리포트만 (차트 우선 로딩용) |
| POST | `/api/v1/stocks/advice` | 6.4 | 에이전트 3인 병렬 분석 → 최종 판단 |
| POST | `/api/v1/stocks/advice/stream` | 6.4 | 위와 동일 + 4단계 SSE 스트리밍 |
| GET | `/health` | — | 헬스체크 |

`category`: `home` · `index` · `forex` · `commodity` · `stock`
`timeframe`: `day` · `week` · `month`

오류 응답은 모두 같은 형태다:

```json
{ "error": { "code": "unsupported_timeframe", "message": "지원하지 않는 조회 단위입니다." } }
```

## 계층 구조

```
app/
├── api/           라우팅 전용 — 파라미터 수신 + 서비스 호출
├── services/      비즈니스 로직 · 오케스트레이션 · 도메인 규칙 검증
├── repositories/  DB 접근 (SQL은 여기서만 작성)
├── integrations/  외부 시스템 어댑터 (yfinance · KRX/KIND · llm.py)
├── agents/        LLM 에이전트 정의와 프롬프트
├── domain/        순수 도메인 로직 (종목 정규화 · 지표 계산 · 상수)
├── models/        SQLAlchemy ORM
├── schemas/       Pydantic v2 — API 계약 겸 계층 간 데이터 계약
├── core/          설정 · DB 엔진 · 예외 · 로깅
└── utils/         순수 유틸 (숫자 · 텍스트)
```

의존 방향은 위에서 아래로만 흐른다. `domain`과 `utils`는 앱 내부의 다른 계층을
import하지 않아 네트워크·DB 없이 단위 테스트할 수 있다.

## 설계 노트

**블로킹 경계** — yfinance는 동기 라이브러리다. `integrations/yfinance/`의 함수는 모두
동기이고, 서비스 계층이 `asyncio.to_thread`로 감싸 이벤트 루프를 막지 않는다. 반면
KRX/KIND 수집은 `httpx.AsyncClient`로 네이티브 비동기다.

**에이전트 병렬 실행** — 하위 에이전트 3인은 서로 독립적이라 `asyncio.gather`로 동시에
호출한다. 순차 호출이던 원본 대비 대기 시간이 1/3로 줄어든다.

**폴백 체인** — 각 단계가 실패해도 응답은 나온다.
상장사 목록: KRX CSV → KIND HTML → 내부 기본 종목.
투자 판단: LLM 에이전트 → 지표 규칙 기반(`agents/decision.fallback_decision`).
모든 폴백 전환은 WARNING 로그를 남긴다 — 조용히 삼키지 않는다.

**예외 처리** — 서비스·통합 계층은 `HTTPException`을 던지지 않는다. `core/exceptions.py`의
도메인 예외를 던지고 HTTP 매핑은 등록된 핸들러가 담당한다. 덕분에 서비스 계층을
FastAPI 없이 테스트할 수 있다.

**검색 정규화** — `search_name` / `search_symbol` / `initial_consonants`를 컬럼으로
저장해 필터링을 SQL로 내린다. 순위 계산만 파이썬에서 한다.

## LLM 설정

기본 모델은 `claude-opus-5`. 최종 판단은 `messages.parse(output_format=InvestmentDecision)`로
스키마가 검증된 구조화 출력을 받는다.

**앱에서 LLM SDK를 import하는 파일은 `app/integrations/llm.py` 하나뿐이다.** 에이전트
계층은 `ask_text` / `ask_structured` 두 함수만 보므로 프로바이더 교체 시 이 파일만
바꾸면 된다.

`ANTHROPIC_API_KEY`를 비워두면 SDK가 `ANTHROPIC_AUTH_TOKEN` → `ant auth login` 프로필
순서로 자격 증명을 찾는다. 아무것도 없으면 에이전트 호출이 실패하고 규칙 기반 판단으로
자동 폴백한다(응답은 200).

`LLM_SERVER_SIDE_FALLBACK`은 안전 분류기 거절 시 서버 측 대체 모델로 재실행하는 베타
기능이다. 조직별로 사용 가능 여부가 달라 400이 발생하면 `false`로 두면 된다.

### LLM 경로 검증

자격 증명 없이도 에이전트 배선은 `tests/test_agents.py`가 덮는다 — SDK 호출 경계만
대체하고 병렬 실행·폴백 전환·라벨 매핑을 모두 검증한다.

키를 넣은 뒤에는 네트워크 왕복을 한 번 확인한다:

```bash
uv run python -m scripts.verify_llm
```

4단계가 각각 독립적으로 실패 원인을 좁힌다 (자격 증명 → 기본 요청 형태 → 폴백 베타 →
구조화 출력). 통과하면 마지막으로 실제 엔드포인트에서 `agents[*].status`가 모두
`"done"`인지 확인한다 — `"fallback"`이면 LLM이 아니라 규칙 기반으로 답한 것이다.

## 운영

```bash
docker compose up --build     # API + Postgres
```

Postgres를 쓰려면 `uv sync --extra postgres` 후 `DATABASE_URL`을
`postgresql+asyncpg://...`로 바꾼다.

스키마는 개발 편의를 위해 기동 시 `create_all`로 만든다. 운영에서는
`DB_CREATE_ALL_ON_STARTUP=false`로 두고 alembic 마이그레이션을 도입한다.

## 남은 정리 작업

- `_legacy/` — `app/`으로 이관이 끝난 원본 보관소. 실행되지 않으며 이관 매핑은
  [`_legacy/README.md`](_legacy/README.md)에 있다. 대조가 끝나면 폴더째 삭제.
- alembic 도입 (현재는 기동 시 `create_all`).
- 미사용 의존성 정리: `alembic`, `bcrypt`, `pyjwt`, `fastapi-pagination`, `openai`.
