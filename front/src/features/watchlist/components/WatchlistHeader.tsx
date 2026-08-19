"use client";

import { Icon } from "@/shared/ui";

const OUTLINE_BTN =
  "flex min-h-[var(--tap)] items-center border border-line-30 px-3.5 py-2 font-medium hover:bg-surface md:min-h-0";

interface WatchlistHeaderProps {
  itemCount: number;
  groupCount: number;
  activeAlerts: number;
  reordering: boolean;
  selectedCount: number;
  analyzing: boolean;
  onToggleReorder: () => void;
  onAdd: () => void;
  onAnalyze: () => void;
  /**
   * `page` 전체 폭 제목 줄 (표 보기 · 모바일).
   * `rail` 340px 사이드바 안 (분할 보기).
   */
  variant?: "page" | "rail";
}

/**
 * 관심 종목 제목과 액션.
 *
 * ## `rail` 이 생긴 이유
 *
 * 분할 보기에서 이 헤더가 전체 폭에 서 있었다. 그러면 제호(`Masthead`)의
 * `border-b-2` 바로 아래에 **이 헤더의 `border-b-2` 가 또 놓여**, 굵은 선 두 개가
 * 12px 간격으로 쌓이고 그 사이에 28px 제목이 낀다. 정작 화면의 본체(종목 상세)는
 * 그 아래에서야 시작한다 — 제호를 두 번 지나야 내용이 나오는 셈이다.
 *
 * `rail` 은 이 덩어리를 통째로 사이드바 안으로 옮긴다. 오른쪽 칸은 제호 바로 아래에서
 * 종목 상세로 시작하고, 왼쪽은 자기 제목을 자기 폭 안에서 갖는다.
 *
 * 제목 태그도 갈린다 — `rail` 은 `h2` 다. 그 옆(상세)에 종목명 `h1` 이 이미 있고,
 * 그때 이쪽이 h1 이면 한 화면에 최상위 제목이 둘이 된다. `page` 는 상세가 없는
 * 배치(표 보기·모바일)라 h1 이 맞다.
 */
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
  variant = "page",
}: WatchlistHeaderProps) {
  if (variant === "rail") {
    return (
      <header className="flex flex-col gap-2.5 border-b border-line-25 pb-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif-kr font-bold leading-none" style={{ fontSize: 17 }}>
            관심 종목{" "}
            <span className="font-serif-en text-muted-50" style={{ fontSize: 12 }}>
              Watchlist
            </span>
          </h2>
          <p
            className="font-mono uppercase tracking-label-wide text-muted-50"
            style={{ fontSize: 10 }}
          >
            {itemCount} 종목 · {groupCount} 그룹 · 알림 {activeAlerts}건
          </p>
        </div>

        {/* 340px 에 버튼 셋을 한 줄로 두면 글자가 눌린다. 둘 + 하나로 접는다. */}
        <div className="flex gap-1.5" style={{ fontSize: 12 }}>
          <button
            type="button"
            onClick={onToggleReorder}
            aria-pressed={reordering}
            className={
              reordering
                ? "flex flex-1 items-center justify-center border border-ink bg-ink px-2 py-1.5 font-medium text-on-ink"
                : "flex flex-1 items-center justify-center border border-line-30 px-2 py-1.5 font-medium hover:bg-surface"
            }
          >
            {reordering ? "편집 완료" : "순서 편집"}
          </button>
          <button
            type="button"
            onClick={onAdd}
            className="flex flex-1 items-center justify-center gap-1 border border-line-30 px-2 py-1.5 font-medium hover:bg-surface"
          >
            <Icon name="plus" size={13} />
            추가
          </button>
        </div>

        <button
          type="button"
          onClick={onAnalyze}
          disabled={selectedCount === 0 || analyzing}
          className="flex items-center justify-center gap-[7px] bg-ink px-3 py-2 font-medium text-on-ink disabled:bg-line-30 disabled:text-muted-50"
          style={{ fontSize: 12 }}
        >
          <span aria-hidden className="dot block h-[5px] w-[5px] bg-up" />
          {analyzing
            ? "AI 분석 중"
            : selectedCount > 0
              ? `선택 ${selectedCount}종목 AI 분석`
              : "AI 분석"}
        </button>
      </header>
    );
  }

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
