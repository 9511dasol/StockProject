# 화면 설계서

`front/src/` 가 실제로 구현하고 있는 화면의 설계서다. 코드가 정본이며, 이 문서는
`app/` 라우트와 `features/*/components` 를 읽어 확인한 구조만 기술한다.

- 구조 규칙: [`CONVENTIONS.md`](../CONVENTIONS.md) — 폴더·의존 방향·별칭
- 백엔드 계약: [`back/docs/api-spec.md`](../../back/docs/api-spec.md)
- 기획 문서: [`docs/product-plan.md`](../../docs/product-plan.md) 8장(프론트엔드 화면 요구사항)

---

## 1. 화면 목록

| ID | 화면 | 경로 | 렌더링 | 진입점 |
|---|---|---|---|---|
| S-01 | 시장 현황 (홈) | `/` | 서버, `force-dynamic` | 제호 · 탭바 홈 · 404 복귀 |
| S-02 | 종목 상세 — 에디토리얼 | `/stocks/[symbol]` | 서버 | 검색 · 등락 목록 · 관심종목 · 브리핑 |
| S-03 | 종목 상세 — 터미널 콘솔 | `/stocks/[symbol]?view=console` | S-02 와 동일 렌더 | 뷰 토글 · 딥링크 |
| S-04 | 관심 종목 | `/watchlist` | 서버 | 제호 액션 · 탭바 관심 |
| O-01 | 검색 팔레트 | 오버레이 (라우트 없음) | 클라이언트 | ⌘K / Ctrl+K · 검색 버튼 |
| O-02 | AI 종합 판단 드로어 | 오버레이 (라우트 없음) | 클라이언트 | AI 버튼 · `?ai=1` |
| E-01 | 종목 상세 로딩 | `loading.tsx` | 서버 | 세그먼트 전환 |
| E-02 | 오류 | `error.tsx` | 클라이언트 | 렌더 예외 |
| E-03 | 404 | `not-found.tsx` | 서버 | 미매칭 URL |
| E-04 | 종목 코드 미해석 | S-02 내부 분기 | 서버 | 정규화 실패 |
| E-05 | 시세 응답 지연 | S-02 내부 분기 | 서버 | 상류 타임아웃 |

라우트가 아닌 BFF 엔드포인트: `/api/stocks/suggestions`, `/api/stocks/listed-companies`,
`/api/stocks/advice`, `/api/auth/[...nextauth]`.

> `CONVENTIONS.md` 트리에 적힌 `/stocks/[symbol]/advice` 와 `(docs)/wireframes` 는
> 현재 존재하지 않는다. AI 판단은 별도 라우트가 아니라 드로어(O-02)로 구현돼 있다.

### 화면 전이

```
                 ⌘K / 검색 버튼
        ┌──────────── O-01 검색 팔레트 ────────────┐
        │              ⏎ 선택                      │  ⇥ 관심 추가(localStorage)
        │              ⌥⏎ (터미널 테마)            │
        ▼                                          ▼
   S-01 홈 ──── 등락 목록 / 브리핑 ────▶ S-02 종목 상세 ◀──── S-04 관심 종목
        │                                  │  ▲                    │
        │                          뷰 토글 │  │ ?view=console      │ 종목명
        └───── 탭바 / 제호 ────────────────┼──┴── S-03 콘솔 ───────┘
                                           │
                                     AI 버튼 · ?ai=1
                                           ▼
                                   O-02 AI 판단 드로어
```

---

## 2. 공통 설계

### 2.1 레이아웃 골격

S-01 · S-02 · S-04 · E-03 이 같은 골격을 공유한다.

```
┌────────────────────────────────────────────────────────┐
│ Masthead  제호(홈 링크) + 캡션 │ 검색 · 테마 · 액션      │  border-b-2 border-ink
├────────────────────────────────────────────────────────┤
│                                                        │
│   main  max-w-[1180px] · px-4 (md:px-8) · pt-[26px]    │
│                                                        │
└────────────────────────────────────────────────────────┘
   MobileTabBar  홈 · 검색 · 관심 · AI(비활성)   <768 에서만, fixed bottom
```

| 요소 | 사양 | 구현 |
|---|---|---|
| 컨테이너 | `max-w-[1180px]`, 좌우 `px-4` → `md:px-8`, 상단 `pt-[26px]` | 각 `page.tsx` |
| 하단 여백 | 기본 `pb-[30px]`. 모바일 고정 요소가 있는 화면은 `pb-24`(상세) / `pb-28`(홈·404) / `pb-40`(관심종목) | 고정 바에 콘텐츠가 가리지 않게 |
| 제호 | `Wordmark` — 클릭 시 홈. 캡션에 기준 시각·장 마감 안내 | [Masthead.tsx](../src/shared/components/layout/Masthead.tsx) |
| 우측 슬롯 | `search` · `ThemeToggle` · `action` 세 자리. 검색/AI 는 feature 소유라 슬롯 주입 | 〃 |
| 탭바 | 높이 `--tabbar-h: 62px`, `bottom-0 z-30`, `md:hidden`. 탭 4개 각 44×44 | [MobileTabBar.tsx](../src/shared/components/layout/MobileTabBar.tsx) |

탭바 위에 액션 바를 얹는 화면(S-04)은 `bottom: calc(var(--tabbar-h) + var(--safe-b))`
로 띄운다 — 두 요소가 각자 `bottom-0` 을 잡으면 정확히 겹친다.

### 2.2 반응형

브레이크포인트는 Tailwind 기본값을 쓰고 실제로는 두 개만 의미가 있다.

| 폭 | 이름 | 기준 |
|---|---|---|
| < 768 | 모바일 | 1열 스택 · 하단 탭바 · 팔레트 전체화면 · 고정 액션 바 |
| ≥ 768 | `md` 데스크탑 | 다열 그리드 · 상단 액션 노출 · 드로어 438px |
| ≥ 1280 | `xl` | S-01 우측 레일 328px 분리 (1024~1279 는 본문 아래로 접힘) |

화면별 그리드:

| 화면 | 모바일 | md | xl |
|---|---|---|---|
| S-01 지수 카드 | 2열 | 4열 | 4열 |
| S-01 본문/레일 | 1열 | 1열 | `[1fr_328px]` |
| S-01 등락 상위 | 탭 전환(`MoversTabs`) | 2열 병렬 | 2열 |
| S-02 본문/레일 | 1열 (레일이 본문 아래로) | `[1fr_292px]` | 〃 |
| S-03 3분할 | 세로 스택, 중앙이 `order-first` | `214px │ 1fr │ 252px` | 〃 |
| S-04 목록 | 카드(`WatchCard`) | 그리드 표(`WatchRow`) | 〃 |

모바일 전용 규칙 — 차트는 `-mx-4` 풀블리드 + 높이 220px, 검색 팔레트는 전체화면,
AI 드로어는 하단에서 올라오는 전체화면 시트다.

### 2.3 테마

| 항목 | 값 |
|---|---|
| 기본 | 에디토리얼 라이트 (종이 `#fdfbf6` / 잉크 `#1a1a17`) |
| 다크 | `[data-theme="terminal"]` (배경 `#0e1116` / 잉크 `#e8e3d8`) |
| 저장 | 쿠키. 루트 레이아웃이 서버에서 읽어 첫 HTML 의 `<html data-theme>` 에 담는다 |
| 전환 | 마스트헤드 `ThemeToggle` |

깜빡임과 하이드레이션 불일치가 없다 — 서버·클라이언트가 처음부터 같은 값을 본다.
S-03 콘솔 뷰는 서브트리에 `data-theme="terminal"` 을 직접 박아, `?view=console`
딥링크로 들어와도 첫 프레임부터 다크다. 전역 테마는 바꾸지 않는다.

### 2.4 디자인 토큰

전부 [globals.css](../src/app/globals.css) 에 있다. 2계층 구조다 — `:root` 원시 변수(SVG·차트가 직접
참조) + `@theme inline` Tailwind 매핑.

**색**

| 계열 | 토큰 | 용도 |
|---|---|---|
| 배경 | `--paper` `--surface` `--surface-hover` | 지면 · 패널 · 호버 |
| 전경 | `--ink` `--ink-2` | 본문 |
| 흐림 | `--muted-30` … `--muted-75` (9단계) | 보조 텍스트. opacity modifier 금지 |
| 선 | `--line-14` … `--line-35`, `--line-control` | 헤어라인 / 컨트롤 경계(3:1 보장) |
| 등락 | `--up: #c8352c` `--down: #1f57c3` | **상승 빨강 · 하락 파랑 (국내 관례)** |
| 반전 | `--on-ink-*` | `bg-ink` 위 전경 |
| 강조 | `--accent: #e8b04b` | 콘솔 액션 · 터미널 캐럿 |

다크 테마는 알파 램프를 통째로 올려 가장 낮은 단계도 WCAG AA(4.5:1)를 넘긴다 —
숫자 이름은 라이트와 짝을 맞추기 위한 것이지 알파 값이 아니다.

**타이포**

| 변수 | 서체 | 용도 |
|---|---|---|
| `--font-serif-kr` | Noto Serif KR | 종목명 · 헤드라인 · AI 답변 |
| `--font-sans-kr` | IBM Plex Sans KR | 본문 기본 |
| `--font-mono` | IBM Plex Mono | 라벨 · 숫자 · API 메모 |
| `--font-serif-en` | Instrument Serif | 영문 부제 |

`.num` 유틸이 모든 숫자에 mono + `tabular-nums` 를 강제한다 (표·가격·축 정렬).

**기하**

- **radius 0 이 기본.** `button/input/select/textarea` 의 브라우저 기본 라운드를 지운다.
  예외는 `.dot`(원형 마커 3곳)과 `.pill`(알림 토글)뿐이다.
- `--tap: 44px` — 터치 히트 영역 최소치 (WCAG 2.5.5 / iOS HIG).
- `--safe-b: env(safe-area-inset-bottom)` — 하단 고정 요소가 홈 인디케이터에 먹히지 않게.
- 검색 팔레트 기하는 `--pal-*` 로 테마별·뷰포트별로 통째로 갈아끼운다 (2.6 참고).

**모션**

`fadeUp` · `slideIn`(드로어) · `popIn`(팔레트) · `sheetUp`(모바일 시트) · `wfpulse`(스켈레톤) ·
`dotSpin`(스피너). `prefers-reduced-motion: reduce` 에서 전부 0.01ms 로 죽인다.

### 2.5 공통 상호작용

| 조작 | 결과 | 범위 |
|---|---|---|
| ⌘K / Ctrl+K | 검색 팔레트 토글 | 전역 (`SearchProvider`, 루트 레이아웃) |
| Esc | 팔레트 · AI 드로어 닫기 | 각 오버레이 |
| `:focus-visible` | 2px 잉크 아웃라인 + 2px 오프셋 | 전역 |

포커스는 팔레트를 닫을 때 열었던 자리로 되돌아간다.

---

## 3. S-01 · 시장 현황 (홈)

경로 `/` · [page.tsx](../src/app/page.tsx) · 서버 컴포넌트 · `export const dynamic = "force-dynamic"`

정적 프리렌더로 두면 `next build` 가 빌드 머신에서 백엔드에 접속해야 한다. 데이터
신선도는 fetch 단위 `revalidate` 가 책임지므로 실제 백엔드 호출은 여전히 주기적이다.

### 3.1 레이아웃

```
┌─ Masthead ─────────────────── 검색 · 테마 · [관심 종목] ─┐
├──────────────────────────────────────────────────────────┤
│ IndexCards   KOSPI │ KOSDAQ │ S&P 500 │ USD/KRW          │  4열(md) / 2열
├───────────────────────────────────┬──────────────────────┤
│ MorningBriefingBanner  (반전 배경) │ SectorBars   업종 등락 │
│  헤드라인 · ＋/－ 근거 · 관심 판단  │                      │
├───────────────────────────────────┤ TodayNews   오늘의 뉴스│
│ MoverList 상승률 │ MoverList 하락률│                      │
│  (모바일은 MoversTabs 로 탭 전환)  │ apiNotes  (10px 캡션) │
└───────────────────────────────────┴──────────────────────┘
                              xl:[1fr_328px]
```

### 3.2 구성 요소

| 요소 | 데이터 | 실/예시 | 비고 |
|---|---|---|---|
| `IndexCards` | `GET /markets/overview?category=home` | **실데이터** | 지수 4종 + 스파크라인(area) |
| `MorningBriefingBanner` | `getMorningBriefing()` | 예시 | ＋/－ 근거, 관심 종목 판단, `?ai=1` 링크 |
| `MoverList` ×2 | `getMovers()` | 실패 시 예시로 degrade | 순위 · 종목 · 스파크라인 · 가격 · 등락 |
| `MoversTabs` | 위와 동일 | 〃 | 모바일 전용 탭 |
| `SectorBars` | 목 데이터 | **예시** | 대응 API 없음 (업종 분류·집계 부재) |
| `TodayNews` | 목 데이터 | **예시** | 대응 API 없음 (뉴스는 종목 단위만 존재) |
| `apiNotes` | 서비스가 조립 | — | 어느 블록이 실데이터인지 문장으로 남긴다 |

예시 데이터 블록은 `SampleFrame` 으로 감싸 '예시' 틀을 씌운다. 실데이터로 바뀌면
`sampleSections` 에서 빠지고 틀도 사라진다 — 실데이터인 척하지 않는 것이 규칙이다.

### 3.3 상태

| 상태 | 화면 |
|---|---|
| 정상 | 위 레이아웃 |
| 등락 상위 조회 실패 | 예시 데이터로 대체 + '예시' 틀 + apiNotes 에 사유 |
| 렌더 예외 | E-02 `ErrorScreen` — "시장 현황을 불러오지 못했습니다" + 재시도 |

---

## 4. S-02 · 종목 상세 (에디토리얼 라이트)

경로 `/stocks/[symbol]` · [page.tsx](../src/app/stocks/[symbol]/page.tsx) → [EditorialView.tsx](../src/app/stocks/[symbol]/_components/EditorialView.tsx)

### 4.1 페이지 조립

페이지가 서버에서 세 도메인을 **병렬로** 부른다 — `features` 끼리는 직접 import 할 수
없으므로 조합은 `app/` 의 일이다.

```
Promise.all([ getStockDetail(symbol), getMarketOverview("home"), getWatchlist() ])
   │
   ├ status === "not-found" → E-04 SymbolNotResolved
   ├ status === "timeout"   → E-05 StockDetailUnavailable
   └ status === "ok"        → AdviceProvider
                                 └ ViewSwitch( editorial | console )
                                 └ AdviceDrawer (두 뷰가 공유, 하나만 마운트)
```

쿼리 파라미터:

| 파라미터 | 값 | 효과 |
|---|---|---|
| `view` | `console` | S-03 으로 시작 |
| `ai` | `1` | AI 드로어를 연 상태로 시작 (도착 즉시 SSE 시작) |
| `fallback` | `1` | 목 모드에서 폴백 판단 시퀀스를 강제 (개발용) |

### 4.2 레이아웃

```
┌─ Masthead ───────────── 검색 · 테마 · [CONSOLE] [AI 판단 열기] ─┐
├─────────────────────────────────────────────────────────────────┤
│ StockHeadline                                                   │
│   삼성전자 46px          │              72,500 원 44px          │
│   Samsung Electronics    │              ▲ +1,500 (+2.11%)       │
│   [005930.KS][KOSPI][반도체]                                    │
├──────────────────────────────────────┬──────────────────────────┤
│ ChartSection  748×344                │ MetricsRail  투자 지표    │
│  1M 3M 6M 1Y · 캔들 · MA20/MA60      │  (패널 배경, 6행)         │
│  · BB(20,2) · GC/DC · 거래량 19%     ├──────────────────────────┤
├──────────────────────────────────────┤ MarketOverviewList       │
│ DetailTabs                           ├──────────────────────────┤
│  [뉴스 3][애널리스트 리포트 3][재무]  │ ReportDigest             │
│  NewsList / ReportList / Financials  ├──────────────────────────┤
│                                      │ ApiNote                  │
└──────────────────────────────────────┴──────────────────────────┘
                                    md:[1fr_292px]
                        ─ 모바일: 하단 고정 [AI 판단 열기] 바 ─
```

### 4.3 구성 요소

| 요소 | 내용 | 데이터 출처 |
|---|---|---|
| `StockHeadline` | 종목명 32/46px · 영문명 · 칩(심볼·시장·섹터) · 가격 34/44px · `Delta` | `detail.ref` `detail.quote` |
| `ChartSection` | 섹션 라벨 + 레전드 + 차트. 데스크탑에만 "휠=확대 · 커서=시세" 안내 | `detail.candles` |
| `DetailTabs` | 뉴스 / 애널리스트 리포트 / 재무. 세 패널을 **서버에서 렌더**해두고 표시만 전환 | `detail.news` `detail.reports` |
| `MetricsRail` | `Metric[]` 을 그대로 나열 — 값은 백엔드가 만든 표시 문자열 | `detail.metrics` |
| `MarketOverviewList` | 지수 4종 요약 | `getMarketOverview("home")` |
| `ReportDigest` | 리포트 요약 (의견·목표가는 백엔드 확장 필요) | `detail.reports` |
| `ApiNote` | 소비한 백엔드 메서드 3줄 | `detail.apiNotes` |

**차트** ([StockChart.tsx](../src/features/stocks/components/StockChart.tsx)) — 이 화면의 예외적 클라이언트 컴포넌트다.

| 항목 | 사양 |
|---|---|
| 라이브러리 | `lightweight-charts` (캔버스) |
| 시리즈 | 캔들 · MA20(잉크 2px) · MA60(`--ma60` 2px) · 볼린저밴드 면 · 거래량(별도 pane, 높이 19%) |
| 마커 | 골든크로스 `GC`(캔들 아래, 빨강) / 데드크로스 `DC`(캔들 위, 파랑) |
| 프리셋 | 1M 22봉 · 3M 66봉(기본) · 6M 132봉 · 1Y 248봉 |
| 줌 | 휠 · 핀치. 표시 범위를 18~240봉으로 가둔다 |
| 툴팁 | 크로스헤어 이동 시 날짜·시고저종·거래량. 컨테이너 밖으로 넘지 않게 되민다 |
| 색 | 전부 CSS 변수에서 읽고, 테마가 바뀌면 차트를 재생성한다 |
| 빈 데이터 | "차트로 그릴 시세가 없습니다" 박스 |
| 배치 | 데스크탑 프리셋은 차트 우상단에 겹침 / 모바일은 차트 위 별도 행(44px 히트) |

### 4.4 상태

| 상태 | 화면 |
|---|---|
| 로딩 | E-01 — 2a 골격 그대로의 스켈레톤 (컨테이너 폭·패딩까지 동일) |
| 뉴스·리포트 실패 | 탭 라벨 `뉴스 0` + 빈 목록. 차트·지표는 정상 |
| 심볼 미해석 | E-04 |
| 시세 지연 | E-05 |
| 그 외 예외 | E-02 (세그먼트 `error.tsx`) |

---

## 5. S-03 · 종목 상세 (다크 터미널 콘솔)

경로 `/stocks/[symbol]?view=console` · [ConsoleView.tsx](../src/app/stocks/[symbol]/_components/ConsoleView.tsx)

S-02 와 **같은 데이터**를 3분할로 보여주는 대체 뷰다. 모든 라벨이 mono uppercase +
넓은 자간(`0.2em`)이다.

### 5.1 뷰 전환 방식

같은 라우트 + `?view=console` 이되, 두 레이아웃을 서버에서 한 번씩 렌더해두고
클라이언트에서 `hidden` 만 토글한다([ViewSwitch.tsx](../src/app/stocks/[symbol]/_components/ViewSwitch.tsx)).

- 전환에 네트워크 왕복이 **없다** (서버 `searchParams` 로 분기하면 매번 RSC 요청이 나간다)
- 진행 중인 AI SSE 스트림이 끊기지 않는다
- URL 은 `history.pushState` 로만 갱신 → 공유·뒤로가기 동작. `popstate` 도 따라간다
- 테마는 건드리지 않는다 — 콘솔 서브트리가 `data-theme="terminal"` 을 직접 들고 있다

### 5.2 레이아웃

```
┌ ConsoleTopBar  제호 · QUANT·DESK · 지수 티커 4종 · 검색 [EDITORIAL] [RUN AI] ┐
├────────────┬───────────────────────────────────────────┬───────────────────┤
│ WATCHLIST  │ ConsoleHeadline                           │ NEWS · 3          │
│  214px     │   삼성전자 25px  005930.KS · KOSPI        │  252px            │
│  종목 행    │                        72,500  38px ▲     │  제목 12.5px      │
│  (활성=앰버 ├───────────────────────────────────────────┤  매체 · 상대시각   │
│   틴트 +   │ ConsoleChart  MA20 MA60 BB(20,2) VOL      │                   │
│   좌측 보더)│   scroll=zoom  hover=ohlcv   높이 320     │ REPORTS · 3       │
│            ├───────────────────────────────────────────┤  매체 / 제목       │
│            │ MetricGrid  3열 × 2행 (모바일 2열)         │                   │
│ ─ UNIVERSE ├───────────────────────────────────────────┤                   │
│  n 종목    │ ConsoleFooter  api notes                  │                   │
└────────────┴───────────────────────────────────────────┴───────────────────┘
                            ─ 모바일: 하단 고정 [AI 판단 열기] (앰버) ─
```

| 영역 | 폭 | 내용 |
|---|---|---|
| 좌 `WatchRail` | 214px | 관심종목 목록 → 각 행이 `/stocks/{code}?view=console` 링크. 활성 행은 앰버 틴트 + 좌측 2px 보더. 하단 `mt-auto` 에 UNIVERSE(동기화 종목 수 · 소스) |
| 중앙 `main` | `flex-1` | 헤드라인 → 차트 → 지표 그리드 → 푸터. `md:border-x` |
| 우 `ContentRail` | 252px | 뉴스(제목 · 매체 · 상대시각) + 리포트. 링크 없는 기사는 앵커로 감싸지 않는다 |

모바일에서는 세로로 접히되 중앙 열이 `order-first` 다 — 워치리스트가 먼저 오면
정작 보러 온 종목이 한참 아래로 밀린다.

콘솔 화면에는 테마 토글이 없다. 즉 '콘솔 + 라이트' 는 UI 로 도달할 수 없는 상태다.

---

## 6. S-04 · 관심 종목

경로 `/watchlist` · [page.tsx](../src/app/watchlist/page.tsx) → [WatchlistBoard.tsx](../src/app/watchlist/_components/WatchlistBoard.tsx)

`features/watchlist`(표)와 `features/advice`(일괄 AI)를 함께 쓰므로 상태 소유자를
`app/<route>/_components/` 에 뒀다 (CONVENTIONS 예외 항목).

### 6.1 레이아웃 (데스크탑)

```
┌─ Masthead ─────────────────────────────── 검색 · 테마 ─┐
├────────────────────────────────────────────────────────┤
│ WatchlistHeader                                        │
│  관심 종목 Watchlist        [순서 편집][＋종목 추가]    │
│  n 종목 · n 그룹 · 알림 n건  [● 선택 n종목 AI 분석]     │
├────────────────────────────────────────────────────────┤
│ GroupTabs 전체│코어│2차전지│관찰│해외    SortControl ▾  │
├────────────────────────────────────────────────────────┤
│ TableHeader  □ │ 종목 │ 현재가 │ 등락률 │ 3개월 │ 보유·평단 │ 알림 │ AI 판단 │
│ WatchRow …    26px  1.6fr   108   104     116    122      1fr    96      │
├────────────────────────────────────────────────────────┤
│ BulkActionBar  (선택 ≥1 일 때만)  그룹 이동 · 알림 · 삭제│
└────────────────────────────────────────────────────────┘
```

컬럼 폭은 `WATCH_GRID` 상수 하나를 헤더와 데이터 행이 공유한다 — 어긋남 방지.

모바일은 `WatchCard` 2단 카드 + 하단 고정 액션 2개(`＋종목 추가` / `전체 AI 분석`).
헤더에는 하단 바에 대응이 없는 `순서 편집`만 남긴다 — 같은 동작을 한 화면에 두 번
띄우지 않는다.

### 6.2 행 구성 (`WatchRow`)

| 셀 | 내용 |
|---|---|
| 26px | 선택 체크박스. **순서 편집 모드**에서는 드래그 핸들로 교체 |
| 종목 | 종목명(상세 링크) + 그룹 배지 / 심볼 · 영문명 |
| 현재가 | 해외는 `$` + 소수 2자리, 국내는 원화 포맷 |
| 등락률 | `Delta` 컴포넌트가 색·부호를 단독 소유 |
| 3개월 | `Sparkline` 104×28 |
| 보유·평단 | 수량 · 평단 + 평가손익률. 보유가 없으면 "관심만" (대시로 채우지 않는다) |
| 알림 | `AlertToggle`(pill) + `AlertCondition`(자유 텍스트) |
| AI 판단 | `VerdictCell` — 진행 단계 / 판단 문구 / 오류 |

### 6.3 상호작용

| 조작 | 동작 | 제약 |
|---|---|---|
| 그룹 탭 | 클라이언트 필터 | — |
| 정렬 | 직접 정렬 · 등락률 · 종목명 · 평가손익 | — |
| 순서 변경 | `@dnd-kit` 드래그 (포인터 4px 임계 · 키보드 센서) | **`순서 편집` + `직접 정렬`** 둘 다일 때만 핸들이 뜬다 |
| 선택 → AI 분석 | 선택 종목만 SSE 스트림 | 동시 3개까지 (`MAX_CONCURRENT`) |
| 전체 AI 분석 | 현재 보이는 목록 전체 | 〃 |
| 삭제 | 로컬 상태에서 제거 | 저장소 없음 |
| 그룹 이동 · 알림 일괄 | 안내 문구만 표시 | 백엔드 저장소 필요 |

정렬이 걸린 상태에서 순서 편집을 켜면 "정렬이 걸려 있는 동안에는 순서를 바꿀 수
없습니다" 안내가 뜬다 — 화면 순서와 저장 순서가 달라 의도치 않은 재배치가 되기 때문이다.

일괄 분석은 전체 진행률이 아니라 **행마다 자기 단계**를 보여준다. 종목당 LLM 4회라
오래 걸리고, 먼저 끝난 종목부터 판단이 뜨는 편이 낫다.

### 6.4 상태

| 상태 | 화면 |
|---|---|
| 빈 목록(전체) | "관심 종목이 없습니다. ⌘K 검색에서 ⇥ 로 추가하세요." |
| 빈 목록(그룹) | "'{그룹}' 그룹에 종목이 없습니다." |
| 분석 중 | 헤더 버튼 "AI 분석 중" · 하단 바 "분석 중 n" · 행별 단계 |

> **데이터 출처 주의** — `getWatchlist()` 는 현재 목 데이터를 반환한다. 그룹·순서·보유·
> 알림은 사용자 소유 데이터라 백엔드 저장소가 새로 필요하다 (9장).

---

## 7. O-01 · 검색 팔레트

[SearchPalette.tsx](../src/features/search/components/SearchPalette.tsx) · 클라이언트 · 열렸을 때만 마운트된다(닫혀 있는 동안 폴링·요청 0).

### 7.1 레이아웃

```
        ┌─────────────────────────────────────────────────┐  ← 백드롭 클릭 시 닫힘
        │ [모바일 전용] 제호                        취소  │
        ├─────────────────────────────────────────────────┤
        │ ⌕  종목명 · 코드 · 초성            [한글][코드] ✕│  입력 25px serif
        ├─────────────────────────────────────────────────┤
        │ 종목명 · 초성 일치        search_listed_companies│  그룹 헤더
        │  삼성전자  ★        [KOSPI]  005930.KS  ∿  72,500│  행
        │  ...                                            │
        │ 최근 검색 / 코드 · 티커 일치                     │
        ├─────────────────────────────────────────────────┤
        │ ◌ 상장사 목록을 처음 준비하는 중 · 1,204/2,847   │  DelayBanner
        │ ⚠ KIND 폴백                                     │  SourceFallbackBanner
        ├─────────────────────────────────────────────────┤
        │ ↑↓ 이동  ⏎ 선택  ⇥ 관심 추가  esc 닫기  결과 8건·0.42s│
        └─────────────────────────────────────────────────┘
              772px(라이트) / 788px(터미널) · 모바일 전체화면
```

지연·폴백 배너는 스크롤 영역 **밖**에 있다. 안쪽에 두면 결과가 몇 줄만 차도 밀려
사라지는데, 이 배너는 "왜 느린지"를 설명하는 자리라 그때 가장 필요하다.

### 7.2 입력 문법

| 접두어 | 범위 | 예 |
|---|---|---|
| (없음) | 통합 | `삼성` |
| `>` | 이름 · 초성 | `>삼성` |
| `:` | 6자리 코드 | `:005930` |
| `@` | 해외 티커 | `@AAPL` |

모드 칩(한글 / 코드 / 초성)은 **쿼리에서 도출**한다 — 사용자가 고르는 값이 아니다.
초성만 입력하면 `초성 ㅅㅅㅈㅈ` 처럼 실제 초성을 라벨에 노출한다.

### 7.3 키보드

| 키 | 동작 | 비고 |
|---|---|---|
| ↑ ↓ | 그룹을 가로질러 이동 (순환) | 활성 행을 자동 스크롤 |
| Home / End | 처음 / 마지막 | |
| ⏎ | 선택 → `/stocks/{code}` | 최근 검색에 기록 |
| ⌥⏎ | 상세 + AI 드로어 (`?ai=1`) | **터미널 테마 전용** |
| ⇥ | 관심 종목 토글 | 포커스 트랩 역할도 겸한다 |
| esc | 닫기 | 포커스 복원 |

한글 IME 조합 중의 ⏎ 는 한글 확정이므로 선택으로 처리하지 않는다
(`compositionstart/end` 로 가드).

### 7.4 데이터

| 항목 | 사양 |
|---|---|
| 요청 | `GET /api/stocks/suggestions?q&scope&mode&recent` (BFF) |
| 디바운스 | 200ms |
| 캐시 | React Query `staleTime` 5분 · `gcTime` 10분 · `keepPreviousData` |
| 상태 폴링 | `GET /api/stocks/listed-companies` 2초 간격, `ready` 가 되면 중단(이후 5분 staleTime) |
| 204 응답 | 배너를 숨길 뿐 검색은 정상 동작 |

### 7.5 상태

| 상태 | 화면 |
|---|---|
| 초기(입력 없음) | "종목명 · 6자리 코드 · 초성 · 해외 티커로 검색하세요." |
| 검색 중 | 3줄 스켈레톤 (자리를 비워두지 않는다) |
| 결과 없음 | "'{쿼리}'와 일치하는 종목이 없습니다." |
| 목록 준비 중 | `DelayBanner` — 스피너 + `1,204 / 2,847 종목` + 백엔드 메서드명 |
| KIND 폴백 | `SourceFallbackBanner` + 배너에 "· KIND 폴백" |

터미널 테마에서는 같은 배너가 `ensure_listed_companies … 1204 / 2847 sync` 처럼
mono 문자열로 바뀐다.

---

## 8. O-02 · AI 종합 판단 드로어

[AdviceDrawer.tsx](../src/features/advice/components/AdviceDrawer.tsx) · 클라이언트 · S-02 와 S-03 이 **같은 인스턴스**를 공유한다

두 뷰가 동시에 렌더돼 있으므로 드로어를 각 뷰 안에 두면 SSE 스트림이 둘로 갈라진다.
그래서 `fixed` 로 컨테이너 밖에 하나만 둔다.

### 8.1 레이아웃

```
                            ┌──────────────────────────────┐
                            │ AI 종합 판단              ✕ │
                            │ 3 AGENTS → 1 DECISION        │
                            ├──────────────────────────────┤
                            │ 3개 에이전트 의견 생성 · 3/4 ◌│  AdviceProgress
                            │ ▓▓▓▓▓▓▓▓▓▓▓░░░░░  (3px)      │
                            ├──────────────────────────────┤
                            │ AI 분석은 시간이 걸립니다     │
                            │ ┌ 01 AI 저널리스트 Journalist┐│  AgentCard ×3
                            │ │  요약 3문장               ││  (도착 순)
                            │ └───────────────────────────┘│
                            │ ┌ 스켈레톤 (판단 도착 전) ──┐│
                            │ ┌ FINAL DECISION ──────────┐│  반전 배경
                            │ │ 매수 가능 34px  신뢰도 76%││
                            │ │ ▮▮▮▮▮ ▯ ▯   (5칸 미터)   ││
                            │ │ 답변 (serif 13.5/1.75)    ││
                            │ │ ＋ 매수 조건 / － 리스크   ││
                            │ └───────────────────────────┘│
                            └──────────────────────────────┘
                              데스크탑 우측 438px · 모바일 전체화면 시트
```

### 8.2 진행 표시

`stage` 는 '끝난 단계 수'이고 라벨은 '지금 하는 단계'를 말한다 → `stage + 1` 을 읽는다.

| stage | 라벨 |
|---:|---|
| 1 | 주가 데이터 조회 · 1/4 단계 |
| 2 | 뉴스·리포트 수집 · 2/4 단계 |
| 3 | 3개 에이전트 의견 생성 · 3/4 단계 |
| 4 | 최종 판단 종합 · 4/4 단계 → 완료 시 "분석 완료 · 4/4 단계" |

진행은 되감기지 않는다 — 에러 이벤트는 `stage: 0` 으로 오는데 그대로 반영하면
3/4 까지 찬 바가 0 으로 튄다 (`Math.max` 로 고정).

에이전트 카드 3장이 다 차도 최종 판단 LLM 호출이 남아 있으므로, **판단이 도착할
때까지** 스켈레톤이 자리를 지킨다.

### 8.3 구성 요소

| 요소 | 내용 |
|---|---|
| `AgentCard` | 순번 `01` · 에이전트명 · 영문 부제 · 요약. `status==="fallback"` 이면 "실패" 배지 |
| 성향 배지 | `stance`(긍정·중립·부정). LLM 구조화 출력에서 오며 폴백 의견에는 없다 |
| 근거 목록 | `sources[]` — RAG 로 검색·인용된 문서 제목(+출처). URL 이 있으면 새 탭 링크 |
| `FinalDecision` | 판단 라벨 34px · 신뢰도(5칸, 20%p 단위) · 답변 · ＋매수조건/－리스크 · 면책 |
| 규칙 기반 배지 | `source === "fallback"` 일 때 점선 테두리 + "규칙 기반 판단" + 재시도 버튼 + `fallback_decision` 캡션 |
| 오류 블록 | 판단 없이 에러만 온 경우 "AI 분석을 불러오지 못했습니다" + 재시도 |

### 8.4 데이터 흐름

```
드로어 open ──▶ useAiAdvice ──▶ POST /api/stocks/advice  (BFF)
                                       │
                                       └▶ POST /stocks/advice/stream (FastAPI SSE)
                                          snake_case → camelCase 변환 후 재방출
```

- `enabled`(=열림)가 true 가 되는 순간 1회 실행, 닫으면 `AbortController` 로 중단
- 재시도는 `attempt` 카운터를 올려 같은 스트림을 새로 연다
- BFF 가 스트림을 열기도 전에 실패하면 `stage: 0` 이벤트 하나를 만들어 보낸다 —
  드로어가 항상 에러 상태를 그릴 수 있다
- AI 타임아웃은 별도 값(`STOCK_AI_TIMEOUT_MS`, 기본 300초)

### 8.5 진입점

| 위치 | variant | 표시 |
|---|---|---|
| S-02 마스트헤드 (≥768) | `editorial` | `● AI 판단 열기/닫기` (잉크 배경) |
| S-03 상단 바 (≥768) | `console` | `RUN AI ⏎` (앰버) |
| 모바일 (<768) | `bar` | 하단 고정 `● AI 판단 열기`. 시트가 열리면 내려간다 |
| 검색 팔레트 | ⌥⏎ | `?ai=1` 로 이동 |
| 홈 브리핑 | 링크 | `/stocks/{code}?ai=1` |

모바일 탭바의 AI 탭은 **비활성**이다 — 종목 컨텍스트가 있어야 열 수 있으므로
"AI 판단은 종목 상세에서 열 수 있습니다" 안내만 한다.

---

## 9. 상태 화면 (E-01 ~ E-05)

| ID | 트리거 | 화면 | 파일 |
|---|---|---|---|
| E-01 | 종목 상세 세그먼트 전환 | 2a 골격 스켈레톤 — 컨테이너 폭·패딩·차트 높이(220/344)까지 실제 화면과 동일 | [stocks/[symbol]/loading.tsx](../src/app/stocks/[symbol]/loading.tsx) |
| E-02 | 렌더 예외 | `ErrorScreen` — 제목 · 설명 · digest · 재시도 · 백엔드 메서드 캡션 | `error.tsx` (루트 · 상세 · 관심종목) |
| E-03 | 미매칭 URL | `NotFoundScreen` — 요청 경로 · 목적지 3개(시장 현황/관심 종목/종목 상세) · 종목 후보. 탭바는 어느 탭도 활성이 아님 | [not-found.tsx](../src/app/not-found.tsx) |
| E-04 | `normalize_stock_code` 실패 | 입력 문자열을 34px 로 남기고 "아래 후보 중에서 골라 주세요" + 후보 목록 | [SymbolNotResolved.tsx](../src/app/stocks/[symbol]/_components/SymbolNotResolved.tsx) |
| E-05 | 상류 타임아웃 | "시세 응답 지연" 캡션 + `StockDetailUnavailable` | [StockDetailUnavailable.tsx](../src/app/stocks/[symbol]/_components/StockDetailUnavailable.tsx) |

E-04 를 `notFound()` 로 보내지 않는 이유: 사용자가 입력한 문자열을 화면에 남겨야
"이걸 못 찾았고 대신 이런 후보가 있다"를 말할 수 있는데 `not-found.tsx` 는 그 값을
받지 못한다.

E-05 는 예외를 던지지 않으므로 렌더가 살아 있다 — 빈 화면이나 크래시가 아니라
마스트헤드가 있는 정상 지면 위에 안내가 인라인으로 뜬다.

---

## 10. 데이터 흐름

### 10.1 경로

```
서버 컴포넌트 ──▶ features/*/services ──▶ lib/api ──▶ FastAPI (/api/v1)
                                                        ▲
브라우저(클라이언트) ──▶ app/api/* (BFF) ───────────────┘
```

**브라우저는 FastAPI 를 직접 호출하지 않는다.** 백엔드 주소·키를 노출하지 않기 위해
클라이언트 컴포넌트는 반드시 BFF 라우트를 경유한다. `API_BASE_URL` 은 `NEXT_PUBLIC_`
접두사 없이 서버 전용이다.

| 소비자 | 경로 | 대상 |
|---|---|---|
| S-01 지수 | 서버 | `GET /markets/overview?category=home` |
| S-02 주가 | 서버 | `GET /stocks/history?symbol&limit=504&include_content=false` |
| S-02 콘텐츠 | 서버 | `GET /stocks/content?symbol=` (history 응답의 심볼) |
| O-01 자동완성 | BFF | `GET /api/stocks/suggestions` → `GET /stocks/suggestions` |
| O-01 준비 상태 | BFF | `GET /api/stocks/listed-companies` → `GET /stocks/listed-companies` |
| O-02 AI 판단 | BFF | `POST /api/stocks/advice` → `POST /stocks/advice/stream` (SSE) |

주가와 콘텐츠를 나눠 부르는 이유는 백엔드 측정치다 — 콘텐츠가 응답 시간의 약 95%라
함께 받으면 차트가 뉴스를 기다린다. 콘텐츠 조회 실패는 빈 목록으로 흡수한다.

### 10.2 캐시

| 대상 | 주기 | 근거 |
|---|---|---|
| 시세 (장중 09:00~15:40 KST 평일) | 60초 | 값이 계속 움직인다 |
| 시세 (장외·주말) | 900초 | 다음 개장까지 고정 |
| 종목 메타·콘텐츠 | 3600초 | 시세와 무관 |
| 자동완성 · 준비 상태 | `no-store` | 클라이언트 캐시(React Query)가 담당 |

장 판정은 `Intl.DateTimeFormat` 에 `timeZone: "Asia/Seoul"` 을 명시해 서버 타임존에
의존하지 않는다. 공휴일 캘린더는 두지 않는다.

### 10.3 목 모드

`USE_MOCK=1` 이면 서비스가 `features/*/model/mock.ts` 를 반환하고, AI BFF 는 고정
타이밍 시퀀스를 흘린다. 백엔드 없이 화면·스크린샷·회귀를 확인하는 용도다.

### 10.4 클라이언트 상태

| 상태 | 저장소 | 범위 |
|---|---|---|
| 테마 | 쿠키 | 전역 (SSR 반영) |
| 검색 팔레트 열림 | `SearchProvider` context | 전역 |
| 최근 검색 · 관심 코드 | `localStorage` (`store/`) | 전역 |
| 상세 뷰(2a/2b) | `ViewSwitch` state + URL | 라우트 |
| AI 드로어 열림 | `AdviceProvider` context | 라우트 |
| 관심종목 표(선택·정렬·순서) | `WatchlistBoard` state | 화면 |
| 서버 데이터 캐시 | React Query | 전역 |

---

## 11. 접근성

| 항목 | 구현 |
|---|---|
| 터치 타깃 | `--tap: 44px` — 탭바·행·버튼·차트 프리셋에 `min-h/min-w` 적용 |
| 포커스 | `:focus-visible` 2px 잉크 아웃라인. 팔레트 닫을 때 원래 자리로 복원 |
| 팔레트 | `role="dialog" aria-modal` + `combobox`/`listbox`/`option` + `aria-activedescendant`. 배경 스크롤 잠금 |
| 탭 | `role="tablist"` + ← → 키 이동 + `tabIndex` 롤링 (DetailTabs · MoversTabs) |
| 표 | CSS 그리드라 표 구조가 없어 `role="table"/"row"/"cell"` + `aria-rowcount` 로 알린다 |
| 진행 | `role="progressbar"`(AI 단계) · `role="meter"`(신뢰도) · `role="status" aria-live="polite"` |
| 대비 | 다크 테마의 muted 램프를 통째로 올려 최저 단계도 4.5:1. 컨트롤 경계는 `--line-control` 로 3:1 (WCAG 1.4.11) |
| 모션 | `prefers-reduced-motion` 에서 모든 애니메이션 0.01ms |
| 링크 | 링크 없는 뉴스는 앵커로 감싸지 않는다 (`href=""` 는 현재 문서 재요청) |

---

## 12. 미구현 · 백엔드 확장 필요

화면은 있으나 실데이터가 없는 항목이다. 전부 코드 주석에 근거가 남아 있다.

| 화면 | 항목 | 필요한 것 |
|---|---|---|
| S-01 | 업종 등락 | 업종 분류·집계 API |
| S-01 | 오늘의 뉴스 | 시장 단위 뉴스 API (현재는 종목 단위만) |
| S-01 | AI 아침 브리핑 | 브리핑 생성 API |
| S-02 | 재무 탭 | 화면 설계 + 재무 API (현재 "아직 설계되지 않았습니다") |
| S-02 | 리포트 의견·목표가 | `AnalystReport` 에 `opinion`/`targetFrom`/`targetTo` 확장 |
| S-04 | 관심종목 전체 | `GET /watchlist`, `PATCH /watchlist/order`, `PATCH /watchlist/{code}/alert`, `DELETE /watchlist/{code}` |
| O-01 | 후보 시세·영문명 | `/stocks/suggestions` 응답 확장 또는 시세 병합 |
| 전역 | 로그인 | NextAuth v5 배선만 있고 `providers` 가 비어 있다 — 현재 모든 경로 공개 |

검색 팔레트의 ⇥(관심 추가)는 지금 `localStorage` 에만 쌓인다. 관심종목 저장소가
생기면 두 경로를 하나로 합친다.

---

## 13. 검증

```bash
cd front && npx tsc --noEmit && npm run lint && npm run build
```
