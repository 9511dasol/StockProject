# Claude Code 전체 구현 프롬프트 (0~7단계 통합)

각 단계는 순서대로, 이전 단계 검수 통과 후 다음으로. 첨부 파일은 각 단계 제목 아래 명시.

---

## 0단계 — 코드베이스 감사
첨부: 없음 (레포만)

이 Next.js 코드베이스를 감사해줘. 보고할 것: Tailwind 버전(v3/v4), 라우터(app/pages), 기존 디자인 토큰·폰트 설정과의 충돌 여부, 컴포넌트 폴더 관례, import alias. 아직 아무것도 만들지 마.

---

## 1단계 — 토큰 레이어
첨부: `foundation/globals.css`, `foundation/fonts.ts`, `foundation/tailwind.config.ts`, `foundation/lib/format.ts`, `foundation/lib/types.ts`

주식 AI 분석 서비스의 디자인 토큰을 이 코드베이스에 적용해줘.
- `globals.css`를 프로젝트의 전역 스타일 파일에 병합 (Tailwind v4면 `@theme` 그대로, v3면 `tailwind.config.ts` 반영).
- `fonts.ts`를 `app/fonts.ts`로 추가, `layout.tsx`의 `<html>`에 `fontVars` 클래스 주입.
- `lib/format.ts`, `lib/types.ts`를 `lib/`에 추가.
- 확인: 빈 페이지에서 `bg-paper text-ink`와 4개 폰트가 실제로 로드되는지.

---

## 2단계 — 프리미티브 6종
첨부: `foundation/00-READ-FIRST.md`, `foundation/01-primitives.md`, `foundation/components/primitives.tsx`, `foundation/globals.css`, `foundation/lib/format.ts`

주식 AI 분석 서비스의 디자인 프리미티브 6종을 이 코드베이스에 이식해줘. 토큰 레이어는 이미 적용돼 있어.

**먼저 확인할 것 (코드 쓰기 전에 보고)**: `--ink`/`--up`/`--down`/`--line` 변수 로드 여부, `.num`/`.label` 유틸 생존 여부, 컴포넌트 폴더 관례.

**만들 것**: 첨부 `primitives.tsx`를 프로젝트 컨벤션에 맞춰 이식. 6종 — SectionLabel, Delta, Chip, Hairline/DottedRow, Sparkline, StatRow.

**규칙**
- 상승/하락 색 분기는 `Delta` 한 곳에서만. 다른 곳에서 `text-up`/`text-down` 직접 사용 금지.
- 컴포넌트 파일에 hex 리터럴 금지 — 전부 토큰 클래스 또는 `var(--*)`.
- `rounded-*` 금지. border-radius는 0.
- 모든 숫자에 `.num` 클래스(tabular-nums). 자릿수 바뀌어도 표가 흔들리면 안 됨.
- 상승 빨강 / 하락 파랑(한국 관례). 반전 배경 위에서는 `--up-on-ink`/`--down-on-ink`.
- 포맷은 전부 `lib/format.ts` 경유, `toLocaleString` 직접 호출 금지.

**데모 페이지** `/_dev/primitives`에 6종 전부 + 실제 쓰이는 변형(Delta: 헤드라인용/리스트용/반전/보합, Chip: outline·solid, Sparkline: 76×24·92×26·104×28 상승·하락 각각, StatRow: 6행, DottedRow: 3행).

**자가 검수 보고**
- [ ] 7,100 / 71,300 / 712,000 세로 정렬 시 자릿수 정렬됨
- [ ] 상승 빨강 / 하락 파랑 / 보합 muted
- [ ] `bg-ink` 위 Delta가 밝은 톤
- [ ] `grep -r "rounded" components/` 0건
- [ ] `grep -rE "#[0-9a-fA-F]{6}" components/` 0건
- [ ] 점선·실선 구분선 육안 구분됨
- [ ] 타입 에러 0, 빌드 통과

화면(페이지)은 아직 만들지 마.

---

## 3단계 — 라우트 골격 + mock 데이터
첨부: `foundation/02-routes.md`, `lib/types.ts`, `README.md`

디자인 없이 라우트 골격과 데이터 계약만 세워줘.

**라우트**
```
app/page.tsx                      시장 홈        Server
app/stocks/[symbol]/page.tsx      종목 상세      Server
app/stocks/[symbol]/loading.tsx   스켈레톤
app/stocks/[symbol]/error.tsx     조회 실패 + 재시도
app/watchlist/page.tsx            관심종목       Server shell
app/api/search/route.ts
app/api/listed-companies/route.ts
app/api/ai/advice/route.ts        SSE
```

**URL 규칙**: `[symbol]`은 사람이 읽는 코드(`005930`, `AAPL`). yfinance 심볼 변환(`krx_symbol_to_yfinance`)은 서버에서만. URL은 공유 가능해야.

**데이터 레이어**: 화면엔 `lib/types.ts` 타입만 전달. `lib/api/stocks.ts`(getStockHistory/getQuote/getMetrics/getNews/getReports), `lib/api/search.ts`(searchStocks/getListedCompaniesStatus) — 지금은 mock 반환(`lib/api/__mock__/`). 삼성전자(005930)/SK하이닉스(000660)/애플(AAPL) 3종목, 240봉 OHLCV, 뉴스 3건, 리포트 3건. 240봉은 시드 고정 생성기(`lib/api/__mock__/generate.ts`)로 — MA20/MA60/볼린저밴드/골든·데드크로스가 실제 계산돼 나와야 함.

**서버/클라 경계**: 헤드라인·지표·뉴스·리포트=Server(`revalidate:60`) / 차트·검색팔레트·AI드로어·관심종목표=Client / 탭은 서버에서 3패널 다 받아두고 전환만 클라.

**AI 스트리밍**: `app/api/ai/advice/route.ts`가 `AiStreamEvent`를 SSE로 `{stage:1}→{stage:2}→{stage:3,agent}×3→{stage:4,decision}` 순서로. mock 타이밍 650/1250/1900/2700ms. 클라이언트 훅 `useAiAdvice(symbol)` 반환값 `{stage, agents[], decision, error}`. `?fallback=1`로 `decision.source==="fallback"` 재현 가능해야.

**첫 호출 지연**: `api/listed-companies`는 `{ready,loaded,total,source}`, mock에서 처음 3회 `ready:false`.

**확인**: 각 라우트에 `<pre>{JSON.stringify(...)}</pre>` 덤프만. 스타일 붙이지 마.

**검수**
- [ ] `/stocks/005930`, `/stocks/AAPL` 데이터 덤프됨
- [ ] curl로 `/api/ai/advice?symbol=005930` 받으면 5개 이벤트 순서대로
- [ ] `?fallback=1`에서 fallback decision
- [ ] `loading.tsx` 실제로 보임(mock 지연 400ms)
- [ ] `error.tsx`가 `/stocks/999999`에서 뜸
- [ ] 타입 에러 0, 빌드 통과

---

## 4단계 — 종목 상세 2a (데스크탑)
첨부: `README.md`(1~3,6절), `screenshots/2a-detail-editorial.png`, `screenshots/2a-ai-drawer-open.png`, `lib/types.ts`, `components/primitives.tsx`

`app/stocks/[symbol]/page.tsx`를 2a(에디토리얼 라이트)로 구현. 프리미티브·mock 데이터 재사용, 기존 프리미티브 재구현 금지.

**구조**: 헤드라인(종목명 46px Noto Serif KR 700, 영문 상호 15px Instrument Serif, 칩 3개 — 섹터만 solid). 본문 `grid-template-columns: 1fr 292px; gap:28px`. 좌: 차트(748×344)→탭(뉴스3/리포트3/재무)→리스트. 우: 투자지표(StatRow 6행, bg-surface)→시장개요 4행→리포트요약 3건→API 메모. 뉴스 행: [순번][제목16.5px+출처·시각mono10.5px][썸네일84×58 사선패턴 플레이스홀더].

**차트**: lightweight-charts, 캔들+거래량서브차트(높이19%, opacity.3)+MA20/MA60+볼린저밴드. 골든/데드크로스 `GC`/`DC` 마커(빨강/파랑). 크로스헤어+툴팁(ink배경/paper텍스트, mono10.5px). 휠줌 18~240봉. 1M/3M/6M/1Y 프리셋. mock `getStockHistory` 그대로 사용.

**AI 드로어**("2a 드로어"만): 우측 슬라이드 438px, `bg-surface`, `border-left:2px solid var(--ink)`, `shadow: var(--shadow-drawer)`, `animate-slide-in`. 4단계 진행표시(라벨+3px 진행바). 에이전트 카드 3개 순서대로 append(`animate-fade-up`), 미도착은 스켈레톤(`animate-pulse-wf`). 최종판단: 라벨→34px 판단+신뢰도%→5칸 인디케이터→요약→근거3줄. fallback이면 배지+재시도 버튼. `useAiAdvice(symbol)` 그대로 구독.

**금지**: rounded-*, hex 리터럴, Delta 색분기 재구현, loading.tsx 재설계(스타일만 입힘).

**검수**
- [ ] 헤드라인·칩3개·정렬이 스크린샷과 일치
- [ ] 본문 2열 비율/간격 일치
- [ ] 차트 MA/BB/크로스 마커 실제로 그려짐
- [ ] 크로스헤어 툴팁 마우스 추적
- [ ] AI드로어 438px 슬라이드, 스크린샷과 대조
- [ ] 진행바 0→4/4 채워짐
- [ ] 에이전트 카드 3개 순서대로 등장
- [ ] fallback 배지+재시도 노출
- [ ] `grep -r "rounded" app/stocks` 0건
- [ ] 타입 에러 0, 빌드 통과

모바일/2b/2c는 다음 단계.

---

## 5단계 — 종목 상세 모바일 + 2b/2c 변형
첨부: `README.md`(1,3,4절), `2a/2b/2c` 스크린샷 6장, `lib/types.ts`, `components/primitives.tsx`, 완성된 `app/stocks/[symbol]/page.tsx`

4단계 2a 데스크탑 기준으로 2a 모바일, 2b 다크 터미널, 2c 매거진 추가. 데이터·프리미티브·AI훅 전부 재사용, 레이아웃/테마만 교체.

**2a 모바일**: 헤드라인(세로)→차트(풀블리드, 높이축소)→탭→리스트→우측레일 섹션 세로 스택. AI 트리거는 하단 고정 버튼, 드로어 대신 `animate-sheet-up` 전체화면 시트. 브레이크포인트 `<768px`.

**2b 다크 터미널**: `data-theme="terminal"`. 3분할(좌 워치리스트214px/중앙 차트+지표3열/우 뉴스·리포트252px). 라벨 9.5px mono uppercase `tracking .14~.2em`. AI는 "2b 레일": 452px, 좌측보더 앰버, 타임스탬프 로그 형식, 신뢰도 스코어바 3개. 컴포넌트 로직 분기 없이 테마 변수로만 갈아끼움.

**2c 매거진**: 좌 404px 히어로(종목명62px 2줄, 등락률54px, 요약15px/1.85). 우: 차트660×292+뉴스3열. AI는 "2c 모달": 중앙모달, 백드롭 `rgba(18,16,14,.34)`+`blur(3px)`, 3열 에이전트대조+하단 좌(최종판단46px)/우(합의표380px). 매거진 전용 토큰은 이 화면에서만 로컬 오버라이드, globals.css 공용 토큰 건드리지 마.

**공통 규칙**: rounded-* 금지(2c 버튼/칩 100px만 예외). hex 리터럴 금지. Delta 하나로 색분기 유지. AI 3방식(드로어/레일/모달)은 컴포넌트는 따로, 내부 로직(`useAiAdvice` 소비)은 공유.

**검수**
- [ ] 모바일 스택+AI시트가 390px에서 자연스러움
- [ ] 2b 3분할 폭과 mono 라벨이 스크린샷과 일치
- [ ] 2c 히어로/줄간격, 모달이 스크린샷과 일치
- [ ] 세 변형 모두 같은 훅·같은 mock 데이터 사용(분기된 fetch 없음)
- [ ] `grep -r "rounded" app/stocks` — 2c 예외만 잡힘
- [ ] 타입 에러 0, 빌드 통과

---

## 6단계 — 검색 팔레트 3a/4a
첨부: `README.md` 2절, `3a-search-light.png`, `4a-search-dark.png`, `lib/types.ts`, `components/primitives.tsx`, `api/search`·`api/listed-companies`

전역 검색 커맨드 팔레트. 라이트(3a)/다크(4a), 데스크탑 오버레이+모바일 전체화면. `⌘K`/`Ctrl+K` 전역 단축키.

목적: 한글명·초성·6자리 코드·해외 티커를 한 입력창에서 처리.

**데스크탑**: 백드롭 `rgba(26,26,23,.22)`, 패널폭772px, 상단여백64px, `1px solid var(--ink)`, `shadow:var(--shadow-palette)`, `animate-pop-in`. 입력행: 패딩18px 22px, 하단 `2px solid var(--ink)`, 쿼리25px Noto Serif KR, 캐럿 2×24px `wfpulse 1.05s infinite`. 입력모드 칩3개(한글/초성/코드), 활성만 solid. 결과 3그룹(이름·초성일치/최근검색/코드·해외티커), 그룹헤더 bg-surface 10.5px mono uppercase, 우측에 백엔드 메서드명 캡션. 결과행: [매칭하이라이트 종목명+영문명][시장칩][정규화심볼82px우측정렬][Sparkline92×26][가격14px/Delta11px]. 첫호출지연 배너 **필수**(스피너11px `animate-dot-spin`+"{loaded}/{total} 종목"). 하단 키힌트바.

키보드 내비게이션 실제 동작: 방향키 이동/Enter 선택/Tab 관심추가/Esc 닫기.

**4a 다크**: `data-theme="terminal"`. 프리픽스 힌트 `>` 이름 `:` 코드 `@` 티커. 하이라이트 앰버(`--accent`). 키힌트 대문자 mono+`⌥⏎ RUN AI`.

**모바일**: 전체화면, 상단입력+취소, 시장필터칩, 그룹리스트, 하단 지연안내+키보드 여백.

**금지**: rounded-*, hex 리터럴, 디바운스 없는 fetch(200ms 필수), Delta/Sparkline/Chip 재구현.

**검수**
- [ ] `⌘K` 전역 동작
- [ ] 등장 애니메이션이 스크린샷 구도와 일치
- [ ] 3그룹 레이아웃 일치
- [ ] 첫호출 지연 배너 카운트업 후 사라짐
- [ ] 키보드 내비게이션 전부 동작
- [ ] 다크 프리픽스/앰버 하이라이트가 스크린샷과 일치
- [ ] 모바일 전체화면 확인
- [ ] `grep -r "rounded" app/` (검색 관련) 0건
- [ ] 타입 에러 0, 빌드 통과

---

## 7단계 — 시장 홈 (3b)
첨부: `README.md` 1절, `3b-market-home.png`, `lib/types.ts`, `components/primitives.tsx`, mock `fetch_market_overview_from_yfinance`

`app/page.tsx` 구현. 목적: 지수 스냅샷→AI 아침브리핑→등락상위→업종등락 순으로 하루 파악.

**데스크탑**: 컨테이너1180px, 패딩26px 32px 30px, 섹션간 gap22px. 마스트헤드(justify-between, 하단2px solid ink) 좌측=제목+날짜, 우측=검색필드250px(클릭시 6단계 팔레트 오픈)+관심종목버튼. 지수카드 `repeat(4,1fr) gap:1px` 배경var(--line) 헤어라인트릭. 본문 `1fr 328px gap:26px`. 좌: AI브리핑배너(bg-ink, 2열flex, 우측196px, Delta는inverted)→상승/하락상위 2열(각5행). 우: 업종바(막대길이=등락률비례)→오늘의뉴스(bg-surface)→API메모. 리스트행: DottedRow, [순번][종목명/코드flex:1][Sparkline76×24][가격/Delta우측정렬]. 지수·상위종목 클릭시 상세로 이동.

**AI브리핑**: mock 정적요약(실제 LLM 호출 아님). AI드로어와 별개 기능.

**모바일**: 지수2×2그리드→브리핑카드→상승률/하락률/거래량 탭전환→업종바→하단탭바(홈/검색/관심/AI). 탭바는 여기서 처음 만들어 공용 컴포넌트(`MobileTabBar`)로 분리, 다른 페이지 재사용.

**금지**: rounded-*, hex 리터럴, 프리미티브 재구현, format.ts 안거친 숫자계산.

**검수**
- [ ] 지수카드4개+헤어라인그리드 일치
- [ ] 본문비율/gap 일치
- [ ] AI배너 반전톤 Delta 밝게 보임
- [ ] 상승/하락상위 각5행 클릭시 이동
- [ ] 업종바 길이 비례
- [ ] 검색필드클릭시 팔레트 열림
- [ ] 모바일 탭전환+하단탭바 동작
- [ ] `grep -r "rounded" app/page.tsx` 0건
- [ ] 타입 에러 0, 빌드 통과

---

## 8단계 (마지막) — 관심종목 관리 (4b)
첨부: `README.md` 5절, `4b-watchlist.png`, `lib/types.ts`, `components/primitives.tsx`, `useAiAdvice` 훅, AI 드로어 컴포넌트

`app/watchlist/page.tsx`. 목적: 보유·평단·알림을 한 표에서 관리, 선택 종목 일괄 AI 분석.

**헤더**: 제목28px+캡션 `{n}종목·{g}그룹·알림{a}건 활성`(mock 실계산). 우측 [순서편집][＋종목추가][선택{n}종목 AI분석](반전스타일, 선택0이면 비활성).

**필터바**: 그룹탭칩+정렬드롭다운(등락률/평가손익/이름)+우측 평가손익합계(Delta).

**테이블** `grid: 26px 1.6fr 108px 104px 116px 122px 1fr 96px`:
1. 드래그핸들`⠿`(`@dnd-kit/sortable` handle전용)+체크박스
2. 종목명+그룹칩(outline)+코드/영문명
3. 현재가(.num)
4. Delta(13.5, showAmount=false)
5. Sparkline104×28(3개월mock)
6. 보유수량·평단/평가손익(Delta) 2줄
7. 알림토글(26×15px pill, ON시bg-ink)+조건텍스트
8. AI판단칩(mock Decision.verdict, 클릭시 해당종목 AI드로어, 재계산아님)

hover bg-surface-hover, 구분선 DottedRow.

**선택&일괄작업**: 체크박스 다중선택→하단고정바(bg-surface): 선택개수+[그룹이동][알림일괄설정][삭제]. "선택 AI분석"은 3단계 드로어 재사용 — 여러종목 표시방식(탭전환 vs 순차드로어스택)은 **구현 전에 계획만 먼저 제시**.

**정렬편집모드**: [순서편집] 클릭시 핸들 활성화+저장/취소바. 평소엔 핸들 있어도 드래그 비활성.

**모바일**: 2단카드(1단=이름·Sparkline·가격, 2단=보유·알림·AI판단칩). 하단고정 [＋종목추가][전체AI분석], MobileTabBar와 겹치지 않게.

**금지**: rounded-*(토글pill만 예외), hex리터럴, 프리미티브/AI드로어 재구현, format.ts 우회.

**검수**
- [ ] 헤더캡션 숫자 실계산
- [ ] 8열그리드 폭/정렬 일치
- [ ] 드래그핸들만 드래그, 편집모드에서만 정렬가능
- [ ] 알림토글 26×15px ON시bg-ink
- [ ] 다중선택시 하단바 등장
- [ ] "선택AI분석"이 기존 드로어 재사용(새컴포넌트 아님)
- [ ] 모바일 2단카드 확인
- [ ] `grep -r "rounded" app/watchlist` pill만 잡힘
- [ ] 타입 에러 0, 빌드 통과

**8단계 완료 후**: 홈↔검색↔상세↔관심종목 전체 네비게이션 통합 점검.
