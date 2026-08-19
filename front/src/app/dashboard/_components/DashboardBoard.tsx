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
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { Icon } from "@/shared/ui";
import { MAX_BULK_SYMBOLS, useBulkAdvice } from "@/features/advice";
import {
  ALL_GROUP,
  BulkActionBar,
  GroupTabs,
  SortControl,
  TableHeader,
  visibleItems,
  WatchCard,
  WatchlistHeader,
  WatchRow,
  WatchRowCompact,
  useWatchlistMutations,
  type AlertRule,
  type RowAiStatus,
  type SortKey,
  type WatchItem,
  type Watchlist,
} from "@/features/watchlist";

/** 데스크탑 보기 — nav+상세 분할 / 표(전체 폭) */
type BoardLayout = "split" | "table";

/**
 * 대시보드의 상태 소유자 — 좌측 종목 nav 와 그 컨트롤.
 *
 * features/ 가 아니라 app/<route>/_components/ 에 둔 이유: 이 화면은
 * features/watchlist(표)와 features/advice(일괄 AI 분석)를 함께 써야 하는데,
 * feature 끼리는 직접 import 할 수 없다. 두 feature 를 잇는 조립은 app 계층의
 * 일이고, 이 컴포넌트는 다른 라우트에서 재사용하지 않는다 (CONVENTIONS 예외 항목).
 *
 * ## 이 컴포넌트가 레이아웃에 있는 이유
 *
 * `layout.tsx` 가 렌더한다. 종목을 고르면 오른쪽(`detail`)만 바뀌고 이 컴포넌트는
 * 다시 마운트되지 않는다 — 그룹·정렬·선택, 그리고 **돌고 있는 일괄 AI 분석**이
 * 선택을 바꿔도 그대로 살아 있다.
 *
 * ## 보기가 둘인 이유
 *
 * nav 폭은 340px 다. `WatchRow` 가 한 줄에 담는 열 개(보유·평가손익·알림 조건까지)를
 * 여기 넣으면 전부 잘린다. 좁은 칸에 우겨넣어 아무것도 못 읽게 만드는 대신, **훑는
 * 보기(nav+상세)와 관리하는 보기(표)** 를 나눴다. 표 보기는 전체 폭 8열이고, 알림
 * 조건 편집·보유 확인은 거기서 한다 — 합치면서 잃은 기능이 없다.
 *
 * ## 시장 타일은 왜 오른쪽 칸이 아니라 아래인가
 *
 * `tiles` 를 상세 옆(3열)이나 상세 아래(오른쪽 칸 안)에 두는 대신 **두 열 아래
 * 전체 폭**에 깐다. 오른쪽 칸 안에 넣으면 1012px 로 좁아지는데 지수 4카드·등락 2열은
 * 넓을수록 읽기 쉽고, 무엇보다 그렇게 두면 **모바일에서 사라진다** — 분할 격자가
 * `hidden md:grid` 라서다. 아래에 두면 폭도 얻고 모든 폭에서 보인다.
 */
export function DashboardBoard({
  initial,
  detail,
  tiles,
}: {
  initial: Watchlist;
  /** 오른쪽 상세 칸 — 레이아웃이 넘겨주는 자식 라우트(서버 컴포넌트) */
  detail: React.ReactNode;
  /** 상세 아래 전체 폭에 깔리는 시장 타일 */
  tiles: React.ReactNode;
}) {
  const [group, setGroup] = useState(ALL_GROUP);
  const [sort, setSort] = useState<SortKey>("order");
  const [selected, setSelected] = useState<string[]>([]);
  const [reordering, setReordering] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [boardLayout, setBoardLayout] = useState<BoardLayout>("split");

  // 목록은 더 이상 로컬 state 가 아니다. 변경 API 가 매번 **목록 전체**를 돌려주므로
  // 서버가 확인해 준 것을 그대로 그린다 — 그룹 집계·알림 수·평가손익 같은 파생값을
  // 클라이언트가 다시 계산하지 않아 서버와 어긋날 여지가 없다.
  const store = useWatchlistMutations(initial);
  const items = store.watchlist.items;

  const bulk = useBulkAdvice();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // 필터·정렬 규칙은 도메인이 소유한다 (features/watchlist/model/sort).
  const visible = useMemo(
    () => visibleItems(items, group, sort),
    [items, group, sort],
  );

  /**
   * 지금 오른쪽에 떠 있는 종목.
   *
   * 주소에서 읽는다 — 레이아웃은 자식의 `params` 를 볼 수 없고, 부모가 자식에게서
   * 값을 받아 올 방법도 없다. `/dashboard`(코드 없음)는 페이지가 **첫 종목**을
   * 그리므로 여기서도 같은 값을 골라야 목록의 표시가 실제 화면과 맞는다.
   */
  const pathname = usePathname();
  const codeInPath = pathname.startsWith("/dashboard/")
    ? pathname.slice("/dashboard/".length)
    : null;
  const activeCode = codeInPath || visible[0]?.code || null;

  /**
   * 직접 정렬일 때만 순서를 바꾼다.
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

    const from = items.findIndex((item) => item.code === active.id);
    const to = items.findIndex((item) => item.code === over.id);
    if (from === -1 || to === -1) return;

    // 드래그만 낙관적으로 반영한다 — 손가락을 떼는 순간 결과가 보여야 한다.
    // 실패하면 훅이 서버가 확인해 준 마지막 목록으로 되돌린다.
    const next = arrayMove(items, from, to);
    store.reorder(
      next.map((item) => item.code),
      { ...store.watchlist, items: next },
    );
  }

  /** 알림 토글·조건 편집. 서버가 돌려준 목록으로 화면이 갱신된다. */
  function patchAlert(item: WatchItem, alert: AlertRule) {
    store.patch(item.code, { alert });
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
      {/* 집계는 서버가 준 최신 목록에서 읽는다. `initial` 은 첫 렌더 스냅샷이라
          종목을 담거나 뺀 뒤에는 낡은 숫자다 — 화면에 남으면 목록과 헤더가 어긋난다. */}
      <WatchlistHeader
        itemCount={store.watchlist.totalCount}
        groupCount={store.watchlist.groupCount}
        activeAlerts={store.watchlist.activeAlerts}
        reordering={reordering}
        selectedCount={selected.length}
        analyzing={bulk.remaining > 0}
        onToggleReorder={() => setReordering((v) => !v)}
        onAdd={() => setNotice("종목 추가는 ⌘K 검색에서 ⇥ 로 할 수 있습니다.")}
        onAnalyze={analyze}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <GroupTabs
          groups={store.watchlist.groups}
          active={group}
          onChange={setGroup}
        />
        <div className="flex flex-wrap items-center gap-3">
          <LayoutToggle value={boardLayout} onChange={setBoardLayout} />
          <SortControl
            value={sort}
            totalReturnPercent={store.watchlist.totalReturnPercent}
            onChange={setSort}
          />
        </div>
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

      {/* 저장 실패는 반드시 말한다. 화면만 바뀐 채 조용히 끝나면 새로고침 한 번에
          되돌아가고, 사용자는 자기가 무엇을 잃었는지도 모른다. */}
      {store.error ? (
        <p
          role="alert"
          className="border border-dashed border-up px-3 py-2 text-up"
          style={{ fontSize: 12 }}
        >
          {store.error}
        </p>
      ) : null}

      {/* 상한에 걸려 빠진 종목이 있으면 반드시 밝힌다. 20개를 골랐는데 10개만 도는
          것을 말없이 하면 사용자는 그걸 고장으로 읽는다. */}
      {bulk.skipped > 0 ? (
        <p
          role="status"
          className="border border-dashed border-line-30 px-3 py-2 text-muted-70"
          style={{ fontSize: 12 }}
        >
          한 번에 {MAX_BULK_SYMBOLS}종목까지 분석합니다 — {bulk.skipped}종목은 이번에
          제외했습니다. 종목당 AI 호출이 4회라 둔 상한입니다. 남은 종목은 분석이 끝난
          뒤 다시 눌러 주세요.
        </p>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={codes} strategy={verticalListSortingStrategy}>
          {boardLayout === "split" ? (
            /* 좌측 nav + 상세.
               `hidden md:grid` 라 모바일에서는 상세가 화면에 없다. 다만 HTML 은
               내려간다 — 서버는 뷰포트를 모르므로 CSS 로만 가릴 수 있다. 대신
               상세 조회는 대부분 Next 데이터 캐시 HIT 이라(장중 60초/장외 900초)
               비용이 상류로 나가지는 않는다. */
            <div className="hidden gap-6 md:grid md:grid-cols-[340px_1fr] md:items-start">
              {/* `nav` 다 — 이 목록의 일은 "어느 종목을 볼지 고르는 것" 이고, 행
                  전체가 링크다. 표가 아니므로 `role="table"` 을 씌우지 않는다:
                  스크린리더에 "표 6행 7열" 이라고 알려 봐야 셀이 없다. */}
              <nav aria-label="담아 둔 종목" className="flex flex-col">
                {visible.length === 0 ? (
                  <EmptyState group={group} />
                ) : (
                  visible.map((item) => (
                    <WatchRowCompact
                      key={item.code}
                      item={item}
                      href={`/dashboard/${item.code}`}
                      active={item.code === activeCode}
                      reordering={reorderable}
                      selected={selected.includes(item.code)}
                      aiStatus={aiStatus(item.code)}
                      onSelect={(next) => toggleSelect(item.code, next)}
                    />
                  ))
                )}
              </nav>

              <div className="min-w-0">{detail}</div>
            </div>
          ) : (
            /* 표 보기 — 예전 화면 그대로. CSS 그리드라 표 구조가 없어 ARIA 로 알려준다 */
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
                      patchAlert(item, { ...item.alert, enabled: !item.alert.enabled })
                    }
                    onChangeCondition={(condition) =>
                      patchAlert(item, { ...item.alert, condition })
                    }
                  />
                ))
              )}
            </div>
          )}

          {/* 모바일 2단 카드 — 분할이 성립하지 않는 폭이라 목록만 둔다.
              행을 누르면 `/stocks/[code]` 전체 화면으로 간다 (WatchCard). */}
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
                    patchAlert(item, { ...item.alert, enabled: !item.alert.enabled })
                  }
                />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>

      {/* 시장 타일 — 두 열 **아래**, 전체 폭. 오른쪽 칸 안에 넣으면 1012px 로 좁아지고
          `hidden md:grid` 안이라 모바일에서 통째로 사라진다 (컴포넌트 주석). */}
      {tiles}

      {selected.length > 0 ? (
        <BulkActionBar
          count={selected.length}
          analyzing={bulk.remaining > 0}
          remaining={bulk.remaining}
          // 그룹 이동·알림 일괄 설정은 저장소는 생겼지만 **어느 그룹으로 옮길지
          // 고르는 UI** 가 아직 없다. 값을 물어보지 않고 임의로 정하느니 남겨 둔다.
          onMoveGroup={() => setNotice("옮길 그룹을 고르는 화면이 아직 없습니다.")}
          onBulkAlert={() =>
            setNotice("알림 조건을 한 번에 입력하는 화면이 아직 없습니다.")
          }
          onDelete={() => {
            for (const code of selected) store.remove(code);
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

/**
 * 데스크탑 보기 전환. 모바일에는 분할이 없으므로 이 컨트롤도 없다.
 *
 * URL 이 아니라 클라이언트 상태다 — 정렬·그룹과 달리 **공유할 가치가 없는**
 * 개인 취향이고, URL 에 실으면 상세 라우트마다 물고 다녀야 한다.
 */
function LayoutToggle({
  value,
  onChange,
}: {
  value: BoardLayout;
  onChange: (next: BoardLayout) => void;
}) {
  const options: { key: BoardLayout; label: string }[] = [
    { key: "split", label: "분할" },
    { key: "table", label: "표" },
  ];

  return (
    <div className="hidden border border-line-25 md:flex" role="group" aria-label="보기">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          aria-pressed={value === option.key}
          onClick={() => onChange(option.key)}
          className={`px-2.5 py-1 font-medium ${
            value === option.key
              ? "bg-ink text-on-ink"
              : "text-muted-60 hover:bg-surface-hover"
          }`}
          style={{ fontSize: 11.5 }}
        >
          {option.label}
        </button>
      ))}
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
        {group === ALL_GROUP
          ? "관심 종목이 없습니다. ⌘K 검색에서 ⇥ 로 추가하세요."
          : `${group} 그룹에 종목이 없습니다.`}
      </p>
    </div>
  );
}
