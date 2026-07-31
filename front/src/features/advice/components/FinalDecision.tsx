import { Icon } from "@/shared/ui";
import type { Decision } from "../model/types";

const CELLS = 5;

/** 신뢰도 72% → 5칸 중 3칸. 20%p 단위로 채운다. */
function filledCells(confidence: number): number {
  return Math.min(CELLS, Math.max(0, Math.floor(confidence / 20)));
}

export function FinalDecision({
  decision,
  onRetry,
}: {
  decision: Decision;
  onRetry: () => void;
}) {
  const filled = filledCells(decision.confidence);
  const isFallback = decision.source === "fallback";

  return (
    <section
      className={`flex animate-fade-up-slow flex-col gap-3 bg-ink p-[18px] text-on-ink ${
        isFallback ? "border border-dashed border-on-ink-45" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className="font-mono uppercase tracking-label text-on-ink-55"
          style={{ fontSize: 10.5 }}
        >
          final decision
        </span>
        {isFallback ? (
          <span
            className="border border-on-ink-45 px-1.5 py-0.5 font-mono uppercase tracking-label-tight text-on-ink-75"
            style={{ fontSize: 9.5 }}
          >
            규칙 기반 판단
          </span>
        ) : null}
      </div>

      <div className="flex items-baseline gap-3">
        <span
          className="font-serif-kr font-bold leading-none"
          style={{ fontSize: 34 }}
        >
          {decision.decisionLabel}
        </span>
        <span className="num text-up-on-ink" style={{ fontSize: 12 }}>
          신뢰도 {decision.confidence}%
        </span>
      </div>

      <div
        className="flex gap-[3px]"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={decision.confidence}
        aria-label="판단 신뢰도"
      >
        {Array.from({ length: CELLS }, (_, i) => (
          <span
            key={i}
            className={`block h-1 flex-1 ${i < filled ? "bg-up" : "bg-on-ink-20"}`}
          />
        ))}
      </div>

      <p
        className="font-serif-kr text-pretty text-on-ink-90"
        style={{ fontSize: 13.5, lineHeight: 1.75 }}
      >
        {decision.answer}
      </p>

      <div className="flex flex-col gap-1.5 border-t border-on-ink-20 pt-[11px]">
        {/* ＋/－ 는 근거의 방향(매수 조건 / 리스크)을 나타내는 기호다.
            README "근거 3줄(＋/－ 기호, －는 파랑)" — 색은 토큰이 맡는다. */}
        {decision.buyConditions.map((line) => (
          <span
            key={line}
            className="flex items-start gap-1.5 font-mono text-on-ink-75"
            style={{ fontSize: 11.5 }}
          >
            <Icon name="plus" size={13} className="mt-px flex-none" />
            {line}
          </span>
        ))}
        {decision.riskNotes.map((line) => (
          <span
            key={line}
            className="flex items-start gap-1.5 font-mono text-down-on-ink"
            style={{ fontSize: 11.5 }}
          >
            <Icon name="minus" size={13} className="mt-px flex-none" />
            {line}
          </span>
        ))}
      </div>

      {isFallback ? (
        <>
          <p className="text-on-ink-78" style={{ fontSize: 12.5 }}>
            AI 의견을 받지 못해 지표 규칙으로 판단했습니다.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="border border-on-ink-45 px-4 py-2 font-medium text-on-ink hover:bg-on-ink hover:text-ink"
            style={{ fontSize: 12.5 }}
          >
            AI 분석 다시 시도
          </button>
          <p
            className="font-mono text-on-ink-45"
            style={{ fontSize: 9.5 }}
          >
            fallback_decision
          </p>
        </>
      ) : null}

      <p
        className="font-mono border-t border-on-ink-15 pt-[9px] text-on-ink-45"
        style={{ fontSize: 10, lineHeight: 1.6 }}
      >
        투자 판단의 참고 자료이며 투자 권유가 아닙니다. 예시 데이터.
      </p>
    </section>
  );
}
