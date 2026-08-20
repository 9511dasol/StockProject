import Link from "next/link";
import {
  deltaColorClass,
  percent as fmtPercent,
  price as fmtPrice,
} from "@/lib/format";
import { Sparkline } from "@/shared/ui";
import type { Mover } from "../model/types";

export function MoverList({
  title,
  scope,
  items,
  headless = false,
}: {
  title: string;
  scope: string;
  items: Mover[];
  /** 모바일 탭 안에서는 제목 줄을 탭이 대신하므로 숨긴다 */
  headless?: boolean;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      {headless ? null : (
        <div className="flex items-baseline justify-between gap-4 border-b border-line-20 pb-2">
          <h2
            className="font-mono font-medium uppercase tracking-label"
            style={{ fontSize: 11 }}
          >
            {title}
          </h2>
          <span
            className="font-mono text-muted-45"
            style={{ fontSize: 10 }}
          >
            {scope}
          </span>
        </div>
      )}

      <ol className="flex flex-col gap-2.5">
        {items.map((item, index) => (
          <li key={item.code}>
            <Link
              href={`/stocks/${item.code}`}
              className="flex min-h-[var(--tap)] items-center gap-3 border-b border-dotted border-line-20 pb-[9px] hover:bg-surface-hover md:min-h-0"
            >
              <span
                className="num w-[14px] flex-none text-muted-35"
                style={{ fontSize: 12 }}
              >
                {index + 1}
              </span>
              <span className="flex flex-1 flex-col gap-0.5">
                <span
                  className="font-serif-kr font-medium"
                  style={{ fontSize: 14 }}
                >
                  {item.name}
                </span>
                <span
                  className="font-mono text-muted-45"
                  style={{ fontSize: 9.5 }}
                >
                  {item.nameEn ? `${item.code} · ${item.nameEn}` : item.code}
                </span>
              </span>
              <Sparkline
                points={item.spark}
                changePercent={item.changePercent}
                w={76}
                h={24}
              />
              <span className="num flex flex-none flex-col items-end gap-0.5">
                <span className="font-medium" style={{ fontSize: 13 }}>
                  {fmtPrice(item.price)}
                </span>
                <span
                  className={`font-medium ${deltaColorClass(item.changePercent)}`}
                  style={{ fontSize: 11 }}
                >
                  {fmtPercent(item.changePercent)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
