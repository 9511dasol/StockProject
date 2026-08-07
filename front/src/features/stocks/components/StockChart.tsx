"use client";

import {
  AreaSeries,
  CandlestickSeries,
  createChart,
  createSeriesMarkers,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
} from "lightweight-charts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { compact } from "@/lib/format";
import { useTheme } from "@/shared/theme";
import {
  MAX_BARS,
  MIN_BARS,
  normalize,
  RANGE_PRESETS,
  toBandPoints,
  toCandlePoints,
  toCrossPoints,
  toLinePoints,
  toVolumePoints,
  type RangePresetKey,
} from "../model/chartData";
import type { Candle } from "../model/types";

/**
 * 캔들 + 거래량 + MA20/MA60 + 볼린저밴드 + 골든/데드크로스.
 *
 * 색은 전부 CSS 변수에서 읽는다 — 라이트/터미널 테마가 같은 컴포넌트를 쓰고,
 * 테마가 바뀌면 다시 읽어 시리즈 옵션을 갱신한다. 하드코딩하면 다크에서
 * 캔들이 배경과 같은 색이 되어 "안 그려진 것처럼" 보인다.
 */

const VOLUME_PANE = 1;
/** README: 거래량 서브차트는 차트 높이의 19% */
const VOLUME_PANE_RATIO = 0.19;
/** 숨겨진 상태(clientWidth=0)로 마운트될 때 쓰는 초기 폭. README 의 2a 차트 폭. */
const DEFAULT_WIDTH = 748;
/** 크로스헤어 툴팁의 대략적인 폭 — 컨테이너 오른쪽 끝에서 되미는 데만 쓴다. */
const TOOLTIP_W = 170;

function readTokens(host: HTMLElement) {
  const style = getComputedStyle(host);
  const token = (name: string) => style.getPropertyValue(name).trim();
  return {
    ink: token("--ink"),
    paper: token("--paper"),
    up: token("--up"),
    down: token("--down"),
    ma20: token("--ma20"),
    ma60: token("--ma60"),
    line: token("--line-14"),
    lineStrong: token("--line-20"),
    muted: token("--muted-60"),
    band: token("--bb-band"),
  };
}

interface Tooltip {
  visible: boolean;
  x: number;
  y: number;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const EMPTY_TOOLTIP: Tooltip = {
  visible: false,
  x: 0,
  y: 0,
  date: "",
  open: 0,
  high: 0,
  low: 0,
  close: 0,
  volume: 0,
};

export function StockChart({
  candles,
  height = 344,
  heightClassName,
  initialPreset = "3M",
}: {
  candles: Candle[];
  height?: number;
  /**
   * 반응형 높이를 Tailwind 로 줄 때 쓴다 (예: `"h-[220px] md:h-[344px]"`).
   * 주면 `height` 대신 이 클래스가 실제 높이를 정하고, 캔버스는 아래
   * ResizeObserver 가 읽은 실측값을 따라간다 — 뷰포트가 바뀌면 같이 바뀐다.
   * `height` 는 그때 서버 첫 렌더의 폴백 값으로만 남는다.
   */
  heightClassName?: string;
  initialPreset?: RangePresetKey;
}) {
  // 색을 CSS 변수에서 읽으므로 테마가 바뀌면 차트를 다시 만들어야 한다.
  // 그러지 않으면 다크로 전환했을 때 캔들이 라이트 색 그대로 남아 배경과 뭉개진다.
  const { theme } = useTheme();
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [preset, setPreset] = useState<RangePresetKey>(initialPreset);
  const [tooltip, setTooltip] = useState<Tooltip>(EMPTY_TOOLTIP);
  // 툴팁을 컨테이너 안에 가두기 위한 실측 폭. 상수로 두면 좁은 폭에서 잘린다.
  const [hostWidth, setHostWidth] = useState(DEFAULT_WIDTH);
  // ResizeObserver 콜백이 최신 표시 봉 수를 봐야 하는데, effect 의존성에 preset 을
  // 넣으면 차트를 통째로 다시 만든다. 아래 preset effect 가 이 ref 를 갱신한다.
  const barsRef = useRef<number>(
    RANGE_PRESETS.find((p) => p.key === initialPreset)?.bars ?? 66,
  );

  const rows = useMemo(() => normalize(candles), [candles]);
  const byDate = useMemo(
    () => new Map(rows.map((row) => [row.date, row])),
    [rows],
  );

  /** 마지막 N봉만 보이도록 시야를 맞춘다 */
  const applyRange = useCallback(
    (bars: number) => {
      const chart = chartRef.current;
      if (!chart || rows.length === 0) return;
      const span = Math.min(Math.max(bars, MIN_BARS), MAX_BARS);
      const from = Math.max(0, rows.length - span);
      chart.timeScale().setVisibleLogicalRange({
        from: from - 0.5,
        to: rows.length - 0.5,
      });
    },
    [rows.length],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host || rows.length === 0) return;

    const t = readTokens(host);
    // 이 컴포넌트는 숨겨진 채로도 마운트된다 (2a/2b 뷰 전환이 display:none 방식).
    // display:none 이면 clientWidth 가 0 이고, 0 으로 만든 차트는 아무것도 그리지
    // 않는다. 기본 폭으로 시작하고 실제 크기는 아래 ResizeObserver 가 잡는다.
    const chart = createChart(host, {
      width: host.clientWidth || DEFAULT_WIDTH,
      height,
      layout: {
        background: { color: "transparent" },
        textColor: t.muted,
        fontFamily: "var(--font-plex-mono), ui-monospace, monospace",
        fontSize: 10,
        attributionLogo: false,
        panes: { separatorColor: t.line, separatorHoverColor: t.line },
      },
      grid: {
        vertLines: { color: t.line, style: 2 },
        horzLines: { color: t.line, style: 2 },
      },
      rightPriceScale: { borderColor: t.lineStrong, entireTextOnly: true },
      timeScale: { borderColor: t.lineStrong, rightOffset: 2 },
      crosshair: {
        mode: 1,
        vertLine: { color: t.muted, width: 1, style: 2, labelBackgroundColor: t.ink },
        horzLine: { color: t.muted, width: 1, style: 2, labelBackgroundColor: t.ink },
      },
      handleScroll: true,
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
      localization: {
        priceFormatter: (value: number) =>
          new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(value),
      },
    });
    chartRef.current = chart;

    // 볼린저밴드 — 상단 Area 를 밴드색으로 칠하고 하단 Area 를 배경색으로 덮는다.
    // 캔들보다 먼저 추가해야 캔들이 밴드 위에 그려진다.
    const band = toBandPoints(rows);
    const bandUpper = chart.addSeries(AreaSeries, {
      lineColor: "transparent",
      topColor: t.band,
      bottomColor: t.band,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    bandUpper.setData(band.upper);
    const bandLower = chart.addSeries(AreaSeries, {
      lineColor: "transparent",
      topColor: t.paper,
      bottomColor: t.paper,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    bandLower.setData(band.lower);

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: t.up,
      downColor: t.down,
      borderUpColor: t.up,
      borderDownColor: t.down,
      wickUpColor: t.up,
      wickDownColor: t.down,
      borderVisible: true,
      priceLineVisible: false,
      lastValueVisible: true,
    });
    candleSeries.setData(toCandlePoints(rows));
    candleSeriesRef.current = candleSeries;

    // MA20 은 --ink(본문 글자색)를 쓰지 않는다. 계열 색과 글자 색이 같은 토큰을
    // 공유하면 테마를 손볼 때 한쪽 의도만 반영돼 다른 쪽이 조용히 끌려간다.
    const ma20 = chart.addSeries(LineSeries, {
      color: t.ma20,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    ma20.setData(toLinePoints(rows, (c) => c.ma20));

    const ma60 = chart.addSeries(LineSeries, {
      color: t.ma60,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    ma60.setData(toLinePoints(rows, (c) => c.ma60));

    // 골든/데드크로스 — 상승 교차 빨강 / 하락 교차 파랑 (README).
    createSeriesMarkers(
      candleSeries,
      toCrossPoints(rows).map((cross) => ({
        time: cross.time as Time,
        position: cross.type === "golden" ? ("belowBar" as const) : ("aboveBar" as const),
        shape: "circle" as const,
        color: cross.type === "golden" ? t.up : t.down,
        text: cross.type === "golden" ? "GC" : "DC",
        size: 1,
      })),
    );

    // 거래량 — 별도 pane. opacity .3 은 색상 알파로 준다.
    const volume = chart.addSeries(
      HistogramSeries,
      {
        priceFormat: { type: "volume" },
        priceLineVisible: false,
        lastValueVisible: false,
      },
      VOLUME_PANE,
    );
    volume.setData(toVolumePoints(rows, `${t.up}4d`, `${t.down}4d`));
    chart.panes()[VOLUME_PANE]?.setHeight(Math.round(height * VOLUME_PANE_RATIO));

    // 크로스헤어 툴팁 — 라이브러리 기본 툴팁이 없어 직접 그린다.
    const onCrosshair = (param: MouseEventParams) => {
      if (!param.point || !param.time || param.point.x < 0 || param.point.y < 0) {
        setTooltip((prev) => (prev.visible ? EMPTY_TOOLTIP : prev));
        return;
      }
      const row = byDate.get(String(param.time));
      if (!row) return;
      setTooltip({
        visible: true,
        x: param.point.x,
        y: param.point.y,
        date: row.date,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        volume: row.volume,
      });
    };
    chart.subscribeCrosshairMove(onCrosshair);

    // 휠 줌 범위를 18~240봉으로 가둔다. 라이브러리 자체에는 상·하한이 없다.
    const clampRange = () => {
      const range = chart.timeScale().getVisibleLogicalRange();
      if (!range) return;
      const span = range.to - range.from;
      if (span >= MIN_BARS && span <= MAX_BARS) return;
      const clamped = Math.min(Math.max(span, MIN_BARS), MAX_BARS);
      const center = (range.from + range.to) / 2;
      chart.timeScale().setVisibleLogicalRange({
        from: center - clamped / 2,
        to: center + clamped / 2,
      });
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(clampRange);

    // 숨겨져 있다 보이게 되는 순간에도 발화하므로, 뷰 전환 후 폭이 정확해진다.
    // 높이도 같이 읽는다 — heightClassName 으로 브레이크포인트별 높이를 주면
    // 뷰포트를 넘나들 때 캔버스가 CSS 를 따라와야 한다.
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect?.width) return;
      const nextHeight = Math.floor(rect.height) || height;
      chart.applyOptions({ width: Math.floor(rect.width), height: nextHeight });
      chart
        .panes()
        [VOLUME_PANE]?.setHeight(Math.round(nextHeight * VOLUME_PANE_RATIO));
      setHostWidth(Math.floor(rect.width));
      // 폭이 0→N 으로 바뀌면 시야도 다시 맞춘다 (0 폭에서는 setVisibleLogicalRange 가 무시된다).
      applyRange(barsRef.current);
    });
    observer.observe(host);

    applyRange(barsRef.current);

    return () => {
      observer.disconnect();
      chart.unsubscribeCrosshairMove(onCrosshair);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(clampRange);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
    };
    // preset 은 아래 별도 effect 가 처리한다 — 여기 넣으면 차트를 통째로 재생성한다.
    // theme 은 반대로 재생성이 맞다: 모든 시리즈 색이 CSS 변수에서 온다.
  }, [rows, byDate, height, applyRange, theme]);

  useEffect(() => {
    barsRef.current = RANGE_PRESETS.find((p) => p.key === preset)?.bars ?? 66;
    applyRange(barsRef.current);
  }, [preset, applyRange]);

  if (rows.length === 0) {
    return (
      <div
        className={`flex items-center justify-center border border-line-14 ${heightClassName ?? ""}`}
        style={heightClassName ? undefined : { height }}
      >
        <p className="text-muted-60" style={{ fontSize: 12.5 }}>
          차트로 그릴 시세가 없습니다.
        </p>
      </div>
    );
  }

  return (
    // 모바일: 프리셋을 차트 위 흐름에 둔다 (겹치면 44px 버튼이 캔들을 덮는다).
    // 데스크탑: 스펙대로 차트 우상단에 겹쳐 얹는다.
    <div className="relative flex flex-col gap-2 md:block">
      <div className="flex justify-end px-4 md:absolute md:right-0 md:top-0 md:z-10 md:px-0">
        {RANGE_PRESETS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setPreset(item.key)}
            aria-pressed={preset === item.key}
            // 모바일 히트 영역 44×44. 데스크탑은 차트 위에 얹히는 작은 칩이라
            // 원래 크기(30×25)를 지킨다.
            className={`flex min-h-[var(--tap)] min-w-[var(--tap)] items-center justify-center px-2 py-1 font-mono font-medium md:min-h-0 md:min-w-0 ${
              preset === item.key
                ? "bg-ink text-on-ink"
                : "border border-line-14 bg-paper text-muted-60 hover:text-ink"
            }`}
            style={{ fontSize: 10 }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        className={`relative w-full ${heightClassName ?? ""}`}
        style={heightClassName ? undefined : { height }}
      >
        <div ref={hostRef} className="h-full w-full" data-testid="stock-chart" />

      {tooltip.visible ? (
        <div
          role="status"
          aria-live="off"
          className="pointer-events-none absolute z-20 flex flex-col gap-0.5 bg-ink px-2 py-1.5 text-on-ink shadow-tooltip"
          style={{
            fontSize: 10.5,
            // 커서 오른쪽에 두되 컨테이너를 넘지 않게 민다. 상수 560 은 748px
            // 차트에만 맞아서 모바일에서는 툴팁이 화면 밖으로 나갔다.
            left: Math.max(4, Math.min(tooltip.x + 12, hostWidth - TOOLTIP_W - 4)),
            top: Math.max(tooltip.y - 64, 4),
          }}
        >
          <span className="num">{tooltip.date}</span>
          <span className="num">
            시 {tooltip.open.toLocaleString("ko-KR")} · 고{" "}
            {tooltip.high.toLocaleString("ko-KR")}
          </span>
          <span className="num">
            저 {tooltip.low.toLocaleString("ko-KR")} · 종{" "}
            {tooltip.close.toLocaleString("ko-KR")}
          </span>
          <span className="num text-on-ink-75">거래량 {compact(tooltip.volume)}</span>
        </div>
        ) : null}
      </div>
    </div>
  );
}
