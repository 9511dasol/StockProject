"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

/**
 * 드로어 열림 상태를 URL(?ai=1)과 동기화한다.
 *
 * useSearchParams 를 쓰지 않는 이유: 그러면 트리거·드로어가 클라이언트 전용으로
 * 떨어져 나가 SSR HTML 에서 AI 버튼이 사라졌다가 하이드레이션 후 나타난다.
 * 대신 서버가 초기값을 내려주고, 이후 변경은 history API 로 처리한다.
 * Next 는 pushState 를 라우터와 연결하므로 뒤로가기도 그대로 동작한다.
 */

interface AdviceContextValue {
  open: boolean;
  setOpen: (next: boolean) => void;
  /** ?fallback=1 — LLM 실패 경로 확인용 개발 스위치 */
  fallback: boolean;
}

const AdviceContext = createContext<AdviceContextValue | null>(null);

export function AdviceProvider({
  initialOpen,
  fallback,
  children,
}: {
  initialOpen: boolean;
  fallback: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpenState] = useState(initialOpen);

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    const search = new URLSearchParams(window.location.search);
    if (next) search.set("ai", "1");
    else search.delete("ai");
    const query = search.toString();
    window.history.pushState(
      null,
      "",
      query ? `${window.location.pathname}?${query}` : window.location.pathname,
    );
  }, []);

  // 뒤로가기/앞으로가기로 ?ai=1 이 바뀌면 드로어도 따라간다.
  useEffect(() => {
    const sync = () => {
      const search = new URLSearchParams(window.location.search);
      setOpenState(search.get("ai") === "1");
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  return (
    <AdviceContext.Provider value={{ open, setOpen, fallback }}>
      {children}
    </AdviceContext.Provider>
  );
}

export function useAdvice(): AdviceContextValue {
  const context = useContext(AdviceContext);
  if (!context) {
    throw new Error("useAdvice must be used inside <AdviceProvider>");
  }
  return context;
}
