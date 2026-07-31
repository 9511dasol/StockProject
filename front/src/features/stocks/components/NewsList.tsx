import { relative } from "@/lib/format";
import { DottedRow } from "@/shared/ui";
import type { NewsItem } from "../model/types";
import { NewsThumbnail } from "./NewsThumbnail";

export function NewsList({
  items,
  now,
}: {
  items: NewsItem[];
  now: string;
}) {
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-muted-60" style={{ fontSize: 12.5 }}>
        표시할 뉴스가 없습니다.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-3">
      {items.map((item, index) => (
        <li key={`${item.publisher}-${item.title}`}>
          <DottedRow tone="news" align="start" className="gap-3.5 pb-3">
            <span
              className="num w-4 flex-none text-muted-35"
              style={{ fontSize: 13 }}
            >
              {String(index).padStart(2, "0")}
            </span>
            <span className="flex flex-1 flex-col gap-[5px]">
              {/* 링크 없는 기사는 앵커로 감싸지 않는다 — href="" 는 현재 문서를
                  다시 불러오는 동작이라 클릭하면 페이지가 통째로 리로드된다. */}
              <Title url={item.url}>{item.title}</Title>
              <span
                className="font-mono tracking-label-tight text-muted-50"
                style={{ fontSize: 10.5 }}
              >
                {item.publisher} · {relative(item.publishedAt, now)}
              </span>
            </span>
            <NewsThumbnail src={item.thumbnail} alt="" />
          </DottedRow>
        </li>
      ))}
    </ol>
  );
}

const TITLE =
  "flex min-h-[var(--tap)] items-center font-serif-kr font-medium leading-[1.4] text-pretty md:min-h-0 md:block";

function Title({ url, children }: { url?: string; children: React.ReactNode }) {
  if (!url) {
    return (
      <span className={TITLE} style={{ fontSize: 16.5 }}>
        {children}
      </span>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${TITLE} hover:text-up`}
      style={{ fontSize: 16.5 }}
    >
      {children}
    </a>
  );
}
