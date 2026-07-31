// 백엔드 응답(snake_case) 타입과 도메인 타입 변환.
// 화면은 이 파일을 보지 않는다 — services 안에서만 쓴다.

import type { Currency, Market } from "@/shared/types";
import type {
  AnalystReport,
  Candle,
  CrossSignal,
  Metric,
  NewsItem,
  Quote,
  StockRef,
} from "../model/types";

/** back/app/schemas/stock.py : StockRow */
export interface WireStockRow {
  name: string;
  symbol: string;
  date: string;
  open: number | null;
  close: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  sma5: number | null;
  sma20: number | null;
  sma60: number | null;
  bb_upper: number | null;
  bb_lower: number | null;
  cross_signal: CrossSignal | null;
}

/** back/app/schemas/stock.py : StockMetrics */
export interface WireStockMetrics {
  latest_date: string | null;
  latest_close: number | null;
  day_change: number | null;
  day_change_pct: number | null;
  return_20d_pct: number | null;
  return_60d_pct: number | null;
  sma5: number | null;
  sma20: number | null;
  sma60: number | null;
  trend: string;
  bollinger_position: string;
  volume_ratio_20d: number | null;
  recent_cross_signal: CrossSignal | null;
  recent_cross_date: string | null;
  week52_position_pct: number | null;
  week52_high: number | null;
  week52_low: number | null;
  volatility_20d_pct: number | null;
}

export interface WireNewsItem {
  title: string;
  publisher: string;
  published_at: string;
  summary: string;
  url: string;
  thumbnail: string;
}

export interface WireAnalystReport {
  title: string;
  publisher: string;
  published_at: string;
  summary: string;
  url: string;
}

/** back : StockHistory */
export interface WireStockHistory {
  name: string;
  symbol: string;
  query: string;
  timeframe: string;
  period: string;
  interval: string;
  start_date: string | null;
  end_date: string | null;
  rows: WireStockRow[];
  news: WireNewsItem[];
  reports: WireAnalystReport[];
  metrics: WireStockMetrics | null;
}

export interface WireStockContent {
  symbol: string;
  news: WireNewsItem[];
  reports: WireAnalystReport[];
}

/**
 * 심볼 접미사로 시장·통화를 유도한다.
 * 백엔드 StockHistory 에는 market 필드가 없다 (StockSuggestion 에만 있다).
 */
export function marketOf(symbol: string): Market {
  if (symbol.endsWith(".KS")) return "KOSPI";
  if (symbol.endsWith(".KQ")) return "KOSDAQ";
  return "NASDAQ";
}

export function currencyOf(symbol: string): Currency {
  return symbol.endsWith(".KS") || symbol.endsWith(".KQ") ? "KRW" : "USD";
}

/** 005930.KS → 005930 · AAPL → AAPL */
export function codeOf(symbol: string): string {
  return symbol.replace(/\.(KS|KQ)$/, "");
}

export function toStockRef(history: WireStockHistory): StockRef {
  return {
    name: history.name,
    // nameEn·sector 는 백엔드에 소스가 없다 — 헤드라인에서 해당 요소가 빠진다.
    code: codeOf(history.symbol),
    symbol: history.symbol,
    market: marketOf(history.symbol),
  };
}

export function toCandles(rows: WireStockRow[]): Candle[] {
  return rows
    .filter((row) => row.close !== null && row.open !== null)
    .map((row) => ({
      date: row.date,
      open: row.open ?? 0,
      high: row.high ?? row.open ?? 0,
      low: row.low ?? row.open ?? 0,
      close: row.close ?? 0,
      volume: row.volume ?? 0,
      ma20: row.sma20,
      ma60: row.sma60,
      bbUpper: row.bb_upper,
      bbLower: row.bb_lower,
      cross: row.cross_signal,
    }));
}

export function toQuote(
  metrics: WireStockMetrics | null,
  symbol: string,
): Quote {
  return {
    price: metrics?.latest_close ?? 0,
    change: metrics?.day_change ?? 0,
    changePercent: metrics?.day_change_pct ?? 0,
    currency: currencyOf(symbol),
    // 백엔드는 최신 봉의 날짜만 준다. 장중/장마감 구분(session)은 소스가 없다.
    asOf: metrics?.latest_date ?? "",
    session: "closed",
  };
}

const PERCENT = (value: number | null): string | null =>
  value === null ? null : `${value > 0 ? "+" : value < 0 ? "-" : ""}${Math.abs(value).toFixed(2)}%`;

/**
 * 투자 지표 6행. 값의 타입이 제각각(퍼센트·배율·문자열)이라 표시 문자열로 만든다.
 * 순서는 디자인(2a 우측 레일)과 같다.
 */
export function toMetrics(metrics: WireStockMetrics | null): Metric[] {
  if (!metrics) return [];
  const rows: Metric[] = [];
  const push = (label: string, value: string | null, source: number | null) => {
    if (value === null) return;
    rows.push({
      label,
      value,
      accent: source === null || source === 0 ? undefined : source > 0 ? "up" : "down",
    });
  };

  push("20일 수익률", PERCENT(metrics.return_20d_pct), metrics.return_20d_pct);
  push("60일 수익률", PERCENT(metrics.return_60d_pct), metrics.return_60d_pct);
  rows.push({
    label: "추세",
    value: metrics.trend,
    accent: metrics.trend.startsWith("상승") ? "up" : undefined,
  });
  if (metrics.volume_ratio_20d !== null) {
    rows.push({
      label: "거래량 배율",
      value: `${metrics.volume_ratio_20d.toFixed(2)}x`,
      accent: metrics.volume_ratio_20d > 1 ? "up" : undefined,
    });
  }
  if (metrics.week52_position_pct !== null) {
    rows.push({
      label: "52주 위치",
      value: `${Math.round(metrics.week52_position_pct)}%`,
    });
  }
  if (metrics.volatility_20d_pct !== null) {
    rows.push({
      label: "변동성 20D",
      value: `${metrics.volatility_20d_pct.toFixed(1)}%`,
    });
  }
  return rows;
}

export function toNews(items: WireNewsItem[]): NewsItem[] {
  return items.map((item) => ({
    title: item.title,
    publisher: item.publisher,
    publishedAt: item.published_at,
    // 바로 아래 toReports 와 같은 규칙 — 빈 문자열은 '없음'이다
    url: item.url || undefined,
    thumbnail: item.thumbnail || undefined,
  }));
}

/**
 * 백엔드 AnalystReport 에는 투자의견·목표가가 없다.
 * 우측 레일 '리포트 요약'의 [매수] [목표가 상향 82,000 → 95,000] 표기는
 * 실데이터로 채울 수 없어 비어 있는 채로 내려간다.
 */
export function toReports(items: WireAnalystReport[]): AnalystReport[] {
  return items.map((item) => ({
    title: item.title,
    publisher: item.publisher,
    publishedAt: item.published_at,
    summary: item.summary,
    url: item.url || undefined,
  }));
}
