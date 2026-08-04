import { USE_MOCK } from "@/lib/config/env";
import { MOCK_MARKET_HOME } from "../model/mock";
import type { MarketHome } from "../model/types";
import { getMarketOverview } from "./getMarketOverview";
import { getMovers } from "./getMovers";

/**
 * 홈 한 화면 분량.
 *
 * 이제 **두 블록 모두 실데이터**다 — 지수 4카드와 등락 상위. 예전에는 업종 등락·오늘의
 * 뉴스가 함께 있었지만 둘 다 대응 API 가 없어 예시 값으로 채워 두고 있었다. 첫 화면의
 * 절반이 가짜인 편보다, 진짜인 것만 보여주는 편이 낫다고 판단해 걷어냈다.
 * (업종 집계와 시장 단위 뉴스는 백엔드가 생기면 그때 다시 넣는다.)
 *
 * 남은 예시 가능성은 등락 상위 하나뿐이다. 랭킹 스냅샷은 배경 스캔이라 기동 직후
 * 잠깐 비는데, 그때만 목 데이터로 내려가고 `moversAreSample` 로 그 사실을 알린다.
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

  return {
    ...MOCK_MARKET_HOME,
    moversAreSample: movers === null,
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
    ],
  };
}
