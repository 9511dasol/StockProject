"use client";

import { Icon } from "@/shared/ui";

const OUTLINE_BTN =
  "flex min-h-[var(--tap)] items-center border border-line-30 px-3.5 py-2 font-medium hover:bg-surface md:min-h-0";

export function WatchlistHeader({
  itemCount,
  groupCount,
  activeAlerts,
  reordering,
  selectedCount,
  analyzing,
  onToggleReorder,
  onAdd,
  onAnalyze,
}: {
  itemCount: number;
  groupCount: number;
  activeAlerts: number;
  reordering: boolean;
  selectedCount: number;
  analyzing: boolean;
  onToggleReorder: () => void;
  onAdd: () => void;
  onAnalyze: () => void;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-ink pb-3">
      <div className="flex flex-col gap-1">
        <h1
          className="font-serif-kr font-bold leading-none"
          style={{ fontSize: 28 }}
        >
          관심 종목{" "}
          <span
            className="font-serif-en text-muted-50"
            style={{ fontSize: 16 }}
          >
            Watchlist
          </span>
        </h1>
        <p
          className="font-mono uppercase tracking-label-wide text-muted-50"
          style={{ fontSize: 10.5 }}
        >
          {itemCount} 종목 · {groupCount} 그룹 · 알림 {activeAlerts}건 활성
        </p>
      </div>

      {/* 모바일은 '＋종목추가'·'전체 AI 분석'을 하단 고정 바가 맡는다.
          여기까지 같이 띄우면 같은 동작이 한 화면에 두 번 나온다.
          하단 바에 대응이 없는 '순서 편집'만 남긴다. */}
      <div className="flex items-center gap-2 md:hidden" style={{ fontSize: 12.5 }}>
        <button
          type="button"
          onClick={onToggleReorder}
          aria-pressed={reordering}
          className={
            reordering
              ? "flex min-h-[var(--tap)] items-center border border-ink bg-ink px-3.5 py-2 font-medium text-on-ink"
              : OUTLINE_BTN
          }
        >
          {reordering ? "순서 편집 완료" : "순서 편집"}
        </button>
      </div>

      <div className="hidden items-center gap-2 md:flex" style={{ fontSize: 12.5 }}>
        <button
          type="button"
          onClick={onToggleReorder}
          aria-pressed={reordering}
          className={
            reordering
              ? "flex min-h-[var(--tap)] items-center border border-ink bg-ink px-3.5 py-2 font-medium text-on-ink md:min-h-0"
              : OUTLINE_BTN
          }
        >
          {reordering ? "순서 편집 완료" : "순서 편집"}
        </button>
        <button type="button" onClick={onAdd} className={`${OUTLINE_BTN} gap-1.5`}>
          <Icon name="plus" size={14} />
          종목 추가
        </button>
        <button
          type="button"
          onClick={onAnalyze}
          disabled={selectedCount === 0 || analyzing}
          className="flex min-h-[var(--tap)] items-center gap-[7px] bg-ink px-4 py-2 font-medium text-on-ink disabled:bg-line-30 disabled:text-muted-50 md:min-h-0"
        >
          <span aria-hidden className="dot block h-[5px] w-[5px] bg-up" />
          {/* '선택 0종목 AI 분석' 은 비활성 버튼에 0 을 박아 읽기 시끄럽다.
              고를 게 있을 때만 개수를 말한다. */}
          {analyzing
            ? "AI 분석 중"
            : selectedCount > 0
              ? `선택 ${selectedCount}종목 AI 분석`
              : "AI 분석"}
        </button>
      </div>
    </header>
  );
}
