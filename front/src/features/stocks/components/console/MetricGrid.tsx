import type { Metric } from "../../model/types";
import { CONSOLE_LABEL } from "./tokens";

/** 3열 × 2행 지표 그리드 — 2a 우측 레일(MetricsRail) 6행과 같은 데이터다 */
export function MetricGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <section className="grid grid-cols-2 border-t border-line-14 md:grid-cols-3">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="flex flex-col gap-1.5 border-b border-r border-line-14 px-4 py-3.5"
        >
          <span
            className={CONSOLE_LABEL}
            style={{ fontSize: 9.5, letterSpacing: "0.14em" }}
          >
            {metric.label}
          </span>
          <span
            className={`num font-medium ${
              metric.accent === "up"
                ? "text-up"
                : metric.accent === "down"
                  ? "text-down"
                  : "text-ink"
            }`}
            style={{ fontSize: 15 }}
          >
            {metric.value}
          </span>
        </div>
      ))}
    </section>
  );
}
