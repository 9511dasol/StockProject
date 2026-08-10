/**
 * 표 조각이 화면과 무관하게 공유하는 조판.
 *
 * 열 구성(그리드 템플릿)은 여기 오지 않는다 — 랭킹 표와 조건 검색 표는 보여주는
 * 것이 달라서 열이 다르고, 그 판단은 각 폴더의 `tokens.ts` 가 근거와 함께 소유한다.
 * 여기 있는 것은 **어느 표에서도 같아야 하는 것**뿐이다.
 */

/** 표 머리 글자 (mono · 대문자 · 넓은 자간) */
export const TABLE_HEAD = "font-mono font-medium uppercase tracking-label-wide";
