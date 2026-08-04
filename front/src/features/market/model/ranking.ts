// 종목 탐색(/stocks) 정렬·필터 파라미터.
//
// URL 이 곧 상태다 — 필터가 클라이언트 state 가 아니라 searchParams 라, 검증되지 않은
// 문자열이 그대로 백엔드 쿼리에 실릴 수 있다. 그 경계를 여기서 막는다.

export const RANKING_SORTS = ["market_cap", "change"] as const;
export const RANKING_BOARDS = ["ALL", "KOSPI", "KOSDAQ"] as const;

export type RankingSort = (typeof RANKING_SORTS)[number];
export type RankingBoard = (typeof RANKING_BOARDS)[number];

export const SORT_LABELS: Record<RankingSort, string> = {
  market_cap: "시가총액순",
  change: "등락률순",
};

export const BOARD_LABELS: Record<RankingBoard, string> = {
  ALL: "전체",
  KOSPI: "코스피",
  KOSDAQ: "코스닥",
};

/** 탐색 화면 한 페이지 종목 수. 백엔드 상한(100) 안이다. */
export const RANKING_PAGE_SIZE = 50;

/**
 * `?sort=` 를 안전한 값으로 좁힌다. 모르는 값은 조용히 기본값으로 떨어뜨린다.
 *
 * 400 을 띄우지 않는 이유: 링크를 잘못 눌렀거나 오래된 북마크로 들어온 사람에게
 * 오류 화면을 주는 것보다 기본 목록을 보여주는 편이 낫다.
 */
export function parseSort(value: string | undefined): RankingSort {
  return RANKING_SORTS.includes(value as RankingSort)
    ? (value as RankingSort)
    : "market_cap";
}

export function parseBoard(value: string | undefined): RankingBoard {
  return RANKING_BOARDS.includes(value as RankingBoard)
    ? (value as RankingBoard)
    : "ALL";
}

/** 필터 칩이 거는 링크. 현재 조건에서 한 축만 바꾼다. */
export function rankingHref(
  current: { sort: RankingSort; board: RankingBoard },
  patch: Partial<{ sort: RankingSort; board: RankingBoard }>,
): string {
  const next = { ...current, ...patch };
  const params = new URLSearchParams();
  // 기본값은 URL 에 싣지 않는다 — /stocks 와 /stocks?sort=market_cap&board=ALL 이
  // 같은 화면인데 주소만 다르면 공유·뒤로가기가 지저분해진다.
  if (next.sort !== "market_cap") params.set("sort", next.sort);
  if (next.board !== "ALL") params.set("board", next.board);

  const query = params.toString();
  return query ? `/stocks?${query}` : "/stocks";
}
