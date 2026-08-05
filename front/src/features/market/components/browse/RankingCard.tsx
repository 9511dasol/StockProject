import Link from "next/link";
import {
  deltaColorClass,
  percent as fmtPercent,
  price as fmtPrice,
  marketCapKR,
} from "@/lib/format";
import { Sparkline } from "@/shared/ui";
import type { RankedStock } from "../../services/getStockRanking";

export interface RankingCardProps {
  row: RankedStock;
}

/**
 * 모바일(<768) 목록의 한 줄. 홈의 MoverList 와 같은 행 모양이다.
 *
 * 375px 에 6열을 밀어 넣으면 종목명이 잘리므로 시가총액을 코드 줄로 접고, 가격과
 * 등락률을 오른쪽에 세로로 쌓는다. 데스크탑 표와 조각을 나눈 것도 이 때문이다 —
 * 한 마크업을 CSS 로 접으려 하면 두 레이아웃 어느 쪽도 깔끔해지지 않는다.
 *
 * 44px 최소 높이는 터치 히트 영역이다 (WCAG 2.5.5).
 */
export function RankingCard({ row }: RankingCardProps) {
  return (
    <Link
      href={`/stocks/${row.code}`}
      className="flex min-h-[var(--tap)] items-center gap-3 border-b border-dotted border-line-22 py-2.5 hover:bg-surface-hover"
    >
      <span className="num w-6 flex-none text-right text-muted-35" style={{ fontSize: 12 }}>
        {row.rank}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-serif-kr font-medium" style={{ fontSize: 14 }}>
          {row.name}
        </span>
        <span className="num text-muted-45" style={{ fontSize: 9.5 }}>
          {row.code} · {row.board}
          {row.marketCap === null ? "" : ` · ${marketCapKR(row.marketCap)}`}
        </span>
      </span>

      <Sparkline points={row.spark} changePercent={row.changePercent} w={60} h={22} />

      <span className="num flex flex-none flex-col items-end gap-0.5">
        <span className="font-medium" style={{ fontSize: 13 }}>
          {fmtPrice(row.price)}
        </span>
        <span
          className={`font-medium ${deltaColorClass(row.changePercent)}`}
          style={{ fontSize: 11 }}
        >
          {fmtPercent(row.changePercent)}
        </span>
      </span>
    </Link>
  );
}
