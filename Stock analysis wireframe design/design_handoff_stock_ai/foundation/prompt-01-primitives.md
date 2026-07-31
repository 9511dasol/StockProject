# Claude Code 붙여넣기용 프롬프트 — 1단계 프리미티브

> 아래 전문을 복사해 붙여넣으세요. 첨부: `00-READ-FIRST.md`, `01-primitives.md`, `components/primitives.tsx`, `globals.css`, `lib/format.ts`

---

주식 AI 분석 서비스의 디자인 프리미티브 6종을 이 코드베이스에 이식해줘.
토큰 레이어(globals.css, fonts.ts, lib/format.ts, lib/types.ts)는 이미 적용돼 있어.

**먼저 확인할 것 (코드 쓰기 전에 보고해줘)**
1. Tailwind 버전 (v3인지 v4인지) — v4면 `@theme`, v3면 `tailwind.config.ts`가 이미 반영됐는지
2. globals.css의 CSS 변수(`--ink`, `--up`, `--down`, `--line`)가 실제로 로드되는지
3. `.num` / `.label` 유틸이 살아있는지
4. 기존 컴포넌트 폴더 구조와 import alias(`@/`) 관례

**만들 것**
첨부한 `components/primitives.tsx`를 이 프로젝트 컨벤션에 맞춰 이식.
6종: SectionLabel, Delta, Chip, Hairline/DottedRow, Sparkline, StatRow.
파일을 나눌지 한 파일로 둘지는 코드베이스 관례를 따라줘.

**반드시 지킬 규칙**
- 상승/하락 색 분기는 `Delta` 컴포넌트 **한 곳에서만** 일어난다. 다른 곳에서 `text-up`/`text-down`을 직접 쓰지 마.
- 컴포넌트 파일에 hex 색상 리터럴 금지. 전부 토큰 클래스 또는 `var(--*)`.
- `rounded-*` 금지. 이 디자인의 border-radius는 0이다 (예외: 알림 토글 pill, 모바일 시트 상단만 — 지금은 해당 없음).
- 모든 숫자에 `.num` 클래스 (`font-variant-numeric: tabular-nums`). 자릿수가 바뀌어도 표가 흔들리면 안 돼.
- 한국 관례: 상승 = 빨강(`--up`), 하락 = 파랑(`--down`). 반전 배경(`bg-ink`) 위에서는 `--up-on-ink`/`--down-on-ink`.
- 포맷은 전부 `lib/format.ts`를 통해서. 컴포넌트에서 `toLocaleString`을 직접 부르지 마.

**데모 페이지**
`/_dev/primitives` 라우트를 만들어서 6종을 전부 보여줘. 각 컴포넌트마다 실제 쓰이는 변형을 나열:
- Delta: 헤드라인용(size 22) / 리스트용(size 13.5, showAmount=false) / 반전 배경 위(inverted) / 보합(0%)
- Chip: outline, solid
- Sparkline: 76×24, 92×26, 104×28 — 상승 데이터와 하락 데이터 각각
- StatRow: `bg-surface p-4` 컨테이너 안에 6행 (PER/PBR/EPS/배당수익률/52주 최고/외국인 비중)
- SectionLabel: 10.5px, 그리고 right 슬롯이 있는 경우
- DottedRow: 3행, hover 확인용

**끝나고 자가 검수해서 결과 알려줘**
- [ ] 자릿수가 다른 가격(7,100 / 71,300 / 712,000)을 세로로 쌓았을 때 소수점·자릿수가 정렬된다
- [ ] 상승 빨강 / 하락 파랑 / 보합 muted
- [ ] `bg-ink` 배경 위 Delta가 밝은 톤으로 바뀐다
- [ ] `grep -r "rounded" components/` 결과 0건
- [ ] `grep -rE "#[0-9a-fA-F]{6}" components/` 결과 0건
- [ ] 점선 구분선(DottedRow)과 실선 헤어라인이 눈으로 구분된다
- [ ] 타입 에러 0, 빌드 통과

아직 화면(페이지)은 만들지 마. 프리미티브와 데모 페이지까지만.
