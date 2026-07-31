import { price as fmtPrice, relative } from "@/lib/format";
import { Chip, DottedRow } from "@/shared/ui";
import type { AnalystReport } from "../model/types";

export function ReportList({
  items,
  now,
}: {
  items: AnalystReport[];
  now: string;
}) {
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-muted-60" style={{ fontSize: 12.5 }}>
        표시할 리포트가 없습니다.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-3">
      {items.map((item, index) => (
        <li key={item.publisher + item.title}>
          <DottedRow tone="news" align="start" className="gap-3.5 pb-3">
            <span
              className="num w-4 flex-none text-muted-35"
              style={{ fontSize: 13 }}
            >
              {String(index).padStart(2, "0")}
            </span>
            <span className="flex flex-1 flex-col gap-[5px]">
              <span
                className="font-serif-kr font-medium leading-[1.4] text-pretty"
                style={{ fontSize: 16.5 }}
              >
                {item.title}
              </span>
              <span
                className="text-pretty text-ink-2"
                style={{ fontSize: 12.5, lineHeight: 1.65 }}
              >
                {item.summary}
              </span>
              <span
                className="font-mono tracking-label-tight text-muted-50"
                style={{ fontSize: 10.5 }}
              >
                {item.publisher} · {relative(item.publishedAt, now)}
                {item.targetTo
                  ? ` · 목표가 ${fmtPrice(item.targetTo)}`
                  : ""}
              </span>
            </span>
            {item.opinion ? (
              <span className="flex-none">
                <Chip>{item.opinion}</Chip>
              </span>
            ) : null}
          </DottedRow>
        </li>
      ))}
    </ol>
  );
}
