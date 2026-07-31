# 1단계 산출물 — 프리미티브 6종

`components/primitives.tsx` 그대로 사용. 데모 페이지(`/_dev/primitives`)를 하나 만들어 6종이 전부 보이는지 확인한 뒤 화면으로 넘어갑니다.

## 치수 고정값
| 컴포넌트 | 쓰이는 곳 | 크기 |
|---|---|---|
| SectionLabel | 모든 섹션 머리 | 10.5px (2b 터미널은 9.5px) |
| Delta | 헤드라인 가격 옆 | size 20~24 |
| Delta | 리스트 행·표 | size 13.5, `showAmount={false}` |
| Delta | 반전 배경(AI 배너·다크) | `inverted` |
| Chip | 심볼/시장 | outline · 섹터 칩만 solid |
| Sparkline | 홈 리스트 | 76×24 |
| Sparkline | 검색 결과 | 92×26 |
| Sparkline | 관심종목 표 | 104×28 |
| StatRow | 우측 레일 투자 지표 | 6행, 컨테이너 `bg-surface p-4` |

## 검수 체크리스트
- [ ] 가격 숫자가 자릿수 바뀌어도 흔들리지 않는다 (`.num` = tabular-nums)
- [ ] 상승 빨강 / 하락 파랑, 보합은 muted
- [ ] 반전 배경(`bg-ink`) 위에서 Delta가 `--up-on-ink` / `--down-on-ink`로 바뀐다
- [ ] 어디에도 `rounded` 가 없다
- [ ] 컴포넌트 파일에 hex 리터럴이 없다
- [ ] 점선 구분선이 실선과 구분되어 보인다

## 다음 (2단계)
라우트·서버컴포넌트 경계 → 그다음 화면 2a. `02-routes.md` 참고.
