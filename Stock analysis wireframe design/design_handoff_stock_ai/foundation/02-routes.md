# 2단계 — 라우트와 서버/클라이언트 경계

프리미티브가 끝난 뒤. 화면 코드를 쓰기 전에 이 경계부터 확정합니다.

## 라우트
```
app/
  layout.tsx                  html[className=fontVars], data-theme
  page.tsx                    시장 홈 (3b)          — Server
  stocks/[symbol]/
    page.tsx                  종목 상세 (2a)        — Server
    loading.tsx               스켈레톤 (1d)
    error.tsx                 조회 실패 + 재시도
  watchlist/page.tsx          관심종목 (4b)         — Server shell + Client 표
  api/
    search/route.ts           자동완성 (디바운스 200ms)
    listed-companies/route.ts 준비 상태 폴링
    ai/advice/route.ts        SSE 스트리밍 (stage 이벤트)
```

`[symbol]`은 **정규화된 심볼**(`005930.KS`)이 아니라 사람이 읽는 코드(`005930`)를 URL에 두고, 서버에서 `krx_symbol_to_yfinance`로 변환하세요. URL이 공유 가능해야 합니다.

## 경계 규칙
| 영역 | 종류 | 이유 |
|---|---|---|
| 상세 헤드라인·지표·뉴스·리포트 | Server | 첫 페인트가 데이터와 함께. `revalidate: 60` |
| 차트 | Client | 휠 줌·크로스헤어. 데이터는 서버에서 prop으로 |
| 탭(뉴스/리포트/재무) | Client (얇게) | 3개 패널 모두 서버에서 받아두고 전환만 |
| 검색 팔레트 | Client | 전역 `⌘K`. `api/search` 호출 |
| AI 드로어 | Client | SSE 구독. 열림 상태는 `?ai=1` URL 동기화 |
| 관심종목 표 | Client | dnd-kit 정렬·선택·토글 |

## AI 스트리밍 계약
`api/ai/advice`는 `AiStreamEvent`(lib/types.ts)를 SSE로 순서대로 흘립니다:
```
{stage:1} → {stage:2} → {stage:3, agent:{...}} ×3 → {stage:4, decision:{...}}
```
- 각 `agent` 이벤트가 도착할 때마다 카드 하나를 append (`animate-fade-up`).
- 아직 안 온 자리는 3줄 스켈레톤(`animate-pulse-wf`).
- LLM 실패 시 `decision.source = "fallback"` → 같은 블록에 '규칙 기반 판단' 배지 + 재시도.
- 진행 바 채움 = `stage / 4`, `transition: width .4s ease`.

## 첫 호출 지연
`ensure_listed_companies`가 아직이면 검색 결과 위에 배너(스피너 + `n / total 종목`). `api/listed-companies`를 2초 간격 폴링하다 `ready`면 중단.

## 다음 (3단계)
화면 2a 종목 상세 — PROMPTS.md 스테이지 1.
