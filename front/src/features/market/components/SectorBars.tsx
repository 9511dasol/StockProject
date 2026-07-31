import { deltaBgClass, deltaColorClass, percent as fmtPercent } from "@/lib/format";
import type { Sector } from "../model/types";

export function SectorBars({ sectors }: { sectors: Sector[] }) {
  // 가장 큰 절대 등락폭을 100%로 두고 나머지를 비례 배분한다.
  const peak = Math.max(...sectors.map((s) => Math.abs(s.changePercent)), 0.01);

  return (
    <section className="flex flex-col gap-[11px]">
      <h2
        className="border-b border-line-20 pb-2 font-mono font-medium uppercase tracking-label"
        style={{ fontSize: 11 }}
      >
        업종 등락
      </h2>
      {sectors.map((sector) => {
        return (
          <div key={sector.name} className="flex items-center gap-2.5">
            <span className="w-16 flex-none" style={{ fontSize: 12.5 }}>
              {sector.name}
            </span>
            <span className="block h-2 flex-1 bg-track">
              {/* 막대 색도 방향 판정을 direction.ts 에 맡긴다 — 직접 분기하면
                  보합(0)이 하락색이 되어 우측 숫자와 어긋난다 */}
              <span
                className={`block h-2 ${deltaBgClass(sector.changePercent)}`}
                style={{
                  width: `${(Math.abs(sector.changePercent) / peak) * 100}%`,
                }}
              />
            </span>
            <span
              className={`num w-14 flex-none text-right font-medium ${deltaColorClass(sector.changePercent)}`}
              style={{ fontSize: 12 }}
            >
              {fmtPercent(sector.changePercent)}
            </span>
          </div>
        );
      })}
    </section>
  );
}
