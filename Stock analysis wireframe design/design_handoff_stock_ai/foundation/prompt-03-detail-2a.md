# Claude Code 붙여넣기용 프롬프트 — 3단계 종목 상세 (2a)

> 첨부: `README.md`(1~3, 6절), `screenshots/2a-detail-editorial.png`, `screenshots/2a-ai-drawer-open.png`, `lib/types.ts`, `components/primitives.tsx`
> 선행: 1단계 프리미티브 검수 통과, 2단계 라우트/mock 데이터 검수 통과

---

`app/stocks/[symbol]/page.tsx`를 2a(에디토리얼 라이트) 디자인으로 구현해줘. 지금까지 만든 프리미티브 6종과 mock 데이터 레이어를 그대로 쓰고, 새 원자 컴포넌트가 필요하면 이 화면에서 뽑아도 돼 — 단 기존 프리미티브를 다시 만들지 마.

**구조 (첨부 README 1절 기준)**
- 헤드라인: 종목명 46px Noto Serif KR 700, 영문 상호 15px Instrument Serif, 칩 3개(정규화 심볼/시장/섹터 — 섹터만 solid)
- 본문 `grid-template-columns: 1fr 292px; gap: 28px`
  - 좌: 차트(748×344) → 탭(뉴스 3 / 애널리스트 리포트 3 / 재무) → 각 탭 리스트
  - 우: 투자 지표(StatRow 6행, `bg-surface`) → 시장 개요 4행 → 리포트 요약 3건 → API 메모
- 뉴스 행: [순번] [제목 16.5px Noto Serif KR + 출처·시각 mono 10.5px] [썸네일 84×58 사선 패턴 플레이스홀더]

**차트**
lightweight-charts로 캔들 + 거래량 서브차트(높이 19%, opacity .3) + MA20/MA60 + 볼린저밴드. 골든/데드크로스는 `GC`/`DC` 마커(상승 교차 빨강 `--up` / 하락 교차 파랑 `--down`). 커서 이동 시 십자선 + 툴팁(날짜, 시/고/저/종, 거래량 M단위, `--ink` 배경/`--paper` 텍스트, mono 10.5px). 휠로 18~240봉 확대/축소. 우상단 1M/3M/6M/1Y 프리셋. 데이터는 2단계에서 만든 mock `getStockHistory`를 그대로 사용 — MA/BB/크로스가 이미 계산돼 온다.

**AI 드로어** (README 4절, "2a 드로어" 방식만 구현 — 레일/모달 아님)
- 트리거 버튼은 헤드라인 근처에 배치
- 우측 슬라이드, 폭 438px, `bg-surface`, `border-left: 2px solid var(--ink)`, `box-shadow: var(--shadow-drawer)`, `animate-slide-in`
- 4단계 진행 표시 (필수): 라벨 `{단계명} · {n}/4 단계`, 진행 바 높이 3px 트랙 `var(--line)` 채움 `var(--ink)` `transition: width .4s ease`
- 에이전트 카드 3개, 도착 순서대로 append, `animate-fade-up`. 미도착 자리는 3줄 스켈레톤 `animate-pulse-wf`
- 최종 판단: 라벨 `FINAL DECISION` → 판단 34px Noto Serif KR + 신뢰도% → 5칸 인디케이터(채움 칸 `--up`) → 요약 → 근거 3줄(＋/－ 기호)
- `decision.source === "fallback"`이면 같은 블록에 '규칙 기반 판단' 배지 + '다시 시도' 버튼
- 2단계에서 만든 `useAiAdvice(symbol)` 훅을 그대로 구독. mock 타이밍 650/1250/1900/2700ms는 이미 있음

**하지 말 것**
- `rounded-*` 금지 (드로어·차트·카드 전부 각짐)
- hex 리터럴 금지 — 전부 CSS 변수/토큰
- Delta 색 분기를 프리미티브 밖에서 다시 만들지 마
- 로딩 상태를 즉석에서 새로 설계하지 마 — `loading.tsx`가 2단계에 이미 있음, 스타일만 입혀

**끝나고 스크린샷 대조로 알려줘 (내가 비교할 것)**
- [ ] 헤드라인 폰트 크기·칩 3개·정렬이 `2a-detail-editorial.png`와 일치
- [ ] 본문 2열 비율(1fr / 292px)과 간격 28px 일치
- [ ] 차트에 MA20/MA60/BB/크로스 마커가 실제로 그려진다 (mock 데이터 기준)
- [ ] 크로스헤어 툴팁이 마우스 따라 움직인다
- [ ] AI 버튼 클릭 → 드로어가 438px 폭으로 슬라이드 (`2a-ai-drawer-open.png`와 대조)
- [ ] 진행 바가 0→4/4로 실제로 채워진다 (mock 타이밍)
- [ ] 에이전트 카드 3개가 순서대로 나타난다 (skeleton → fade-up)
- [ ] `?fallback=1`에서 '규칙 기반 판단' 배지 + 재시도 버튼이 보인다
- [ ] `grep -r "rounded" app/stocks` 0건
- [ ] 타입 에러 0, 빌드 통과

모바일 레이아웃과 2b/2c는 다음 단계. 지금은 데스크탑 2a만.
