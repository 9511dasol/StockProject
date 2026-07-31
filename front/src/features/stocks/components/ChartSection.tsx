import { SectionLabel } from "@/shared/ui";
import type { Candle } from "../model/types";
import { ChartLegend } from "./ChartLegend";
import { StockChart } from "./StockChart";

/**
 * 2a 차트 블록. 748×344 는 README 가 지정한 데스크탑 치수다.
 *
 * 모바일에서는 좌우 컨테이너 패딩(px-4)을 음수 마진으로 상쇄해 풀블리드로 빼고
 * 높이를 220px 로 줄인다 — 세로로 이어붙인 화면에서 344px 차트는 첫 화면을
 * 통째로 먹는다. 라벨·레전드는 패딩 안에 그대로 둔다.
 */
export function ChartSection({ candles }: { candles: Candle[] }) {
  return (
    <section className="flex flex-col gap-3.5">
      {/* 휠·커서 안내는 마우스가 있을 때만 참이다. 터치에서는 설명이 틀린 데다
          390px 에서 라벨을 두 줄로 밀어낸다 — 데스크탑에서만 노출한다. */}
      <SectionLabel
        right={
          <span className="hidden md:inline">
            휠 = 기간 확대/축소 · 커서 = 시세 확인
          </span>
        }
      >
        가격 · 이동평균 · 볼린저밴드
      </SectionLabel>
      <ChartLegend />
      {/* 음수 마진만으로 풀블리드. 100vw 를 쓰면 세로 스크롤바 폭까지 더해져
          데스크탑에서 가로 스크롤이 생긴다. */}
      <div className="-mx-4 md:mx-0 md:max-w-[748px]">
        <StockChart
          candles={candles}
          height={344}
          heightClassName="h-[220px] md:h-[344px]"
        />
      </div>
    </section>
  );
}
