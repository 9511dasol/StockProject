# 핸드오프: 주식 AI 분석 화면 (Next.js 이식용)

## 개요
KRX/해외 종목을 검색하고, 주가·뉴스·애널리스트 리포트를 보고, 멀티 에이전트 LLM(저널리스트/경제학자/애널리스트 → 종합 판단)의 결과를 확인하는 서비스의 화면 설계입니다.
백엔드 명세 6.1~6.4(종목 코드 정규화, 상장사 목록 구축, 주가·뉴스·리포트, 투자 지표와 AI 판단)에 대응하는 프론트엔드 화면 전체가 들어 있습니다.

## 이 번들의 파일에 대해
`Stock AI Wireframes.dc.html` 은 **HTML로 만든 디자인 레퍼런스**입니다. 프로덕션 코드가 아니고, 그대로 복사해 쓰는 것을 전제로 하지 않습니다.
목표는 이 HTML이 보여주는 레이아웃·타이포·상태·인터랙션을 **대상 Next.js 프로젝트의 기존 환경(App Router, Tailwind 또는 기존 CSS 방식, 기존 컴포넌트 라이브러리)으로 다시 구현**하는 것입니다.
파일은 브라우저에서 바로 열립니다. 캔버스를 위/아래로 스크롤하면 턴 1~4가 쌓여 있고, 각 옵션에 `1a`, `2a` … 같은 ID 배지가 붙어 있습니다.

## 충실도
- **턴 2·3·4 = 하이파이.** 색·타이포·여백·인터랙션이 최종안 수준입니다. 픽셀 단위로 재현해 주세요.
- **턴 1 = 로우파이 와이어프레임.** 구조와 예외 경로(폴백/지연 상태)만 참고하고, 스타일은 하이파이 안을 따릅니다.
- 구현 기준은 **턴 2의 `2a`(에디토리얼 라이트)** 를 메인 테마로, `2b`(다크 터미널)를 선택적 테마로 봅니다. `2c`는 마케팅/리포트용 대안입니다.

## 화면 목록과 라우트 제안

| 화면 | 디자인 ID | 라우트 제안 |
|---|---|---|
| 시장 개요 홈 | 3b | `/` |
| 종목 검색 · 자동완성 (오버레이) | 3a (라이트) / 4a (다크) | 전역 `⌘K` 오버레이 + `/search?q=` |
| 종목 상세 (차트·지표·뉴스·리포트) | 2a / 2b / 2c | `/stocks/[symbol]` |
| AI 판단 (드로어/레일/모달) | 2a / 2b / 2c | `/stocks/[symbol]?ai=1` (URL 상태로 열기) |
| 관심종목 관리 | 4b | `/watchlist` |
| 상태·폴백 (로딩/실패) | 1d | 각 화면의 loading.tsx / error.tsx |

각 화면은 데스크탑(1180px 폭 기준 컨테이너)과 모바일(390px 프레임) 두 벌이 나란히 있습니다. 모바일 프레임의 검은 베젤은 디자인 표현일 뿐이므로 구현 대상이 아닙니다.

---

## 1. 시장 개요 홈 (3b)
**목적:** 지수 스냅샷 → AI 아침 브리핑 → 등락 상위 → 업종 등락 순으로 하루를 파악.

**레이아웃 (데스크탑)**
- 컨테이너 폭 1180px, 패딩 `26px 32px 30px`, 섹션 간 `gap: 22px` (flex column).
- 마스트헤드: `justify-content: space-between`, 하단 `border-bottom: 2px solid #1a1a17`, 패딩 하단 12px. 좌측 = 제목 + 날짜 캡션, 우측 = 검색 필드(250px) + '관심 종목' 버튼.
- 지수 카드: `grid-template-columns: repeat(4,1fr)`, `gap:1px`, 그리드 배경 `rgba(26,26,23,.16)` (= 1px 헤어라인 구분선 트릭), 각 카드 `background:#fdfbf6; padding:16px 18px 12px`.
- 본문: `grid-template-columns: 1fr 328px; gap: 26px; align-items: start`.
  - 좌: AI 브리핑 배너(`background:#1a1a17`, 패딩 `22px 24px`, 내부 2열 flex, 우측 열 196px) → 상승/하락 상위 2열(`1fr 1fr; gap:26px`).
  - 우: 업종 등락 바 리스트 → 오늘의 뉴스(`background:#f4efe4; padding:16px`) → API 메모.
- 리스트 행: `display:flex; align-items:center; gap:12px`, 하단 `1px dotted rgba(26,26,23,.2)`, 행 내부는 [순번 14px] [종목명/코드 flex:1] [스파크라인 76×24] [가격/등락률 우측 정렬].

**모바일**: 지수 2×2 그리드 → 브리핑 카드 → 상승률/하락률/거래량 탭 → 업종 바 → 하단 탭바(홈/검색/관심/AI, 높이 패딩 `11px 12px 22px`).

## 2. 검색 · 자동완성 (3a 라이트 / 4a 다크)
**목적:** 한글명·초성·6자리 코드·해외 티커를 한 입력창에서 처리.

- 데스크탑은 커맨드 팔레트 오버레이: 배경 `rgba(26,26,23,.22)`, 패널 폭 772px, 상단 여백 64px, 패널 테두리 `1px solid #1a1a17`, 그림자 `0 28px 70px rgba(26,26,23,.28)`, 등장 애니메이션 `popIn .28s cubic-bezier(.2,.8,.2,1)` (opacity 0→1, scale .97→1, translateY 8→0).
- 입력 행: 높이 패딩 `18px 22px`, 하단 `2px solid #1a1a17`. 쿼리는 25px Noto Serif KR. 캐럿은 2×24px 블록, `wfpulse 1.05s infinite` (opacity .35↔1).
- 입력 모드 칩: 한글 / 초성 ㅅㅅ / 코드 — 활성 칩만 `background:#1a1a17; color:#fdfbf6`.
- 결과는 3개 그룹: **이름·초성 일치** / **최근 검색** / **코드·해외 티커**. 그룹 헤더 `background:#f4efe4`, 10.5px mono, `letter-spacing:.16em`, uppercase. 헤더 우측에 대응 백엔드 메서드명을 회색 캡션으로 노출(개발 참고용, 프로덕션에서는 제거 가능).
- 결과 행: [종목명(매칭 구간 `background: rgba(200,53,44,.16)` 하이라이트) + 영문명] [시장 칩] [정규화된 심볼 82px 우측정렬] [스파크라인 92×26] [가격 14px / 등락률 11px]. hover `background:#f7f2e6`.
- 첫 호출 지연 배너: 스피너(11px, `dotSpin .8s linear infinite`) + "상장사 목록을 처음 준비하는 중입니다 · 2,318 / 2,614 종목". 명세의 `ensure_listed_companies` 지연을 사용자에게 설명하는 자리입니다. **반드시 구현하세요.**
- 하단 키 힌트 바: ↑↓ 이동 / ⏎ 선택 / ⇥ 관심 추가 / esc 닫기 + 결과 수·소요 시간.
- 다크 버전(4a)은 같은 구조에 프리픽스 문법을 노출: `>` 이름, `:` 코드, `@` 해외 티커. 하이라이트 색은 앰버 `#e8b04b`, 키 힌트는 대문자 mono(`⌥⏎ RUN AI` 포함).
- 모바일: 전체 화면. 상단 입력 + '취소', 시장 필터 칩(전체/코스피/코스닥/해외), 그룹 리스트, 하단에 지연 안내 + 키보드 영역.

## 3. 종목 상세 (2a 메인)
- 헤드라인 블록: 좌측 종목명 46px Noto Serif KR 700 (`letter-spacing:-.02em`), 영문 상호 15px Instrument Serif, 칩 3개(정규화 심볼 / 시장 / 섹터 — 마지막 칩은 반전). 우측 현재가 44px IBM Plex Mono 500 + 등락 15px + 색상 관례 캡션.
- 본문 `grid-template-columns: 1fr 292px; gap:28px`.
  - 차트: 748×344, 위에 섹션 라벨 + "휠 = 기간 확대/축소 · 커서 = 시세 확인" 힌트, 아래 레전드(MA20 실선 #1a1a17 / MA60 #b8a98a / BB 밴드 면 / 골든·데드크로스 마커).
  - 탭: 뉴스 3 / 애널리스트 리포트 3 / 재무. 활성 탭만 `border-bottom:2px solid #1a1a17`.
  - 뉴스 행: [순번] [제목 16.5px Noto Serif KR + 출처·시각 mono 10.5px] [썸네일 84×58 플레이스홀더]. 실제 서비스에서는 og:image 사용.
  - 우측 레일: 투자 지표(`background:#f4efe4`, 6행 라벨/값), 시장 개요 4행, 리포트 요약 3건, API 메모.
- 2b(다크 터미널)는 같은 정보를 3분할로: 좌 워치리스트 214px / 중앙 차트 + 3열 지표 그리드 / 우 뉴스·리포트 252px. 모든 라벨 9.5px mono uppercase `letter-spacing:.14~.2em`.
- 2c(매거진)는 좌 404px 히어로(종목명 62px 2줄, 등락률 54px, 요약 문단 15px/1.85) + 우 영역 차트 660×292 + 뉴스 3열.

## 4. AI 판단
세 가지 노출 방식이 있습니다. 하나만 고르세요(권장: 2a 드로어).
- **2a 드로어**: 우측에서 슬라이드. 폭 438px, `background:#f4efe4`, `border-left:2px solid #1a1a17`, `box-shadow:-24px 0 60px rgba(26,26,23,.14)`, `slideIn .32s cubic-bezier(.2,.8,.2,1)` (translateX 26px→0).
- **2b 레일**: 폭 452px, `background:#131820`, 좌측 보더 앰버, 상단에 타임스탬프 로그(`15:31:02 fetch_stock_history … 240 bars ok`), 최종 판단에 신뢰도 스코어 바 3개(기술적/뉴스 톤/거시).
- **2c 모달**: 중앙 모달, 백드롭 `rgba(18,16,14,.34)` + `backdrop-filter: blur(3px)`, 3열 에이전트 대조 + 하단 좌(최종 판단 46px) / 우(합의·이견 표 380px).

**진행 표시 (필수)** — 명세상 LLM 다중 호출로 오래 걸립니다.
4단계: `주가 데이터 조회 → 뉴스·리포트 수집 → 3개 에이전트 의견 생성 → 최종 판단 종합`.
- 라벨 형식: `{단계명} · {n}/4 단계`, 완료 시 `분석 완료 · 4/4 단계`.
- 진행 바 높이 3px, 트랙 `rgba(26,26,23,.14)`, 채움 `#1a1a17`, `transition: width .4s ease`.
- 에이전트 카드는 완료되는 순서대로 하나씩 append, 각 카드 `fadeUp .34s ease both` (opacity 0→1, translateY 10px→0). 아직 생성 중인 자리에는 3줄 스켈레톤(`wfpulse` 1.2s, delay 0/.2/.4s).
- 최종 판단 블록: 라벨 `FINAL DECISION` → 판단 34px Noto Serif KR + 신뢰도 % → 5칸 신뢰도 인디케이터(채움 3칸 `#c8352c`) → 요약 문단 → 근거 3줄(＋/－ 기호, －는 파랑 `#9dbcf5`) → 면책 문구.
- 프로토타입 타이밍(참고): 650 / 1250 / 1900 / 2700ms. 실제로는 서버 스트리밍(SSE 또는 Vercel AI SDK `streamUI`)에 연결하세요.
- `fallback_decision`(LLM 실패) 상태는 같은 블록에 "규칙 기반 판단" 배지 + '다시 시도' 버튼으로 표시 (와이어프레임 1d 참고).

## 5. 관심종목 관리 (4b)
- 헤더: 제목 28px + `18 종목 · 5 그룹 · 알림 7건 활성` 캡션, 우측 [순서 편집] [＋ 종목 추가] [선택 3종목 AI 분석(반전 버튼)].
- 그룹 탭 칩 + 정렬 드롭다운 + 평가손익 합계.
- 테이블 그리드: `26px 1.6fr 108px 104px 116px 122px 1fr 96px` — [드래그 핸들 ⠿] [종목명+그룹 칩+코드/영문] [현재가] [등락률] [3개월 스파크 104×28] [보유·평단/평가손익] [알림 토글 + 조건] [AI 판단].
- 행 hover `#f7f2e6`, 구분선 `1px dotted rgba(26,26,23,.22)`. 토글은 26×15px pill, ON일 때 `#1a1a17`.
- 하단 일괄 작업 바(`background:#f4efe4`): 선택 개수 + 그룹 이동 / 알림 일괄 설정 / 삭제.
- 모바일: 2단 카드 행(1단 = 이름·스파크·가격, 2단 = 보유·알림·AI 판단), 하단 고정 [＋ 종목 추가] [전체 AI 분석].
- 순서 편집은 `@dnd-kit/sortable` 권장(드래그 핸들만 잡히도록 `useSortable({ handle: true })`).

---

## 인터랙션 & 상태

### 차트 (직접 구현했음 — 동작 사양)
프로토타입은 의존성 없이 SVG로 그렸습니다. Next.js에서는 `lightweight-charts`(권장, 캔들+MA+거래량에 최적) 또는 `visx`/`recharts`로 재구현하되 아래 동작을 유지하세요.
- 캔들(OHLC) + 거래량 서브차트(차트 높이의 19%, opacity .3) + MA20/MA60 라인 + 볼린저밴드(20,2) 밴드 면.
- 골든/데드크로스 지점에 `GC`/`DC` 마커(원 + 라벨), 상승 교차 빨강 / 하락 교차 파랑.
- 커서 이동 시 십자선 + 툴팁(날짜, 시/고/저/종, 거래량 M 단위). 툴팁은 `#1a1a17` 배경 / `#fdfbf6` 텍스트, mono 10.5px.
- 마우스 휠로 표시 기간 확대/축소(18~240 바), 우상단에 1M/3M/6M/1Y 프리셋 버튼.
- 가격 축은 우측 4~5 티커, 실선/점선(`2 4`) 그리드.
- 스파크라인은 리스트용 초소형 라인(면 채움 opacity .1 옵션).

### 상태 (클라이언트)
- `searchQuery`, `searchMode`('name'|'code'|'ticker'), `listedCompaniesReady`(첫 동기화 여부 → 지연 배너), `recentSearches`(로컬 저장).
- `selectedSymbol`, `chartRange`, `chartHoverIndex`, `detailTab`('news'|'reports'|'financials').
- `aiOpen`(URL 쿼리 동기화 권장), `aiStage`(0~4), `agentResults[]`, `decision`, `decisionSource`('llm'|'fallback').
- `watchlist`(그룹, 순서, 알림 조건, 보유·평단), `selectedRows`.

### 데이터 페칭 (명세 매핑)
- 상세: `fetch_stock_history_from_yfinance`(OHLCV·MA·BB·교차), `fetch_stock_news`(최대 3), `fetch_analyst_reports`(최대 3), `build_stock_metrics`.
- 홈: `fetch_market_overview_from_yfinance`(카테고리별 현재값·변동률·차트).
- 검색: `normalize_stock_candidates`, `get_initial_consonants`, `get_common_stock_name`, `normalize_stock_code`, `krx_symbol_to_yfinance`, `ensure_listed_companies`.
- AI: `generate_stock_advice` → `invoke_stock_agent`×3 → `invoke_decision_agent`, 실패 시 `fallback_decision`.
- 권장: 상세·홈은 서버 컴포넌트에서 fetch(짧은 `revalidate`), 검색 자동완성은 라우트 핸들러 + 디바운스 200ms, AI 분석만 스트리밍 응답으로 단계 이벤트 전송(`{stage, agent}`).

### 반응형
데스크탑 1180px 고정 컨테이너로 디자인했습니다. 브레이크포인트 제안: ≥1280 3열 유지, 1024~1279 우측 레일을 본문 아래로, <768 모바일 디자인 그대로.

---

## 디자인 토큰

### 라이트 (에디토리얼, 메인)
| 토큰 | 값 |
|---|---|
| bg / paper | `#fdfbf6` |
| surface (연한 패널) | `#f4efe4` / hover `#f7f2e6` |
| ink (본문·반전 배경) | `#1a1a17` |
| ink-secondary | `#2b2a25` |
| muted 텍스트 | `rgba(26,26,23,.5)` ~ `.6` |
| 헤어라인 | `rgba(26,26,23,.14)` / 점선 `rgba(26,26,23,.22)` |
| 상승 (한국 관례) | `#c8352c` |
| 하락 | `#1f57c3` |
| 반전 배경 위 상승/하락 | `#f0a89f` / `#9dbcf5` |
| MA60 라인 | `#b8a98a` |

### 다크 (터미널)
`bg #0e1116` · `panel #131820` · `fg #e8e3d8` · `line rgba(232,227,216,.12)` · `accent #e8b04b` · 상승 `#ff5449` · 하락 `#4d8dff` · 정상 `#7ec98a`

### 매거진 (2c)
`bg #fffdf8` · `ink #12100e` · `surface #f7f2e8` · 상승 `#d13b2e` · 하락 `#2b4fd6`

### 타이포그래피
- **Noto Serif KR** (300/500/700) — 한글 제목, 종목명, 뉴스 제목, AI 의견 본문.
- **IBM Plex Sans KR** (300~600) — UI 본문, 버튼, 라벨.
- **IBM Plex Mono** (400~600) — 모든 숫자, 코드, 시스템 라벨. 숫자에는 `font-variant-numeric: tabular-nums` 필수.
- **Instrument Serif** (regular/italic) — 영문 부제·장식 숫자.
- 스케일(px): 62/46/44 (히어로·가격) · 34/28/24 (섹션 제목) · 20/17/16.5 (카드 제목) · 14/13.5/12.5 (본문) · 11/10.5/9.5 (mono 라벨, `letter-spacing .06~.2em`, uppercase).
- 문단에는 `text-wrap: pretty`.

### 간격·형태
- 간격 스케일: 2 / 3 / 5 / 6 / 8 / 10 / 12 / 14 / 16 / 18 / 20 / 22 / 26 / 28 / 32 / 34px.
- **border-radius: 0** (에디토리얼·터미널 테마의 핵심). 예외: 알림 토글 pill, 2c의 버튼/칩 `100px`, 모바일 시트 상단 `14~16px`.
- 그림자: 드로어 `-24px 0 60px rgba(26,26,23,.14)`, 모달 `0 30px 80px rgba(18,16,14,.3)`, 팔레트 `0 28px 70px rgba(26,26,23,.28)`, 툴팁 `0 6px 22px rgba(0,0,0,.18)`.
- 애니메이션: `fadeUp .34s ease`, `slideIn .32s cubic-bezier(.2,.8,.2,1)`, `popIn .28s`, `sheetUp .34s`, `dotSpin .8s linear infinite`, 스켈레톤 `wfpulse 1.2s`(opacity .35↔1), 진행 바 `width .4s ease`.

## 에셋
- 아이콘은 전용 에셋 없이 텍스트 글리프(⌕ ✕ ← ☆ ⠿ 🔔 ▲ ＋ →)로 표현했습니다. 구현 시 코드베이스의 아이콘 세트(예: lucide-react)로 교체하세요. 크기는 12~17px, 색은 `muted` 계열.
- 뉴스 썸네일은 사선 패턴 플레이스홀더입니다 → 실제 기사 이미지(og:image)로 교체, 데스크탑 84×58 / 모바일 56×44, radius 0.
- 폰트는 Google Fonts. Next.js에서는 `next/font/google`의 `Noto_Serif_KR`, `IBM_Plex_Sans_KR`, `IBM_Plex_Mono`, `Instrument_Serif` 사용 권장.
- 모든 수치·뉴스 제목·리포트 내용·AI 문장은 **예시(mock) 데이터**입니다. 실제 값으로 교체하세요.

## 문구 원칙
- 지연 상태는 원인을 밝힘: "상장사 목록을 처음 준비하는 중입니다", "AI 분석은 여러 번의 조회를 포함해 시간이 걸립니다".
- 판단 용어: 비중 확대 / 유지 / 관망 / 과열 주의. 매수·매도 단정 표현은 피하고 항상 면책 문구를 함께 노출.
- 등락 색은 국내 관례(상승 빨강 / 하락 파랑)로 고정. 글로벌 사용자를 지원하려면 사용자 설정으로 토글.

## 스크린샷 (`screenshots/`)
| 파일 | 내용 |
|---|---|
| `2a-detail-editorial.png` | 종목 상세 · 에디토리얼 라이트 (데스크탑+모바일) |
| `2a-ai-drawer-open.png` | 위 화면에서 AI 드로어가 열린 완료 상태 |
| `2b-detail-terminal.png` | 종목 상세 · 다크 터미널 3분할 |
| `2b-ai-rail-open.png` | 다크 AI 레일(로그 + 신뢰도 스코어) 열린 상태 |
| `2c-detail-magazine.png` | 종목 상세 · 매거진 스프레드 |
| `2c-ai-modal-open.png` | 3열 의견 대조 모달 + 합의/이견 |
| `3a-search-light.png` | 검색 팔레트 (라이트) |
| `4a-search-dark.png` | 검색 팔레트 (다크, 프리픽스 문법) |
| `3b-market-home.png` | 시장 개요 홈 |
| `4b-watchlist.png` | 관심종목 관리 |
| `1d-states-fallback.png` | 로딩·폴백 상태 와이어프레임 (KRX→KIND→내부 목록, LLM 실패) |

정확한 수치는 스크린샷보다 위 문서와 HTML 파일을 기준으로 삼으세요.

## 파일
- `Stock AI Wireframes.dc.html` — 전체 디자인(턴 1 와이어프레임 ~ 턴 4 하이파이). 브라우저에서 바로 열림. 캔들차트·검색 팔레트·AI 진행 애니메이션 모두 실제로 동작하므로 인터랙션 확인에 사용하세요.
- `support.js` — 위 HTML을 브라우저에서 렌더링하기 위한 런타임. **이식 대상이 아닙니다.**
- `screenshots/` — 화면별 캡처 11장.

## Claude Code에 전달하는 방법
1. 이 폴더를 Next.js 저장소 루트에 복사합니다 (예: `design_handoff_stock_ai/`).
2. `Stock AI Wireframes.dc.html` 을 브라우저로 한 번 열어 인터랙션을 확인합니다.
3. Claude Code에 다음처럼 요청합니다:

   > design_handoff_stock_ai/README.md 를 읽고, 2a·3a·3b·4b 화면을 우리 Next.js(App Router) 프로젝트의 새 페이지로 구현해줘. 기존 스타일 시스템과 컴포넌트 패턴을 따르고, 차트는 lightweight-charts로 붙여. 먼저 라우트/컴포넌트 구조 계획을 보여주고 진행해줘.

4. 화면 단위로 나눠 진행하는 편이 안전합니다: 종목 상세(2a) → 검색(3a) → 홈(3b) → 관심종목(4b).
