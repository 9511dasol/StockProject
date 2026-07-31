"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { SearchPalette } from "./SearchPalette";

/**
 * 전역 ⌘K / Ctrl+K 진입점. 루트 레이아웃에 한 번만 놓는다.
 *
 * 팔레트는 열렸을 때만 마운트되므로, 닫혀 있는 동안 폴링·검색 요청이 전혀 없다.
 */

interface SearchContextValue {
  open: () => void;
  close: () => void;
  isOpen: boolean;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const open = useCallback(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    // 닫을 때 포커스를 열었던 자리로 되돌린다.
    restoreFocusRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k") return;
      if (!event.metaKey && !event.ctrlKey) return;
      event.preventDefault();
      setIsOpen((prev) => {
        if (!prev) restoreFocusRef.current = document.activeElement as HTMLElement;
        return !prev;
      });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <SearchContext.Provider value={{ open, close, isOpen }}>
      {children}
      {isOpen ? <SearchPalette onClose={close} /> : null}
    </SearchContext.Provider>
  );
}

export function useSearch(): SearchContextValue {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error("useSearch must be used inside <SearchProvider>");
  }
  return context;
}
