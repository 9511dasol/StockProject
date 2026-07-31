"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useMemo, useState } from "react";
import { Icon } from "@/shared/ui";
import { useBulkAdvice } from "@/features/advice";
import {
  BulkActionBar,
  GroupTabs,
  returnPercent,
  SortControl,
  TableHeader,
  WatchCard,
  WatchlistHeader,
  WatchRow,
  type RowAiStatus,
  type SortKey,
  type WatchItem,
  type Watchlist,
} from "@/features/watchlist";

/**
 * 관심종목 화면의 상태 소유자.
 *
 * features/ 가 아니라 app/<route>/_components/ 에 둔 이유: 이 화면은
 * features/watchlist(표)와 features/advice(일괄 AI 분석)를 함께 써야 하는데,
 * feature 끼리는 직접 import 할 수 없다. 두 feature 를 잇는 조립은 app 계층의
 * 일이고, 이 컴포넌트는 다른 라우트에서 재사용하지 않는다 (CONVENTIONS 예외 항목).
 */
export function WatchlistBoard({ initial }: { initial: Watchlist }) {
  const [items, setItems] = useState(initial.items);
  const [group, setGroup] = useState("전체");
  const [sort, setSort] = useState<SortKey>("order");
  const [selected, setSelected] = useState<string[]>([]);
  const [reordering, setReordering] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const bulk = useBulkAdvice();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const visible = useMemo(() => {
    const filtered =
      group === "전체" ? items : items.filter((item) => item.group === group);
    if (sort === "order") return filtered;
    return [...filtered].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "ko");
      if (sort === "change") return b.changePercent - a.changePercent;
      return (returnPercent(b) ?? -Infinity) - (returnPercent(a) ?? -Infinity);
    });
  }, [items, group, sort]);

  /**
   * '직접 정렬'일 때만 순서를 바꾼다.
   *
   * 정렬이 걸린 상태에서는 화면 순서(visible)와 저장 순서(items)가 다르다.
   * 그때 arrayMove 를 items 기준으로 돌리면, 화면은 정렬로 다시 그려져 아무
   * 일도 없어 보이는데 원본 순서만 사용자가 의도하지 않은 자리로 바뀐다.
   * 아래 reorderable 이 핸들 자체를 내주지 않으므로 여기 도달할 일은 없지만,
   * 키보드 센서 등 다른 경로를 위해 가드를 남긴다.
   */
  function onDragEnd(event: DragEndEvent) {
    if (sort !== "order") return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const previous = items;
    const from = items.findIndex((item) => item.code === active.id);
    const to = items.findIndex((item) => item.code === over.id);
    if (from === -1 || to === -1) return;

    const next = arrayMove(items, from, to);
    setItems(next);

    // TODO(백엔드 연결): PATCH /watchlist/order { codes: next.map(i => i.code) }
    // .catch(() => { setItems(previous); setNotice("순서를 저장하지 못했습니다."); })
    void previous;
  }

  /**
   * `Parameters<typeof Object.assign>[1]` 을 쓰던 자리다. 그 타입은 제네릭이
   * 소거돼 사실상 unknown 이라 patchItem("a", 42) 도 통과했다 — 즉 아무 검사도
   * 받지 않았다. WatchItem 의 부분 집합으로 좁힌다.
   */
  function patchItem(code: string, patch: Partial<WatchItem>) {
    setItems((prev) =>
      prev.map((item) => (item.code === code ? { ...item, ...patch } : item)),
    );
  }

  function toggleSelect(code: string, next: boolean) {
    setSelected((prev) =>
      next ? [...prev, code] : prev.filter((c) => c !== code),
    );
  }

  function analyze() {
    const targets = items
      .filter((item) => selected.includes(item.code))
      .map((item) => ({ code: item.code, symbol: item.symbol }));
    if (targets.length) bulk.start(targets);
  }

  /** advice 의 진행 상태를 표가 이해하는 형태로 좁힌다 */
  function aiStatus(code: string): RowAiStatus | undefined {
    const entry = bulk.entries[code];
    if (!entry) return undefined;
    return {
      stage: entry.stage,
      running: entry.running,
      verdict: entry.decision?.decisionLabel,
      error: Boolean(entry.error),
    };
  }

  const codes = visible.map((item) => item.code);
  // 순서 편집 모드 + 직접 정렬일 때만 드래그를 허용한다. 둘 중 하나라도
  // 아니면 핸들 대신 체크박스가 뜬다 — 옮길 수 없는 핸들을 보여주지 않는다.
  const reorderable = reordering && sort === "order";

  return (
    <div className="flex flex-col gap-5">
      <WatchlistHeader
        itemCount={initial.totalCount}
        groupCount={initial.groupCount}
        activeAlerts={initial.activeAlerts}
        reordering={reordering}
        selectedCount={selected.length}
        analyzing={bulk.remaining > 0}
        onToggleReorder={() => setReordering((v) => !v)}
        onAdd={() => setNotice("종목 추가는 ⌘K 검색에서 ⇥ 로 할 수 있습니다.")}
        onAnalyze={analyze}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <GroupTabs groups={initial.groups} active={group} onChange={setGroup} />
        <SortControl
          value={sort}
          totalReturnPercent={initial.totalReturnPercent}
          onChange={setSort}
        />
      </div>

      {reordering && sort !== "order" ? (
        <p
          role="status"
          className="border border-dashed border-line-30 px-3 py-2 text-muted-70"
          style={{ fontSize: 12 }}
        >
          정렬이 걸려 있는 동안에는 순서를 바꿀 수 없습니다. 정렬을 &lsquo;직접
          정렬&rsquo;로 두면 드래그 핸들이 나타납니다.
        </p>
      ) : null}

      {notice ? (
        <p
          role="status"
          className="border border-dashed border-line-30 px-3 py-2 text-muted-70"
          style={{ fontSize: 12 }}
        >
          {notice}
        </p>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={codes} strategy={verticalListSortingStrategy}>
          {/* 데스크탑 표 — CSS 그리드라 표 구조가 없어 ARIA 로 알려준다 */}
          <div
            role="table"
            aria-label="관심 종목"
            aria-rowcount={visible.length + 1}
            className="hidden md:block"
          >
            <TableHeader />
            {visible.length === 0 ? (
              <EmptyState group={group} />
            ) : (
              visible.map((item) => (
                <WatchRow
                  key={item.code}
                  item={item}
                  reordering={reorderable}
                  selected={selected.includes(item.code)}
                  aiStatus={aiStatus(item.code)}
                  onSelect={(next) => toggleSelect(item.code, next)}
                  onToggleAlert={() =>
                    patchItem(item.code, {
                      alert: { ...item.alert, enabled: !item.alert.enabled },
                    })
                  }
                  onChangeCondition={(condition) =>
                    patchItem(item.code, { alert: { ...item.alert, condition } })
                  }
                />
              ))
            )}
          </div>

          {/* 모바일 2단 카드 */}
          <div className="md:hidden">
            {visible.length === 0 ? (
              <EmptyState group={group} />
            ) : (
              visible.map((item) => (
                <WatchCard
                  key={item.code}
                  item={item}
                  reordering={reorderable}
                  selected={selected.includes(item.code)}
                  aiStatus={aiStatus(item.code)}
                  onSelect={(next) => toggleSelect(item.code, next)}
                  onToggleAlert={() =>
                    patchItem(item.code, {
                      alert: { ...item.alert, enabled: !item.alert.enabled },
                    })
                  }
                />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>

      {selected.length > 0 ? (
        <BulkActionBar
          count={selected.length}
          analyzing={bulk.remaining > 0}
          remaining={bulk.remaining}
          onMoveGroup={() => setNotice("그룹 이동은 백엔드 저장소가 필요합니다.")}
          onBulkAlert={() =>
            setNotice("알림 일괄 설정은 백엔드 저장소가 필요합니다.")
          }
          onDelete={() => {
            setItems((prev) =>
              prev.filter((item) => !selected.includes(item.code)),
            );
            setSelected([]);
          }}
        />
      ) : null}

      {/* 모바일 하단 고정 액션 2개.
          bottom-0 이 아니라 --tabbar-h 만큼 띄운다 — MobileTabBar 도 bottom-0 을
          잡고 있어 그대로 두면 두 바가 정확히 포개진다. */}
      <div
        className="fixed inset-x-0 z-20 flex gap-2 border-t-2 border-ink bg-paper px-4 pb-3 pt-3 md:hidden"
        style={{ bottom: "calc(var(--tabbar-h) + var(--safe-b))" }}
      >
        <button
          type="button"
          onClick={() => setNotice("종목 추가는 ⌘K 검색에서 ⇥ 로 할 수 있습니다.")}
          className="flex min-h-[var(--tap)] flex-1 items-center justify-center gap-1.5 border border-line-30 py-3 font-medium"
          style={{ fontSize: 13 }}
        >
          <Icon name="plus" size={15} />
          종목 추가
        </button>
        <button
          type="button"
          onClick={() =>
            bulk.start(
              visible.map((item) => ({ code: item.code, symbol: item.symbol })),
            )
          }
          disabled={bulk.remaining > 0}
          className="min-h-[var(--tap)] flex-1 bg-ink py-3 font-medium text-on-ink disabled:bg-line-30 disabled:text-muted-50"
          style={{ fontSize: 13 }}
        >
          {bulk.remaining > 0 ? `분석 중 ${bulk.remaining}` : "전체 AI 분석"}
        </button>
      </div>
    </div>
  );
}

function EmptyState({ group }: { group: string }) {
  return (
    <div className="flex flex-col items-center gap-2 border-b border-dotted border-line-22 py-12">
      <p
        className="font-mono uppercase tracking-label text-muted-35"
        style={{ fontSize: 10.5 }}
      >
        empty
      </p>
      <p className="text-muted-60" style={{ fontSize: 12.5 }}>
        {group === "전체"
          ? "관심 종목이 없습니다. ⌘K 검색에서 ⇥ 로 추가하세요."
          : `'${group}' 그룹에 종목이 없습니다.`}
      </p>
    </div>
  );
}
