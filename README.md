# 주식 AI 리서치

시장 현황·종목 차트·기술적 신호·뉴스를 한 화면에서 보고, 멀티 에이전트 AI가
판단 근거와 함께 의견을 제시하는 주식 리서치 보조 서비스.

> AI의 역할은 수익을 보장하거나 매매를 지시하는 것이 아니라, 분산된 정보를 정리하고
> 판단 근거를 이해하기 쉽게 보여주는 것이다. 투자자문이 아니다.

## 구성

| 디렉터리 | 스택 | 역할 |
|---|---|---|
| [`back/`](back/) | FastAPI · SQLAlchemy(async) · Pydantic v2 · OpenAI SDK | 시세·검색·지표·AI 판단 API |
| [`front/`](front/) | Next.js 16 (App Router · Cache Components) · Tailwind v4 · axios | SSR 리서치 화면 |
| [`docs/`](docs/) | — | [작업 노트](docs/작업노트.md)(변경 이력·현재 상태) · 기획서([사주 통합](docs/saju-integration-plan.md) · [초기 제품](docs/product-plan.md)) |

## 실행

두 개의 터미널이 필요하다. **백엔드를 먼저 띄운다** — 프런트가 SSR 단계에서 호출한다.

```bash
# 1) 백엔드 → http://127.0.0.1:8000  (문서: /docs)
cd back
uv sync --all-groups
cp .env.example .env          # OPENAI_API_KEY 입력 (없으면 규칙 기반으로 동작)
uv run fastapi dev

# 2) 프런트 → http://localhost:3000
cd front
npm install
cp .env.local.example .env.local
npm run dev
```

## 화면과 API

| 화면 | 경로 | 사용하는 API |
|---|---|---|
| 시장 현황 | `/` | `GET /api/v1/markets/overview` |
| 종목 상세 | `/stocks/[symbol]` | `GET /api/v1/stocks/history` · `/stocks/content` · `/stocks/fundamentals` |
| AI 투자 판단 | `/stocks/[symbol]/advice` | `POST /api/v1/stocks/advice` |
| 종목 자동완성 | 헤더 검색창 | `GET /api/v1/stocks/suggestions` (Next BFF 경유) |
| 설계 문서 | `/wireframes` | — |

## 검증

```bash
cd back  && uv run ruff check . && uv run pytest                    # 린트 + 테스트 97개
cd front && npx tsc --noEmit && npm run lint && npm test && npm run build   # + 테스트 43개
```

## 설계 메모

**렌더링** — 모든 제품 화면은 서버 컴포넌트다. 클라이언트 JS는 검색창 하나뿐이며,
차트조차 서버에서 SVG로 렌더된다(호버 툴팁은 CSS로 구현). 무거운 AI 분석은 폴링 없이
`<Suspense>` 스트리밍으로 처리한다.

**캐싱** — Next 16의 `cacheComponents`를 켰다. `use cache`가 async 함수의 *반환값*을
캐시하므로 HTTP 클라이언트(axios)와 무관하게 SSR 캐싱이 동작한다.

**계층 의존 방향** — `api → services → {repositories, integrations, agents} → {domain, schemas, core, utils}`.
아래 계층은 위를 import하지 않는다.

**폴백** — 외부 의존이 하나씩 실패해도 응답은 나온다.
상장사 목록은 `KRX → KIND → 내부 기본값`, 투자 판단은 `LLM → 지표 규칙 기반`으로 내려가며
전환은 전부 WARNING 로그를 남긴다.

**지표 계산의 소유자는 백엔드** — `/stocks/history` 응답에 `metrics`가 포함되므로
프런트는 같은 공식을 다시 구현하지 않는다. 재무·밸류에이션(`/stocks/fundamentals`)도
단위 정규화까지 백엔드에서 끝내고 내려준다.

**재무는 별도 엔드포인트** — 밸류에이션·배당 조회가 종목당 1~2초라 `/history`(차트 0.13초)에
합치면 차트가 그걸 기다린다. 종목당 15분 TTL 캐시가 붙어 있고, 프런트는 실패를 `null`로
삼켜 재무 한 칸 때문에 상세 페이지가 죽지 않게 한다.

## 알아두어야 할 것

- `back/`과 `front/`는 각각 **별도의 git 저장소**이며 아직 커밋이 없다. 하나로 합칠지,
  두 저장소로 갈지 정하고 첫 커밋을 만드는 편이 좋다 — 지금은 되돌릴 수단이 없다.
- `back/_legacy/`는 `app/`으로 이관이 끝난 원본 보관소다. 실행되지 않으며 대조가 끝나면
  폴더째 지우면 된다.
- 아직 쓰이지 않는 의존성이 있다: `bcrypt`, `pyjwt`, `fastapi-pagination`.
  인증·페이지네이션 도입 시점에 함께 정리한다.
