"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { decimal, price as fmtPrice } from "@/lib/format";
import { Delta, Icon, Sparkline } from "@/shared/ui";
import { returnPercent, type RowAiStatus, type WatchItem } from "../model/types";
import { AlertToggle } from "./AlertToggle";
import { VerdictCell } from "./VerdictCell";

/**
 * 모바일 2단 카드 행.
 * 1단 = 이름·스파크·가격, 2단 = 보유·알림·AI 판단 (README 5절).
 */
export function WatchCard({
  item,
  reordering,
  selected,
  aiStatus,
  onSelect,
  onToggleAlert,
}: {
  item: WatchItem;
  reordering: boolean;
  selected: boolean;
  aiStatus?: RowAiStatus;
  onSelect: (next: boolean) => void;
  onToggleAlert: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.code, disabled: !reordering });

  const overseas = item.market === "NASDAQ" || item.market === "NYSE";
  const gain = returnPercent(item);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex gap-2.5 border-b border-dotted border-line-22 py-3 ${
        isDragging ? "relative z-10 bg-surface-hover" : ""
      } ${selected ? "bg-surface" : ""}`}
    >
      {reordering ? (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`${item.name} 순서 이동`}
          className="-my-2 flex min-h-[var(--tap)] min-w-[var(--tap)] flex-none cursor-grab items-start justify-center pt-3 text-muted-30"
        >
          <Icon name="drag" size={16} />
        </button>
      ) : (
        // 13px 체크박스를 44px 라벨로 감싼다 — 상자 크기는 그대로 두고
        // 누를 수 있는 영역만 넓힌다.
        <label className="-my-2 flex min-h-[var(--tap)] min-w-[var(--tap)] flex-none cursor-pointer items-start justify-center pt-3">
          <span className="sr-only">{item.name} 선택</span>
          <input
            type="checkbox"
            checked={selected}
            onChange={(event) => onSelect(event.target.checked)}
            className="h-[13px] w-[13px] flex-none accent-[var(--ink)]"
          />
        </label>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start gap-2.5">
          <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <Link
              href={`/stocks/${item.code}`}
              className="-my-2 flex min-h-[var(--tap)] items-center font-serif-kr font-medium"
              style={{ fontSize: 16.5 }}
            >
              {item.name}
            </Link>
            <span className="font-mono text-muted-50" style={{ fontSize: 10 }}>
              {item.symbol} · {item.group}
            </span>
          </span>
          <Sparkline
            points={item.spark}
            changePercent={item.changePercent}
            w={104}
            h={28}
          />
          <span className="num flex flex-none flex-col items-end gap-0.5">
            <span className="font-medium" style={{ fontSize: 14 }}>
              {overseas ? `$${decimal(item.price, 2)}` : fmtPrice(item.price)}
            </span>
            <Delta changePercent={item.changePercent} arrow={false} size={12} />
          </span>
        </div>

        {/* 2단은 flex-wrap 이었다 — 내용 길이에 따라 행마다 다른 자리에서 접혀
            카드 높이와 요소 위치가 제각각이었다. 두 줄로 고정한다:
            (a) 보유·평가손익 ↔ AI 판단, (b) 알림 토글 + 조건 칩. */}
        <div className="flex items-center justify-between gap-3">
          <span className="num min-w-0 truncate text-muted-70" style={{ fontSize: 11.5 }}>
            {item.holding ? (
              <>
                {item.holding.quantity}주 ·{" "}
                {overseas
                  ? `$${decimal(item.holding.avgPrice, 2)}`
                  : fmtPrice(item.holding.avgPrice)}
              </>
            ) : (
              <span className="text-muted-40">관심만</span>
            )}
          </span>

          <span className="flex flex-none items-center gap-3">
            {item.holding ? (
              <Delta changePercent={gain ?? 0} arrow={false} size={11.5} />
            ) : null}
            <VerdictCell
              verdict={item.verdict}
              changePercent={item.changePercent}
              status={aiStatus}
            />
          </span>
        </div>

        {/* 알림 조건은 테두리 칩 + 벨 (디자인 4b 모바일 2단).
            평문으로 두면 옆의 보유·평가손익과 같은 무게로 읽혀 행이 뭉갠다. */}
        <div className="flex items-center gap-2">
          <AlertToggle
            enabled={item.alert.enabled}
            label={item.name}
            onToggle={onToggleAlert}
          />
          <span
            className={`flex min-w-0 items-center gap-1 border border-line-22 px-[7px] py-0.5 font-mono ${
              item.alert.enabled ? "text-muted-60" : "text-muted-35"
            }`}
            style={{ fontSize: 10 }}
          >
            <Icon
              name={item.alert.enabled ? "bell" : "bell-off"}
              size={12}
              className="flex-none"
            />
            <span className="truncate">{item.alert.condition}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
