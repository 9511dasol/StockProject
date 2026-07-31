"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type DetailView = "editorial" | "console";

interface ViewContextValue {
  view: DetailView;
  setView: (next: DetailView) => void;
}

const ViewContext = createContext<ViewContextValue | null>(null);

/**
 * 2a(에디토리얼) ↔ 2b(터미널 콘솔) 전환. **A안 — 같은 라우트 + `?view=console`.**
 *
 * 다만 쿼리를 서버 `searchParams` 로 읽어 분기하면 전환할 때마다 RSC 요청이
 * 다시 나가 데이터를 또 가져온다. 그래서 두 레이아웃을 서버에서 한 번씩 렌더해
 * 받아두고 여기서는 표시만 바꾼다 — 뷰 전환에 네트워크 왕복이 전혀 없고,
 * AI 드로어 상태(진행 중인 SSE 포함)도 그대로 유지된다.
 * URL 은 history.pushState 로만 갱신하므로 공유·뒤로가기가 모두 동작한다.
 *
 * 테마는 여기서 건드리지 않는다 — 콘솔 뷰가 자기 서브트리에
 * `data-theme="terminal"` 을 직접 들고 있다 (ConsoleView). 그래야 `?view=console`
 * 딥링크도 서버 첫 HTML 부터 다크로 나오고, 콘솔을 들렀다는 이유로 사용자의
 * 전역 테마가 바뀌지도 않는다.
 */
export function ViewSwitch({
  initialView,
  editorial,
  console: consoleView,
}: {
  initialView: DetailView;
  editorial: React.ReactNode;
  console: React.ReactNode;
}) {
  const [view, setViewState] = useState<DetailView>(initialView);

  const setView = useCallback(
    (next: DetailView) => {
      setViewState(next);
      // 전역 테마는 건드리지 않는다.
      //
      // 전에는 콘솔로 들어갈 때 setTheme("terminal") 을 불렀다. 그러면 (a) 첫
      // 페인트에는 이미 늦어 라이트로 한 프레임 깜빡이고, (b) 콘솔을 한 번
      // 들렀다는 이유로 사용자의 전역 테마 선택이 영구히 다크로 바뀌었다.
      // 지금은 ConsoleView 서브트리가 data-theme="terminal" 을 직접 들고 있어
      // 서버 첫 HTML 부터 올바른 색이고, 나오면 원래 테마가 그대로 남는다.

      const search = new URLSearchParams(window.location.search);
      if (next === "console") search.set("view", "console");
      else search.delete("view");
      const query = search.toString();
      window.history.pushState(
        null,
        "",
        query ? `${window.location.pathname}?${query}` : window.location.pathname,
      );
    },
    [],
  );

  // 뒤로가기/앞으로가기로 ?view 가 바뀌면 화면도 따라간다.
  useEffect(() => {
    const sync = () => {
      const search = new URLSearchParams(window.location.search);
      setViewState(search.get("view") === "console" ? "console" : "editorial");
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  return (
    <ViewContext.Provider value={{ view, setView }}>
      <div hidden={view !== "editorial"}>{editorial}</div>
      <div hidden={view !== "console"}>{consoleView}</div>
    </ViewContext.Provider>
  );
}

export function useDetailView(): ViewContextValue {
  const context = useContext(ViewContext);
  if (!context) {
    throw new Error("useDetailView must be used inside <ViewSwitch>");
  }
  return context;
}

/** 우상단 뷰 토글. 두 뷰의 헤더가 각각 렌더한다. */
export function ViewToggle() {
  const { view, setView } = useDetailView();
  const next: DetailView = view === "console" ? "editorial" : "console";

  return (
    <button
      type="button"
      onClick={() => setView(next)}
      aria-pressed={view === "console"}
      title={next === "console" ? "터미널 콘솔로 전환" : "에디토리얼로 전환"}
      className="hidden border border-line-control px-2.5 py-2 font-mono uppercase tracking-label-tight text-muted-60 hover:border-ink hover:text-ink md:block"
      style={{ fontSize: 9.5 }}
    >
      {next}
    </button>
  );
}
