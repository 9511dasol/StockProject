import Link from "next/link";
import {
  deltaColorClass,
  percent as fmtPercent,
  price as fmtPrice,
  marketCapKR,
} from "@/lib/format";
import { Sparkline } from "@/shared/ui";
import type { RankedStock } from "../services/getStockRanking";

/**
 * 종목 탐색 목록.
 *
 * 데스크탑은 표, 모바일은 MoverList 와 같은 행 모양으로 접는다 — 375px 에 시총까지
 * 6열을 밀어 넣으면 종목명이 잘린다.
 *
 * `<table>` 이 아니라 CSS 그리드 + ARIA 다(관심종목 표와 같은 방식). 대신 지켜야 할
 * 것이 하나 있다: **`sr-only` 를 그리드 아이템에 직접 주면 안 된다** — position:absolute
 * 가 되어 그리드에서 빠지고 나머지 열이 한 칸씩 밀린다.
 */

/** 순위 · 종목 · 3개월 · 현재가 · 등락률 · 시가총액 */
const GRID = "grid grid-cols-[40px_1.6fr_92px_112px_92px_124px] items-center gap-3";

const HEAD = "font-mono font-medium uppercase tracking-label-wide text-muted-50";

export function RankingTable({ rows }: { rows: RankedStock[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-muted-60" style={{ fontSize: 12.5 }}>
        표시할 종목이 없습니다.
      </p>
    );
  }

  return (
    <>
      {/* 데스크탑 표 */}
      <div
        role="table"
        aria-label="종목 순위"
        aria-rowcount={rows.length + 1}
        className="hidden md:block"
      >
        <div
          role="row"
          className={`${GRID} border-b border-line-20 pb-2`}
          style={{ fontSize: 10 }}
        >
          <span role="columnheader" className={`${HEAD} text-right`}>
            #
          </span>
          <span role="columnheader" className={HEAD}>
            종목
          </span>
          <span role="columnheader" className={`${HEAD} text-right`}>
            3개월
          </span>
          <span role="columnheader" className={`${HEAD} text-right`}>
            현재가
          </span>
          <span role="columnheader" className={`${HEAD} text-right`}>
            등락률
          </span>
          <span role="columnheader" className={`${HEAD} text-right`}>
            시가총액
          </span>
        </div>

        {rows.map((row) => (
          <Link
            key={row.code}
            role="row"
            href={`/stocks/${row.code}`}
            className={`${GRID} border-b border-dotted border-line-22 py-2.5 hover:bg-surface-hover`}
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
        ))}
      </div>

      {/* 모바일 — 시총을 접고 세로 스택 */}
      <ol className="flex flex-col md:hidden">
        {rows.map((row) => (
          <li key={row.code}>
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
          </li>
        ))}
      </ol>
    </>
  );
}
