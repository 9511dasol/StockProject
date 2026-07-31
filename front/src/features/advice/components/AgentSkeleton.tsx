const LINES = [
  { width: "70%", tone: "bg-skeleton-1", delay: "0ms" },
  { width: "92%", tone: "bg-skeleton-2", delay: "200ms" },
  { width: "54%", tone: "bg-skeleton-3", delay: "400ms" },
];

/** 아직 도착하지 않은 에이전트 자리. 3줄이 0 / .2 / .4s 시차로 깜빡인다. */
export function AgentSkeleton() {
  return (
    <div
      aria-hidden
      className="flex flex-col gap-2 border border-dashed border-line-30 bg-paper/60 p-3.5"
    >
      {LINES.map((line) => (
        <span
          key={line.width}
          className={`block h-[9px] animate-pulse-wf ${line.tone}`}
          style={{ width: line.width, animationDelay: line.delay }}
        />
      ))}
    </div>
  );
}
