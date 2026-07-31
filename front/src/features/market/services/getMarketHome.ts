import { USE_MOCK } from "@/lib/config/env";
import { MOCK_MARKET_HOME } from "../model/mock";
import type { MarketHome, SampleSection } from "../model/types";
import { getMarketOverview } from "./getMarketOverview";
import { getMovers } from "./getMovers";

/**
 * 홈(3b) 한 화면 분량.
 *
 * 지수 4카드와 등락 상위가 실데이터다. 남은 두 블록은 대응 엔드포인트가 없다:
 *   - 업종 등락  : 업종 분류·집계가 없음
 *   - 오늘의 뉴스 : 뉴스는 종목 단위(/stocks/content)만 있고 시장 전체가 없음
 *
 * 이 둘은 예시 데이터를 그대로 쓰되 화면에 '예시' 뱃지를 붙이고, 하단 API 메모에
 * 그 사실을 적어 실데이터인 척하지 않는다.
 *
 * 두 조회는 서로를 기다릴 이유가 없어 병렬로 던진다. 둘 다 실패를 예외로 올리지
 * 않으므로(각자 빈 지수·null 로 degrade) Promise.all 이 통째로 깨지지 않는다.
 */
export async function getMarketHome(): Promise<MarketHome> {
  if (USE_MOCK) return MOCK_MARKET_HOME;

  const [overview, movers] = await Promise.all([
    getMarketOverview("home"),
    getMovers(),
  ]);

  // 실데이터로 채운 블록은 목록에서 뺀다 — 이 배열이 '예시' 뱃지의 근거다.
  const sampleSections: SampleSection[] = movers
    ? ["sectors", "news"]
    : ["movers", "sectors", "news"];

  return {
    ...MOCK_MARKET_HOME,
    sampleSections,
    indices: overview.indices,
    gainers: movers?.gainers ?? MOCK_MARKET_HOME.gainers,
    losers: movers?.losers ?? MOCK_MARKET_HOME.losers,
    moversScope: movers?.scope ?? MOCK_MARKET_HOME.moversScope,
    asOf: overview.asOf,
    apiNotes: [
      "fetch_market_overview_from_yfinance (지수 4종 · 실데이터)",
      movers
        ? `scan_movers · ${movers.scope}${movers.asOf ? ` · ${movers.asOf}` : ""} (실데이터)`
        : "등락 상위는 예시 데이터 (랭킹 스냅샷 준비 중)",
      "업종 등락 · 오늘의 뉴스는 예시 데이터 (대응 API 없음)",
    ],
  };
}
