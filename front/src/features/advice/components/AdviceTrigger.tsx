"use client";

import { useAdvice } from "./AdviceProvider";

/**
 * 마스트헤드 우측 버튼. 드로어와는 AdviceProvider 를 통해서만 연결된다.
 *
 * variant
 *  - "editorial" 2a 마스트헤드 (데스크탑)
 *  - "console"   2b 상단 바 — 앰버 RUN AI 버튼 (데스크탑)
 *  - "bar"       모바일 하단 고정 버튼. 2a·2b 의 상단 버튼이 좁은 폭에서 숨으므로
 *                모바일에서는 이것이 유일한 AI 진입점이다.
 */
export function AdviceTrigger({
  variant = "editorial",
  tone = "ink",
}: {
  variant?: "editorial" | "console" | "bar";
  /**
   * bar 전용. 2b(터미널)에서는 `bg-ink` 가 크림색이라 액션으로 안 읽힌다 —
   * 그 화면의 액션 색인 앰버를 쓴다.
   */
  tone?: "ink" | "accent";
}) {
  const { open, setOpen } = useAdvice();

  if (variant === "bar") {
    // 시트가 열리면 그 아래에 깔린 채 포커스만 남는다 — 아예 내린다.
    if (open) return null;
    return (
      <div
        className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-ink bg-paper px-4 pt-3 md:hidden"
        style={{ paddingBottom: "calc(0.75rem + var(--safe-b))" }}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          className={`flex min-h-[var(--tap)] w-full items-center justify-center gap-[7px] font-medium ${
            tone === "accent" ? "bg-accent text-paper" : "bg-ink text-on-ink"
          }`}
          style={{ fontSize: 14 }}
        >
          <span
            aria-hidden
            className={`dot block h-[5px] w-[5px] ${tone === "accent" ? "bg-paper" : "bg-up"}`}
          />
          AI 판단 열기
        </button>
      </div>
    );
  }

  if (variant === "console") {
    return (
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex items-center gap-2 bg-accent px-4 py-2 font-mono font-medium uppercase text-paper"
        style={{ fontSize: 10.5, letterSpacing: "0.14em" }}
      >
        {open ? "close ai" : "run ai"}
        <span aria-hidden>⏎</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      aria-expanded={open}
      className="flex items-center gap-[7px] bg-ink px-[18px] py-[9px] font-medium text-on-ink transition-transform duration-150 hover:-translate-y-px"
      style={{ fontSize: 13 }}
    >
      <span aria-hidden className="dot block h-[5px] w-[5px] bg-up" />
      AI 판단 {open ? "닫기" : "열기"}
    </button>
  );
}
