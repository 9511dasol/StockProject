import { SORTED_COLUMN, type RankingSort } from "../../model/ranking";
import type { RankedStock } from "../../services/getStockRanking";
import { RankingCard } from "./RankingCard";
import { RankingHeadRow } from "./RankingHeadRow";
import { RankingRow } from "./RankingRow";

export interface RankingTableProps {
  rows: readonly RankedStock[];
  /** 어느 열이 이 순서를 만들었는지 머리 행에 표시하기 위해 받는다 */
  sort: RankingSort;
}

/**
 * 종목 탐색 목록 — 데스크탑 표 / 모바일 행을 조립한다.
 *
 * 전체 건수는 더 이상 받지 않는다. 예전에는 목록 끝에 "전체 N종목 중 상위 50종목"
 * 을 붙였는데, 그 줄은 **페이지네이션이 없던 동안의 임시 안내**였다
 * (`ResultSummary` 주석이 그렇게 적고 있었다). 이제 페이지를 넘길 수 있으므로
 * 그 자리는 `Pagination` 이 가져갔고, 둘을 다 두면 같은 숫자를 두 번 말한다.
 * 게다가 3페이지에서 "상위 50종목" 은 틀린 말이 된다.
 *
 * `<table>` 이 아니라 CSS 그리드 + ARIA 다(관심종목 표와 같은 방식). 진짜 표 요소는
 * 6열 중 하나만 다른 폭으로 접는 반응형을 만들 수 없다. 대신 지켜야 할 것이 하나
 * 있다: **`sr-only` 를 그리드 아이템에 직접 주면 안 된다** — position:absolute 가
 * 되어 그리드에서 빠지고 나머지 열이 한 칸씩 밀린다.
 *
 * 조각을 나눈 기준은 "같이 바뀌는가" 다. 머리 행과 본문 행은 열 정의를 공유하므로
 * tokens.ts 로 묶었고, 모바일 행은 열 구조 자체가 달라 별도 파일이다.
 */
export function RankingTable({ rows, sort }: RankingTableProps) {
  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-muted-60" style={{ fontSize: 12.5 }}>
        표시할 종목이 없습니다.
      </p>
    );
  }

  const sortedColumn = SORTED_COLUMN[sort];

  return (
    <>
      <div
        role="table"
        aria-label="종목 순위"
        aria-rowcount={rows.length + 1}
        className="hidden md:block"
      >
        <RankingHeadRow sortedColumn={sortedColumn} />
        {rows.map((row) => (
          <RankingRow key={row.code} row={row} />
        ))}
      </div>

      <ol className="flex flex-col md:hidden">
        {rows.map((row) => (
          <li key={row.code}>
            <RankingCard row={row} />
          </li>
        ))}
      </ol>

    </>
  );
}
