"use client";

import { Icon } from "@/shared/ui";
import { useSearch } from "./SearchProvider";

/**
 * 검색 팔레트를 여는 버튼. 실제 입력은 팔레트 안에서 받는다.
 *
 * variant
 *  - "field" 마스트헤드의 250px 검색 필드 (데스크탑)
 *  - "tab"   모바일 하단 탭바 항목
 */
export function SearchTrigger({
  variant = "field",
}: {
  variant?: "field" | "tab";
}) {
  const { open } = useSearch();

  if (variant === "tab") {
    return (
      <button
        type="button"
        onClick={open}
        aria-label="종목 검색 열기"
        className="flex min-h-[var(--tap)] min-w-[var(--tap)] flex-col items-center justify-center gap-1 text-muted-35"
        style={{ fontSize: 10 }}
      >
        <Icon name="search" size={17} />
        검색
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      aria-label="종목 검색 열기 (Ctrl+K)"
      className="flex w-[250px] items-center gap-2 border border-line-28 bg-field px-3 py-2 text-left hover:border-ink"
    >
      <Icon name="search" size={15} className="flex-none text-muted-35" />
      <span className="text-muted-45" style={{ fontSize: 13 }}>
        종목명 · 코드 · 초성
      </span>
      <span
        aria-hidden
        className="ml-auto font-mono font-medium tracking-[0.08em] text-muted-35"
        style={{ fontSize: 9.5 }}
      >
        ⌘K
      </span>
    </button>
  );
}
