"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * 최근 검색 종목 코드. localStorage 에만 있고 서버로 가지 않는다.
 *
 * features/search 안이 아니라 store/ 에 둔 이유: 관심종목처럼 여러 화면이 참조할
 * 여지가 있고, 무엇보다 zustand persist 를 쓰는 저장소를 한 곳에 모아 두면
 * 저장 키와 마이그레이션을 한눈에 볼 수 있다.
 */

const STORAGE_KEY = "ledger.recentSearches";
const MAX = 5;

interface RecentSearchState {
  codes: string[];
  /** 맨 앞으로 올리고 중복은 제거한다. 최대 MAX 개. */
  push: (code: string) => void;
  clear: () => void;
}

export const useRecentSearchStore = create<RecentSearchState>()(
  persist(
    (set, get) => ({
      codes: [],
      push: (code) =>
        set({
          codes: [code, ...get().codes.filter((c) => c !== code)].slice(0, MAX),
        }),
      clear: () => set({ codes: [] }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ codes: state.codes }),
    },
  ),
);
