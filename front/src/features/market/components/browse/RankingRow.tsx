import Link from "next/link";
import {
  deltaColorClass,
  percent as fmtPercent,
  price as fmtPrice,
  marketCapKR,
} from "@/lib/format";
import { Sparkline } from "@/shared/ui";
import type { RankedStock } from "../../services/getStockRanking";
import { RANKING_GRID } from "./tokens";

export interface RankingRowProps {
  row: RankedStock;
}

/**
 * 데스크탑 표의 본문 행 하나. 행 전체가 종목 상세로 가는 링크다.
 *
 * 열 순서·폭은 머리 행과 같은 토큰(RANKING_GRID)에서 온다 — 여기서 따로 적으면
 * 열 하나를 넓히는 순간 머리와 본문이 어긋난다.
 */
export function RankingRow({ row }: RankingRowProps) {
  return (
    <Link
      role="row"
      href={`/stocks/${row.code}`}
      className={`${RANKING_GRID} border-b border-dotted border-line-22 py-2.5 hover:bg-surface-hover`}
    >
      <span role="cell" className="num text-right text-muted-35" style={{ fontSize: 12 }}>
        {row.rank}
      </span>

      <span role="cell" className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-serif-kr font-medium" style={{ fontSize: 14 }}>
          {row.name}
        </span>
        <span className="num text-muted-45" style={{ fontSize: 9.5 }}>
          {row.code} · {row.board}
        </span>
      </span>

      <span role="cell" className="flex justify-end">
        <Sparkline points={row.spark} changePercent={row.changePercent} w={76} h={24} />
      </span>

      <span role="cell" className="num text-right font-medium" style={{ fontSize: 13 }}>
        {fmtPrice(row.price)}
      </span>

      <span
        role="cell"
        className={`num text-right font-medium ${deltaColorClass(row.changePercent)}`}
        style={{ fontSize: 12.5 }}
      >
        {fmtPercent(row.changePercent)}
      </span>

      {/* 시총 미수집은 대시로 남긴다 — 목록에서는 행을 뺄 수 없으니 빈칸이 정직하다 */}
      <span role="cell" className="num text-right text-muted-60" style={{ fontSize: 12.5 }}>
        {row.marketCap === null ? "—" : marketCapKR(row.marketCap)}
      </span>
    </Link>
  );
}
