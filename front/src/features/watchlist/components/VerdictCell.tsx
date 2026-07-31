import { deltaColorClass } from "@/lib/format";
import type { RowAiStatus, WatchItem } from "../model/types";

/**
 * AI 판단 칸.
 *
 * 색은 판단 용어가 아니라 그 행의 등락 색을 따른다 — 시안이 등락률 칸과 같은
 * 색 변수를 재사용한다 (Apple 은 -0.32% 라 '유지'가 파랑으로 나온다).
 * 그래서 changePercent 를 받아 deltaColorClass 에 위임한다.
 *
 * 일괄 분석이 도는 동안에는 그 종목의 진행 단계를 이 자리에 보여준다 —
 * 전체 진행률 하나로는 어느 종목이 끝났는지 알 수 없기 때문이다.
 */
export function VerdictCell({
  verdict,
  changePercent,
  status,
  align = "right",
}: {
  verdict?: WatchItem["verdict"];
  changePercent: number;
  status?: RowAiStatus;
  align?: "right" | "left";
}) {
  const alignment = align === "right" ? "text-right" : "text-left";

  if (status?.error) {
    return (
      <span
        className={`num ${alignment} text-muted-55`}
        style={{ fontSize: 11.5 }}
      >
        분석 실패
      </span>
    );
  }

  if (status?.running) {
    return (
      <span
        className={`num flex items-center gap-1.5 ${
          align === "right" ? "justify-end" : ""
        } text-muted-55`}
        style={{ fontSize: 11.5 }}
        aria-live="polite"
      >
        <span
          aria-hidden
          className="dot block h-[9px] w-[9px] flex-none animate-dot-spin border-[1.4px] border-line-25 border-t-up"
        />
        {status.stage}/4
      </span>
    );
  }

  const label = status?.verdict ?? verdict;
  // 아직 분석 전이면 자리표시('－')를 남기지 않는다 — 빈 칸이 더 정직하다.
  if (!label) return null;

  return (
    <span
      className={`num ${alignment} font-medium ${deltaColorClass(changePercent)}`}
      style={{ fontSize: 11.5 }}
    >
      {label}
    </span>
  );
}
