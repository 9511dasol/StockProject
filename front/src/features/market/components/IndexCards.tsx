import {
  decimal,
  deltaColorClass,
  percent as fmtPercent,
  signedDecimal,
} from "@/lib/format";
import { Sparkline } from "@/shared/ui";
import type { MarketIndex } from "../model/types";

/**
 * 지수 4카드. gap 1px + 그리드 배경으로 1px 헤어라인 구분선을 만든다
 * (보더를 각 카드에 주면 인접 변이 2px로 겹친다).
 */
export function IndexCards({ indices }: { indices: MarketIndex[] }) {
  return (
    <section
      aria-label="지수 스냅샷"
      className="grid grid-cols-2 gap-px bg-line-16 md:grid-cols-4"
    >
      {indices.map((index) => (
        // 모바일은 2열 그리드라 카드 폭이 절반이다 — 패딩·숫자 크기를 줄인다.
        <article
          key={index.name}
          className="flex min-w-0 flex-col gap-2 bg-paper px-3 pb-2.5 pt-3 md:gap-2.5 md:px-[18px] md:pb-3 md:pt-4"
        >
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-mono font-medium tracking-[0.12em] text-[11px] md:text-[12px]">
              {index.name}
            </h2>
            <span className="flex-none text-muted-50 text-[10px] md:text-[11px]">
              {index.label}
            </span>
          </div>

          <div className="flex flex-col gap-[3px]">
            <span className="num font-medium leading-none text-[20px] md:text-[26px]">
              {decimal(index.value, index.digits)}
            </span>
            <span
              className={`num font-medium text-[11px] md:text-[12px] ${deltaColorClass(index.changePercent)}`}
            >
              {signedDecimal(index.change, index.digits)} (
              {fmtPercent(index.changePercent)})
            </span>
          </div>

          {/* Sparkline 은 max-w-full 이라 카드 폭을 넘지 않는다 */}
          <Sparkline
            points={index.spark}
            changePercent={index.changePercent}
            w={232}
            h={58}
            area
          />
        </article>
      ))}
    </section>
  );
}
