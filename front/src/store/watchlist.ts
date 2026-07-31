"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * 관심 종목 코드. 검색 팔레트의 ⇥(관심 추가)와 관심종목 화면(4b)이 함께 쓰는
 * 전역 상태라 store/ 에 둔다.
 *
 * 직접 만든 useSyncExternalStore + localStorage 구현을 zustand persist 로 바꿨다.
 * 직렬화·이벤트 브로드캐스트·스냅샷 캐싱을 미들웨어가 대신하고, 같은 탭의 여러
 * 컴포넌트가 자동으로 같은 상태를 본다.
 *
 * 서버 동기화는 아직 없다 — 백엔드에 관심종목 저장소가 생기면 여기서만 바꾼다.
 */

const STORAGE_KEY = "ledger.watchlist";

interface WatchlistState {
  codes: string[];
  /** 없으면 추가, 있으면 제거. 추가됐는지 여부를 돌려준다. */
  toggle: (code: string) => boolean;
  has: (code: string) => boolean;
}

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      codes: [],
      toggle: (code) => {
        const current = get().codes;
        const next = current.includes(code)
          ? current.filter((c) => c !== code)
          : [...current, code];
        set({ codes: next });
        return next.includes(code);
      },
      has: (code) => get().codes.includes(code),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // codes 만 저장한다 — 액션까지 직렬화하면 복원 시 함수가 사라진다.
      partialize: (state) => ({ codes: state.codes }),
      // 서버 렌더에는 localStorage 가 없다. 하이드레이션 이후 복원되도록 두면
      // 첫 페인트는 빈 배열이고 곧 실제 값으로 채워진다 (불일치 없음).
      skipHydration: false,
    },
  ),
);

/** 기존 호출부 시그니처 유지 — 컴포넌트를 건드리지 않기 위한 얇은 래퍼 */
export function useWatchlist() {
  const codes = useWatchlistStore((s) => s.codes);
  const toggle = useWatchlistStore((s) => s.toggle);
  return { codes, toggle };
}
