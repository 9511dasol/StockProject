import { USE_MOCK } from "@/lib/config/env";
import { MOCK_MARKET_HOME } from "../model/mock";
import type { MarketHome } from "../model/types";
import { getMarketOverview } from "./getMarketOverview";

/**
 * 홈(3b) 한 화면 분량.
 *
 * 지수 4카드만 실데이터다. 나머지 세 블록은 백엔드에 대응 엔드포인트가 없다:
 *   - 상승률·하락률 상위 : KOSPI+KOSDAQ 전 종목 스캔이 필요 (랭킹 API 없음)
 *   - 업종 등락        : 업종 분류·집계가 없음
 *   - 오늘의 뉴스       : 뉴스는 종목 단위(/stocks/content)만 있고 시장 전체가 없음
 *
 * 이 셋은 예시 데이터를 그대로 쓰되, 화면 하단 API 메모에 그 사실을 적어
 * 실데이터인 척하지 않는다.
 */
export async function getMarketHome(): Promise<MarketHome> {
  if (USE_MOCK) return MOCK_MARKET_HOME;

  const overview = await getMarketOverview("home");

  return {
    ...MOCK_MARKET_HOME,
    // 지수만 실데이터다. 나머지 세 블록은 화면에서 '예시' 뱃지가 붙는다.
    sampleSections: ["movers", "sectors", "news"],
    indices: overview.indices,
    asOf: overview.asOf,
    apiNotes: [
      "fetch_market_overview_from_yfinance (지수 4종 · 실데이터)",
      "등락 상위 · 업종 등락 · 오늘의 뉴스는 예시 데이터 (대응 API 없음)",
    ],
  };
}
