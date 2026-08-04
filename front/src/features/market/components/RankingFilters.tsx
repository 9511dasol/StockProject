import Link from "next/link";
import {
  BOARD_LABELS,
  RANKING_BOARDS,
  RANKING_SORTS,
  rankingHref,
  SORT_LABELS,
  type RankingBoard,
  type RankingSort,
} from "../model/ranking";

/**
 * 탐색 목록의 시장·정렬 칩.
 *
 * `<select>` 나 클라이언트 state 가 아니라 **링크**다. 필터가 URL 에 있으면
 * 공유·뒤로가기가 공짜로 따라오고, 이 화면이 서버 컴포넌트로 남는다.
 * (관심종목의 GroupTabs/SortControl 은 'use client' 라 여기에 쓸 수 없어 모양만 맞췄다.)
 *
 * 선택 상태는 반전 solid 다 — Chip variant="solid" · 검색 모드 칩과 같은 규칙.
 */
export function RankingFilters({
  sort,
  board,
  total,
}: {
  sort: RankingSort;
  board: RankingBoard;
  total: number;
}) {
  const current = { sort, board };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="시장">
        {RANKING_BOARDS.map((value) => (
          <Chip
            key={value}
            href={rankingHref(current, { board: value })}
            label={BOARD_LABELS[value]}
            selected={value === board}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="정렬">
        <span className="num text-muted-45" style={{ fontSize: 10.5 }}>
          {total.toLocaleString("ko-KR")}종목
        </span>
        {RANKING_SORTS.map((value) => (
          <Chip
            key={value}
            href={rankingHref(current, { sort: value })}
            label={SORT_LABELS[value]}
            selected={value === sort}
          />
        ))}
      </div>
    </div>
  );
}

function Chip({
  href,
  label,
  selected,
}: {
  href: string;
  label: string;
  selected: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={selected ? "true" : undefined}
      className={`flex min-h-[var(--tap)] items-center border px-[13px] py-[7px] font-medium md:min-h-0 ${
        selected
          ? "border-ink bg-ink text-on-ink"
          : "border-line-28 hover:bg-surface"
      }`}
      style={{ fontSize: 12.5 }}
    >
      {label}
    </Link>
  );
}
