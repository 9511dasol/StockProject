import { apiGetCached, ApiError } from "@/lib/api";
import { USE_MOCK } from "@/lib/config/env";
import { marketRevalidate } from "@/lib/config/marketHours";
import { MOCK_MARKET_OVERVIEW } from "../model/mock";
import type { MarketIndex, MarketOverview } from "../model/types";

/** back/app/schemas/market.py : MarketRow */
export interface WireMarketRow {
  name: string;
  symbol: string;
  value: number;
  change: number | null;
  change_percent: number | null;
  tone: "up" | "down";
  highlight: boolean;
  chart_points: number[];
  chart_labels: string[];
}

export interface WireMarketOverview {
  category: string;
  label: string;
  rows: WireMarketRow[];
  chart_points: number[];
  chart_labels: string[];
  updated_at: string;
}

/** 카드 우상단 캡션. 백엔드는 행 단위 라벨을 주지 않는다. */
const CAPTIONS: Record<string, string> = {
  KOSPI: "코스피",
  KOSDAQ: "코스닥",
  "S&P 500": "미국",
  "USD/KRW": "환율",
};

export function toMarketIndex(row: WireMarketRow): MarketIndex {
  return {
    name: row.name,
    label: CAPTIONS[row.name] ?? "",
    value: row.value,
    change: row.change ?? 0,
    changePercent: row.change_percent ?? 0,
    digits: 2,
    spark: row.chart_points,
  };
}

/**
 * 카테고리별 시장 개요. 서버에서만 실행된다.
 *
 * 홈 화면은 `home` 카테고리를 쓴다 — KOSPI/KOSDAQ/S&P500/USD-KRW 4종만 담은
 * 전용 카탈로그다. 기존 `index` 는 8종목이고 환율이 forex 에 있어, 화면 하나에
 * 두 번 호출해야 했다.
 */
export async function getMarketOverview(
  category = "home",
): Promise<MarketOverview> {
  if (USE_MOCK) return { ...MOCK_MARKET_OVERVIEW, category };

  const empty = (): MarketOverview => ({
    category,
    asOf: new Date().toISOString(),
    indices: [],
  });

  let result;
  try {
    result = await apiGetCached<WireMarketOverview>("/markets/overview", {
      query: { category },
      // 지수는 시세다 — 장중 60초 / 장외 900초.
      revalidate: marketRevalidate(),
    });
  } catch (error) {
    // apiGetCached 는 타임아웃만 값으로 돌려주고 4xx/5xx·연결 실패는 던진다.
    // 그걸 그대로 올리면 지수 한 줄 때문에 라우트 전체가 에러 화면이 된다 —
    // 이 함수는 홈뿐 아니라 종목 상세(2a·2b)에서도 불린다.
    // 지수는 보조 정보이므로 없는 채로 그린다. 진짜 못 그리는 실패
    // (getStockDetail 등)는 여전히 각자 예외를 올린다.
    if (error instanceof ApiError) return empty();
    throw error;
  }

  // 지연되면 지수 카드만 빈 채로 내려간다. 홈의 나머지 블록은 그대로 그려진다.
  if (!result.ok) return empty();

  return {
    category: result.data.category,
    asOf: result.data.updated_at,
    indices: result.data.rows.map(toMarketIndex),
  };
}
