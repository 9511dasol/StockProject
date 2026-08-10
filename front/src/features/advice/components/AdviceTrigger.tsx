"use client";

import { useAdvice } from "./AdviceProvider";

/**
 * 마스트헤드 우측 버튼. 드로어와는 AdviceProvider 를 통해서만 연결된다.
 *
 * variant
 *  - "editorial" 2a 헤드라인 아래 **액션 줄** (데스크탑)
 *  - "console"   2b 상단 바 — 앰버 RUN AI 버튼 (데스크탑)
 *  - "bar"       모바일 하단 고정 버튼. 2a·2b 의 상단 버튼이 좁은 폭에서 숨으므로
 *                모바일에서는 이것이 유일한 AI 진입점이다.
 *
 * "editorial" 은 한때 마스트헤드에 있었는데, 그 줄에 담기·계정까지 서면서 좁은 폭에서
 * 무너졌다. 제호에는 전역 컨트롤(검색·테마·계정)만 남기고 종목 액션은 헤드라인 아래로
 * 내렸다 — 대상 옆에 있는 편이 원래 맞기도 하다 (`EditorialView` 주석).
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
      // 이웃과 **같은 기하**를 쓴다: px-3 py-2 · 13px (담기·로그인과 동일).
      //
      // 예전에는 px-[18px] py-[9px] 이었다. 이 자리에 다른 컨트롤이 거의 없던
      // 시절에는 그 여유가 "주 액션" 으로 읽혔는데, 담기·뷰 토글·테마 토글·로그인이
      // 같은 줄에 서면서 혼자 1.5배 큰 버튼이 되어 정렬이 무너져 보였다.
      //
      // 강조는 **크기가 아니라 채움**이 한다. 주변이 전부 테두리 버튼이므로 솔리드
      // 하나만으로 위계가 충분히 서고, 그러면 크기는 줄에 맞추는 편이 낫다.
      //
      // `flex-none whitespace-nowrap` 이 이 버튼이 눌려 글자가 세로로 접히는 것을
      // 막는다 — 실제로 768px 부근에서 "AI 판 단 열 기" 가 됐다 (Masthead 주석).
      className="flex flex-none items-center gap-[7px] whitespace-nowrap bg-ink px-3 py-2 font-medium text-on-ink transition-transform duration-150 hover:-translate-y-px"
      style={{ fontSize: 13 }}
    >
      <span aria-hidden className="dot block h-[5px] w-[5px] bg-up" />
      AI 판단 {open ? "닫기" : "열기"}
    </button>
  );
}
