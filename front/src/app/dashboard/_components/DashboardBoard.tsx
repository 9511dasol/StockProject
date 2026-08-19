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
 * ## 왼쪽은 뷰포트에 붙은 전체 높이 사이드바다 — 앱 셸
 *
 * `fixed inset-y-0 left-0 w-[320px]`. **중앙 정렬 컨테이너 밖**이라 화면 왼쪽 끝과
 * 사이드바 사이에 여백이 없다. 앞서 두 번은 `max-w-shell` 안쪽의 2열 격자였고, 그래서
 * 넓은 화면에서 사이드바 왼쪽이 비어 있었다 — "아예 왼쪽으로" 가 아니었던 이유다.
 *
 * **제호는 여기 없다.** 상단 바의 기준 시각 **위**에 있다(`Masthead`) — 나머지 화면과
 * 같은 자리다. 한때 사이드바 머리에 뒀는데 320px 에 24px 제호가 안 들어가 오른쪽 본문
 * 위로 삐져나갔고, 무엇보다 서비스명이 화면마다 다른 자리에 있으면 안 된다.
 *
 * 머리(제목·버튼·필터)는 붙박이고 **목록만 스크롤한다** — 통째로 스크롤시키면
 * 종목을 고르러 내려간 사이 그룹 탭과 정렬이 화면 밖으로 나간다.
 *
 * 본문은 `md:pl-[320px]` 로 밀어 준다. 사이드바가 `fixed` 라 문서 흐름에서 자리를
 * 차지하지 않으므로, 밀지 않으면 본문 왼쪽이 그 아래로 들어간다. **표 보기는
 * 사이드바를 접으므로 밀지 않는다.**
 */
export function DashboardBoard({
  initial,
  detail,
  tiles,
  topBar,
}: {
  initial: Watchlist;
  /** 오른쪽 상세 칸 — 레이아웃이 넘겨주는 자식 라우트(서버 컴포넌트) */
  detail: React.ReactNode;
  /** 본문 맨 아래에 깔리는 시장 타일 */
  tiles: React.ReactNode;
  /** 상단 바 — 제호 + 기준 시각 + 검색·테마·계정 (`Masthead`) */
  topBar: React.ReactNode;
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

  /**
   * 제목 줄과 필터 — **사이드바가 없는 배치**(모바일 · 표 보기)에서만 이 형태로 쓴다.
   * 분할 보기에서는 같은 내용이 `variant="rail"` 로 사이드바 안에 들어간다.
   */
  const pageHead = (
    <>
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
    </>
  );

  /**
   * 모바일 묶음 — 제목 줄 + 2단 카드.
   *
   * 분할이 성립하지 않는 폭이라 사이드바가 없고, 카드를 누르면 `/stocks/[code]`
   * 전체 화면으로 간다 (`WatchCard`). 두 보기 어느 쪽이든 모바일은 이것 하나다.
   */
  const mobileStack = (
    <div className="flex flex-col gap-4 md:hidden">
      {pageHead}
      <div className="flex flex-col">
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
    </div>
  );

  return (
    <>
      {/**
       * 왼쪽 사이드바 — **뷰포트 왼쪽 끝에 붙고 전체 높이를 쓴다.**
       *
       * `fixed inset-y-0 left-0` 이라 중앙 정렬 컨테이너 밖이다. 그래서 넓은 화면에서
       * 사이드바 왼쪽에 여백이 생기지 않는다 — 앞선 두 번의 시도가 `max-w-shell`
       * 안쪽 격자였던 탓에 화면 왼쪽 끝과 사이드바 사이가 비어 있었고, 그게 "아예
       * 왼쪽으로" 가 아니었던 이유다.
       *
       * 제호가 이 안 맨 위에 있다. 앱 셸에서 서비스명은 사이드바 머리에 놓이고,
       * 오른쪽 상단 바는 지금 화면의 상태(기준 시각)와 전역 컨트롤만 든다.
       *
       * 머리(제호·제목·버튼·필터)는 붙박이고 **목록만 스크롤한다.** 통째로 스크롤하면
       * 종목을 고르러 내려간 사이 그룹 탭과 정렬이 화면 밖으로 나간다.
       */}
      {boardLayout === "split" ? (
        <aside
          aria-label="관심 종목"
          className="hidden md:fixed md:inset-y-0 md:left-0 md:z-20 md:flex md:w-[320px] md:flex-col md:border-r-2 md:border-ink md:bg-surface"
        >
          <div className="flex flex-none flex-col gap-3 border-b border-line-25 px-4 pb-3 pt-5">
            {/* **제호는 여기 없다.** 상단 바의 기준 시각 위에 있다 (`layout.tsx` 의
                `Masthead`). 한때 이 자리에 뒀는데, 320px 에 24px 제호가 안 들어가
                오른쪽 본문 위로 삐져나갔고(2026-08-18) 무엇보다 서비스명이 화면마다
                다른 자리에 있으면 안 된다 — 나머지 화면은 전부 상단 왼쪽이다. */}
            <WatchlistHeader
              variant="rail"
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

            {/* 320px 이라 정렬 줄과 보기 토글이 한 줄에 겨우 든다. 넘치면 접힌다. */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <LayoutToggle value={boardLayout} onChange={setBoardLayout} />
              <SortControl
                value={sort}
                totalReturnPercent={store.watchlist.totalReturnPercent}
                onChange={setSort}
              />
            </div>

            <GroupTabs
              groups={store.watchlist.groups}
              active={group}
              onChange={setGroup}
            />
          </div>

          {/* `min-h-0` 이 없으면 flex 아이템의 기본 최소 높이 때문에 목록이 사이드바를
              밀어내고, 스크롤이 여기가 아니라 페이지에 생긴다. `overscroll-contain` 은
              목록 끝에서 페이지로 스크롤이 넘어가는 것을 막는다. */}
          <nav
            aria-label="담아 둔 종목"
            className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-2 pb-5"
          >
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
        </aside>
      ) : null}

      {/* 본문 — 사이드바가 fixed 라 그만큼 밀어 줘야 겹치지 않는다.
          표 보기는 사이드바를 접으므로 밀지 않는다. */}
      <div className={boardLayout === "split" ? "md:pl-[320px]" : undefined}>
        <main className="mx-auto flex w-full max-w-shell flex-col gap-5 px-4 pb-40 pt-[26px] md:px-8 md:pb-[30px]">
          {topBar}

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
              한 번에 {MAX_BULK_SYMBOLS}종목까지 분석합니다 — {bulk.skipped}종목은
              이번에 제외했습니다. 종목당 AI 호출이 4회라 둔 상한입니다. 남은 종목은
              분석이 끝난 뒤 다시 눌러 주세요.
            </p>
          ) : null}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext items={codes} strategy={verticalListSortingStrategy}>
              {mobileStack}

              {boardLayout === "split" ? (
                /* 상세는 모바일에 없다. HTML 은 내려가지만 — 서버는 뷰포트를 모른다 —
                   조회는 대부분 Next 데이터 캐시 HIT 이라 상류로 나가지 않는다. */
                <div className="hidden md:block">{detail}</div>
              ) : (
                /* 표 보기 — 사이드바를 접고 전체 폭 8열. CSS 그리드라 표 구조가 없어
                   ARIA 로 알려준다. 제목 줄도 이때는 본문 위로 돌아온다. */
                <div className="hidden flex-col gap-5 md:flex">
                  {pageHead}
                  <div
                    role="table"
                    aria-label="관심 종목"
                    aria-rowcount={visible.length + 1}
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
                            patchAlert(item, {
                              ...item.alert,
                              enabled: !item.alert.enabled,
                            })
                          }
                          onChangeCondition={(condition) =>
                            patchAlert(item, { ...item.alert, condition })
                          }
                        />
                      ))
                    )}
                  </div>
                </div>
              )}
            </SortableContext>
          </DndContext>

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

          {tiles}
        </main>
      </div>

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
    </>
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
