"use client";

import {
  decimal,
  percent as fmtPercent,
  price as fmtPrice,
  deltaColorClass,
} from "@/lib/format";
import { Icon, Sparkline } from "@/shared/ui";
import type { Suggestion } from "../model/types";
import { HighlightedName } from "./HighlightedName";

/**
 * 치수·타이포는 --pal-* 테마 변수에서 읽는다. 라이트(3a)와 터미널(4a)은
 * 색뿐 아니라 패딩·글자 크기·폰트 계열까지 다르기 때문에, 컴포넌트에 테마 분기를
 * 넣는 대신 변수 한 겹으로 흡수한다.
 */
export function SuggestionRow({
  id,
  item,
  active,
  watched,
  onSelect,
  onHover,
}: {
  id: string;
  item: Suggestion;
  active: boolean;
  watched: boolean;
  onSelect: () => void;
  onHover: () => void;
}) {
  const isOverseas = item.market === "NASDAQ" || item.market === "NYSE";

  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      onClick={onSelect}
      onMouseMove={onHover}
      className="flex cursor-pointer items-center gap-3.5 transition-colors duration-150"
      style={{
        padding: "var(--pal-row-py) var(--pal-row-px)",
        borderBottom: "1px var(--pal-row-style) var(--pal-row-line)",
        background: active ? "var(--pal-row-hover)" : undefined,
      }}
    >
      <span className="flex flex-1 flex-col gap-[3px]">
        <span
          style={{
            fontSize: "var(--pal-name-size)",
            fontWeight: "var(--pal-name-weight)" as unknown as number,
            fontFamily: "var(--pal-name-font)",
          }}
        >
          <HighlightedName name={item.name} match={item.match} />
          {watched ? (
            <Icon
              name="star-filled"
              size={12}
              label="관심 종목"
              className="ml-2 inline-block align-baseline text-up"
            />
          ) : null}
        </span>
        <span
          className="font-mono"
          style={{
            fontSize: "var(--pal-en-size)",
            letterSpacing: "var(--pal-en-tracking)",
            textTransform: "var(--pal-en-transform)" as "none" | "uppercase",
            color: "var(--pal-en-color)",
          }}
        >
          {item.nameEn ?? item.symbol}
        </span>
      </span>

      <span
        className="flex-none border border-line-25 font-mono font-medium text-muted-65"
        style={{
          fontSize: "var(--pal-chip-size)",
          padding: "var(--pal-chip-py) var(--pal-chip-px)",
          letterSpacing: "var(--pal-chip-tracking)",
        }}
      >
        {item.market}
      </span>

      <span
        className="num flex-none text-right font-medium text-muted-75"
        style={{ fontSize: "var(--pal-sym-size)", width: "var(--pal-sym-w)" }}
      >
        {item.symbol}
      </span>

      {/* 시세는 백엔드 자동완성 응답에 없다 (목 데이터에서만 채워진다) */}
      {item.spark && item.changePercent !== undefined ? (
        <Sparkline
          points={item.spark}
          changePercent={item.changePercent}
          w={92}
          h={26}
        />
      ) : null}

      {item.price !== undefined && item.changePercent !== undefined ? (
        <span
          className="num flex flex-none flex-col items-end gap-0.5"
          style={{ width: "var(--pal-price-w)" }}
        >
          <span
            className="font-medium"
            style={{ fontSize: "var(--pal-price-size)" }}
          >
            {isOverseas ? decimal(item.price, 2) : fmtPrice(item.price)}
          </span>
          <span
            className={`font-medium ${deltaColorClass(item.changePercent)}`}
            style={{ fontSize: "var(--pal-delta-size)" }}
          >
            {fmtPercent(item.changePercent)}
          </span>
        </span>
      ) : null}
    </div>
  );
}
