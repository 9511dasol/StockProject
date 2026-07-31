import { AGENT_META, type AgentOpinion } from "../model/types";

export function AgentCard({
  opinion,
  index,
}: {
  opinion: AgentOpinion;
  index: number;
}) {
  const meta = AGENT_META[opinion.agent];
  const failed = opinion.status === "fallback";

  return (
    <article className="flex animate-fade-up flex-col gap-2 border border-line-18 bg-paper p-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-baseline gap-2">
          <span
            className="num font-medium text-muted-40"
            style={{ fontSize: 11 }}
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="font-serif-kr font-bold" style={{ fontSize: 16 }}>
            {opinion.agent}
          </span>
          {meta ? (
            <span
              className="font-serif-en text-muted-45"
              style={{ fontSize: 11 }}
            >
              {meta.nameEn}
            </span>
          ) : null}
        </span>
        {opinion.stance || failed ? (
          <span
            className="whitespace-nowrap border border-line-25 px-1.5 py-0.5 font-mono font-medium tracking-label-tight"
            style={{ fontSize: 9.5 }}
          >
            {failed ? "실패" : opinion.stance}
          </span>
        ) : null}
      </div>

      <p
        className="font-serif-kr text-pretty text-ink-2"
        style={{ fontSize: 13.5, lineHeight: 1.7 }}
      >
        {opinion.summary}
      </p>

      {opinion.source ? (
        <span className="font-mono text-muted-45" style={{ fontSize: 10 }}>
          근거: {opinion.source}
        </span>
      ) : null}
    </article>
  );
}
