"use client";

import { useTheme } from "./ThemeProvider";

/** 마스트헤드에 놓는 테마 전환. 라벨은 '지금 무엇인지'가 아니라 '무엇으로 바뀌는지'를 말한다. */
export function ThemeToggle() {
  const { isTerminal, toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isTerminal}
      title={isTerminal ? "에디토리얼 라이트로" : "다크 터미널로"}
      className="flex min-h-[var(--tap)] min-w-[var(--tap)] items-center justify-center border border-line-control px-2.5 py-2 font-mono uppercase tracking-label-tight text-muted-60 hover:border-ink hover:text-ink md:min-h-0 md:min-w-0"
      style={{ fontSize: 9.5 }}
    >
      {isTerminal ? "editorial" : "terminal"}
    </button>
  );
}
