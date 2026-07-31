import { price as fmtPrice } from "@/lib/format";
import { Chip, Delta } from "@/shared/ui";
import type { Quote, StockRef } from "../model/types";

const CURRENCY_UNIT: Record<Quote["currency"], string> = {
  KRW: "원",
  USD: "USD",
};

export function StockHeadline({
  stock,
  quote,
}: {
  stock: StockRef;
  quote: Quote;
}) {
  return (
    // 모바일은 세로 스택 — 46px 종목명과 44px 가격을 375px 안에 나란히 두면
    // 둘 다 잘린다. 데스크탑(≥768)은 기존 좌우 배치 그대로다.
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6">
      <div className="flex min-w-0 flex-col gap-2">
        <h1 className="font-serif-kr font-bold leading-none tracking-[-0.02em] text-[32px] md:text-[46px]">
          {stock.name}
        </h1>
        {stock.nameEn ? (
          <p className="font-serif-en leading-none tracking-[0.03em] text-muted-55 text-[13px] md:text-[15px]">
            {stock.nameEn}
          </p>
        ) : null}
        <div className="mt-0.5 flex flex-wrap gap-1.5">
          <Chip>{stock.symbol}</Chip>
          <Chip>{stock.market}</Chip>
          {stock.sector ? <Chip variant="solid">{stock.sector}</Chip> : null}
        </div>
      </div>

      {/* 모바일에서는 가격을 왼쪽 정렬해 종목명과 축을 맞춘다 */}
      <div className="flex flex-col items-start gap-1 md:items-end">
        <p className="num font-medium leading-none tracking-[-0.02em] text-[34px] md:text-[44px]">
          {fmtPrice(quote.price, quote.currency)}
          <span className="ml-1 text-muted-50" style={{ fontSize: 17 }}>
            {CURRENCY_UNIT[quote.currency]}
          </span>
        </p>
        <Delta change={quote.change} changePercent={quote.changePercent} size={15} />
        <p
          className="font-mono uppercase tracking-[0.1em] text-muted-45"
          style={{ fontSize: 10.5 }}
        >
          상승 빨강 / 하락 파랑 · 국내 관례
        </p>
      </div>
    </div>
  );
}
