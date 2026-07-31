"use client";

import { useRecentSearchStore } from "@/store/recentSearches";

/** 최근 검색 종목 코드. 저장은 store/recentSearches (zustand persist) 가 맡는다. */
export function useRecentSearches() {
  const codes = useRecentSearchStore((s) => s.codes);
  const push = useRecentSearchStore((s) => s.push);
  return { codes, push };
}
