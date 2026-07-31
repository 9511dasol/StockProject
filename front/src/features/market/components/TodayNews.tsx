import type { MarketNewsItem } from "../model/types";

export function TodayNews({ items }: { items: MarketNewsItem[] }) {
  return (
    <section className="flex flex-col gap-[11px] bg-surface p-4">
      <h2
        className="border-b border-line-20 pb-2 font-mono font-medium uppercase tracking-label"
        style={{ fontSize: 11 }}
      >
        오늘의 뉴스
      </h2>
      {items.map((item) => (
        <a
          key={item.title}
          href={item.url}
          className="flex min-h-[var(--tap)] flex-col justify-center gap-1 border-b border-dotted border-line-22 pb-[9px] md:min-h-0"
        >
          <span
            className="font-serif-kr font-medium text-pretty"
            style={{ fontSize: 14, lineHeight: 1.45 }}
          >
            {item.title}
          </span>
          <span
            className="font-mono text-muted-50"
            style={{ fontSize: 9.5 }}
          >
            {item.publisher} · {item.time}
          </span>
        </a>
      ))}
    </section>
  );
}
