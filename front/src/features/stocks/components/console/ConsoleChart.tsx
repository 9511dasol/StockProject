import type { StockDetail } from "../../model/types";
import { StockChart } from "../StockChart";
import { CONSOLE_LABEL, CONSOLE_LABEL_STYLE } from "./tokens";

/** 2b 콘솔 차트 블록 — 레전드는 텍스트 라벨만, 그리기는 StockChart 가 한다. */
export function ConsoleChart({ candles }: { candles: StockDetail["candles"] }) {
  return (
    <section className="flex flex-col gap-2.5 border-t border-line-14 px-5 py-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <span className="flex gap-3.5">
          {["MA20", "MA60", "BB(20,2)", "VOL"].map((item) => (
            <span key={item} className={CONSOLE_LABEL} style={CONSOLE_LABEL_STYLE}>
              {item}
            </span>
          ))}
        </span>
        <span className="flex gap-3.5">
          <span className={CONSOLE_LABEL} style={CONSOLE_LABEL_STYLE}>
            scroll=zoom
          </span>
          <span className={CONSOLE_LABEL} style={CONSOLE_LABEL_STYLE}>
            hover=ohlcv
          </span>
        </span>
      </div>
      <StockChart
        candles={candles}
        height={320}
        heightClassName="h-[220px] md:h-[320px]"
      />
    </section>
  );
}
