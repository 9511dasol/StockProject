import { marketCapKR, multiple, unsignedPercent } from "@/lib/format";
import Link from "next/link";
import type { ScreenerSort } from "../../model/screener";
import type { ScreenedStock } from "../../services/getScreener";

export interface ScreenerCardProps {
  row: ScreenedStock;
  /** 지금 목록을 만든 축. 그 지표를 오른쪽에 크게 세운다 */
  sort: ScreenerSort;
}

/** 정렬 축 → 그 축의 값과 표기법. 축이 다섯이라 조건문 다섯 줄 대신 표로 둔다. */
const HEADLINE: Record<
  ScreenerSort,
  { label: string; pick: (row: ScreenedStock) => number | null; format: (v: number) => string }
> = {
  market_cap: { label: "시가총액", pick: (row) => row.marketCap, format: marketCapKR },
  per: { label: "PER", pick: (row) => row.per, format: multiple },
  pbr: { label: "PBR", pick: (row) => row.pbr, format: multiple },
  dividend_yield: {
    label: "배당",
    pick: (row) => row.dividendYieldPct,
    format: unsignedPercent,
  },
  roe: { label: "ROE", pick: (row) => row.roePct, format: unsignedPercent },
};

/**
 * 모바일(<768) 목록의 한 줄.
 *
 * **정렬 축의 지표를 오른쪽에 세운다.** 375px 에 지표 다섯을 다 넣으면 전부 읽을 수
 * 없는 크기가 된다. 그런데 이 화면에서 사용자가 방금 고른 것이 정렬 축이므로, 그
 * 값 하나만 크게 보여주는 편이 다섯을 뭉개는 것보다 낫다 — 나머지는 코드 줄에
 * 시가총액만 덧붙이고(랭킹 카드와 같은 자리), 전체는 종목 상세가 말한다.
 *
 * 정렬이 시가총액일 때 코드 줄의 시총과 오른쪽 값이 겹치므로 그때는 코드 줄에서 뺀다.
 *
 * 44px 최소 높이는 터치 히트 영역이다 (WCAG 2.5.5).
 */
export function ScreenerCard({ row, sort }: ScreenerCardProps) {
  const headline = HEADLINE[sort];
  const value = headline.pick(row);
  const showCapInline = sort !== "market_cap" && row.marketCap !== null;

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
          {showCapInline ? ` · ${marketCapKR(row.marketCap as number)}` : ""}
        </span>
      </span>

      <span className="flex flex-none flex-col items-end gap-0.5">
        <span className="num font-medium" style={{ fontSize: 13 }}>
          {value === null ? "—" : headline.format(value)}
        </span>
        <span
          className="font-mono uppercase tracking-label text-muted-45"
          style={{ fontSize: 9 }}
        >
          {headline.label}
        </span>
      </span>
    </Link>
  );
}
