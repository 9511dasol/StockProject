import { apiGetCached, ApiError } from "@/lib/api";
import { marketRevalidate, REVALIDATE_STATIC } from "@/lib/config/marketHours";
import { USE_MOCK } from "@/lib/config/env";
import { MOCK_STOCK_DETAIL } from "../model/mock";
import type { StockDetail } from "../model/types";
import {
  toCandles,
  toMetrics,
  toNews,
  toQuote,
  toReports,
  toStockRef,
  type WireStockContent,
  type WireStockHistory,
} from "./wire";

/** 지표 계산에 필요한 최소 봉 수 (60일선 + 52주 위치) */
const HISTORY_LIMIT = 504;

/**
 * 조회 결과. 호출부(page.tsx)가 세 갈래를 구분해야 한다:
 *   ok        정상
 *   not-found 정규화 실패 → 후보 선택 화면
 *   timeout   상류 지연 → 에러 화면 (예외를 던지지 않으므로 렌더는 살아 있다)
 */
export type StockDetailResult =
  | { status: "ok"; detail: StockDetail }
  | { status: "not-found" }
  | { status: "timeout" };

/**
 * 종목 상세 한 벌. 서버에서만 실행된다.
 *
 * 주가와 뉴스·리포트를 나눠 부른다: 백엔드 주석대로 content 가 응답 시간의
 * 약 95%를 차지해, 함께 받으면 차트가 뉴스를 기다리게 된다.
 *
 * 재검증 주기는 장중 60초 / 장외 900초로 갈린다 (lib/config/marketHours).
 */
export async function getStockDetail(
  code: string,
): Promise<StockDetailResult> {
  if (USE_MOCK) {
    return code === MOCK_STOCK_DETAIL.ref.code
      ? { status: "ok", detail: MOCK_STOCK_DETAIL }
      : { status: "not-found" };
  }

  const revalidate = marketRevalidate();

  try {
    const history = await apiGetCached<WireStockHistory>("/stocks/history", {
      query: { symbol: code, limit: HISTORY_LIMIT, include_content: false },
      revalidate,
    });
    if (!history.ok) return { status: "timeout" };

    // 뉴스·리포트는 없어도 화면이 성립한다 — 실패든 지연이든 빈 목록으로 내려간다.
    // 시세가 아니라 콘텐츠라 장중/장외 분기를 적용하지 않는다.
    const content = await apiGetCached<WireStockContent>("/stocks/content", {
      query: { symbol: history.data.symbol },
      revalidate: REVALIDATE_STATIC,
    }).catch(() => ({ ok: false as const, reason: "timeout" as const }));

    const articles = content.ok
      ? content.data
      : { symbol: history.data.symbol, news: [], reports: [] };

    return {
      status: "ok",
      detail: {
        ref: toStockRef(history.data),
        quote: toQuote(history.data.metrics, history.data.symbol),
        candles: toCandles(history.data.rows),
        metrics: toMetrics(history.data.metrics),
        news: toNews(articles.news),
        reports: toReports(articles.reports),
        now: new Date().toISOString(),
        apiNotes: [
          "fetch_stock_history_from_yfinance",
          "build_stock_metrics",
          "fetch_stock_news · fetch_analyst_reports",
        ],
      },
    };
  } catch (error) {
    // 정규화 실패(404)만 '후보 선택' 경로로 보낸다. 공급자 장애(503)는 그대로
    // 던져 error.tsx 가 받게 한다 — 타임아웃과 달리 재시도가 의미 있다.
    if (error instanceof ApiError && error.isNotFound) return { status: "not-found" };
    throw error;
  }
}
