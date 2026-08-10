/**
 * 랭킹 표(`browse/`)와 조건 검색 표(`screener/`)가 **둘 다** 쓰는 조각.
 *
 * ## 왜 폴더를 하나 더 뒀나
 *
 * 조건 검색이 생기면서 칩·꼬리말·머리 셀을 `../browse/FilterChip` 처럼 **깊은 경로로**
 * 집어가기 시작했다. `browse/index.ts` 는 바로 그것을 막으려고 필터 바와 표만
 * 내보내고 있었는데, 규칙을 우회한 셈이 됐다.
 *
 * 규칙이 틀린 것이 아니라 **공유 조각이 browse 안에 살고 있던 것이 틀렸다.** 두
 * 화면이 같이 쓰는 것은 어느 한쪽의 내부가 아니다. 여기로 옮기고 나면 browse 와
 * screener 는 각자 **자기 열만** 소유한다.
 *
 * ## 여기 오지 않는 것
 *
 * - **그리드 템플릿** — 두 표는 열이 다르다(시세 6열 vs 지표 7열). 억지로 합치면
 *   어느 화면에도 맞지 않는 열 폭이 된다 (각 `tokens.ts` 주석).
 * - **행·카드** — 열이 다르면 행도 다르다.
 * - **`FilterGroup` / `ConditionRow`** — "라벨 + 칩" 이라는 점만 같고 조판이 다르다.
 *   랭킹은 축이 둘이라 한 줄에 눕고, 조건 검색은 여섯이라 2열 격자로 접으며 라벨 폭을
 *   고정한다. 그 차이는 각 필터 바 주석에 근거가 있다 — 프롭으로 갈라 합치면 근거가
 *   사라지고 옵션만 남는다.
 */
export { FilterChip, type FilterChipProps } from "./FilterChip";
export { HeadCell, type HeadCellProps } from "./HeadCell";
export { ResultSummary, type ResultSummaryProps } from "./ResultSummary";
