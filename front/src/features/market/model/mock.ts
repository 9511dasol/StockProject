// 시장 현황 목 데이터. 백엔드 /markets/overview 가 붙으면 삭제된다.

import type {
  MarketHome,
  MarketIndex,
  MarketOverview,
  Mover,
  Sector,
} from "./types";

/** 시드 고정 — 스파크라인이 매 렌더 흔들리지 않게 한다 */
function spark(seed: number, changePercent: number, length = 40): number[] {
  let state = seed;
  const next = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  const drift = changePercent / length;
  const points: number[] = [];
  let level = 100;
  for (let i = 0; i < length; i += 1) {
    level += drift + (next() - 0.5) * 1.1;
    points.push(level);
  }
  return points;
}

const ASOF = "2026-07-30T06:30:00Z";

const INDICES: MarketIndex[] = [
  { name: "KOSPI", label: "코스피", value: 2_842.19, change: 23.71, changePercent: 0.84, digits: 2, spark: spark(2842, 0.84) },
  { name: "KOSDAQ", label: "코스닥", value: 861.44, change: 9.53, changePercent: 1.12, digits: 2, spark: spark(861, 1.12) },
  { name: "S&P 500", label: "미국", value: 5_738.02, change: -12.06, changePercent: -0.21, digits: 2, spark: spark(5738, -0.21) },
  { name: "USD/KRW", label: "환율", value: 1_381.5, change: 4.9, changePercent: 0.36, digits: 2, spark: spark(1381, 0.36) },
];

const GAINERS: Mover[] = [
  { name: "한미반도체", nameEn: "Hanmi Semi", code: "042700", price: 112_700, changePercent: 8.42, spark: spark(42700, 8.42, 24) },
  { name: "SK하이닉스", nameEn: "SK hynix", code: "000660", price: 198_300, changePercent: 2.86, spark: spark(660, 2.86, 24) },
  { name: "두산에너빌리티", nameEn: "Doosan Enerbility", code: "034020", price: 24_150, changePercent: 2.31, spark: spark(34020, 2.31, 24) },
  { name: "삼성전자", nameEn: "Samsung Elec", code: "005930", price: 71_400, changePercent: 1.42, spark: spark(5930, 1.42, 24) },
  { name: "현대차", nameEn: "Hyundai Motor", code: "005380", price: 243_500, changePercent: 0.41, spark: spark(5380, 0.41, 24) },
];

const LOSERS: Mover[] = [
  { name: "에코프로비엠", nameEn: "Ecopro BM", code: "247540", price: 158_400, changePercent: -3.94, spark: spark(247540, -3.94, 24) },
  { name: "삼성SDI", nameEn: "Samsung SDI", code: "006400", price: 318_000, changePercent: -2.14, spark: spark(6400, -2.14, 24) },
  { name: "LG화학", nameEn: "LG Chem", code: "051910", price: 332_500, changePercent: -1.68, spark: spark(51910, -1.68, 24) },
  { name: "에코프로", nameEn: "Ecopro", code: "086520", price: 104_200, changePercent: -1.05, spark: spark(86520, -1.05, 24) },
  { name: "네이버", nameEn: "NAVER", code: "035420", price: 171_900, changePercent: -0.52, spark: spark(35420, -0.52, 24) },
];

const SECTORS: Sector[] = [
  { name: "반도체", changePercent: 2.41 },
  { name: "자동차", changePercent: 0.86 },
  { name: "금융", changePercent: 0.32 },
  { name: "2차전지", changePercent: -2.18 },
  { name: "인터넷", changePercent: -0.74 },
  { name: "바이오", changePercent: -0.21 },
];

export const MOCK_MARKET_HOME: MarketHome = {
  // 전부 목 데이터인 경우 — 실 연결 모드에서는 서비스가 이 목록을 좁힌다.
  sampleSections: ["movers", "sectors", "news"],
  indices: INDICES,
  gainers: GAINERS,
  losers: LOSERS,
  sectors: SECTORS,
  asOf: ASOF,
  news: [
    {
      title: "HBM4 공급 협의 진전 보도 … 하반기 물량 확대 가능성",
      publisher: "연합뉴스",
      time: "2시간 전",
      url: "#",
    },
    {
      title: "반도체 재고 조정 마무리 국면 진입 분석",
      publisher: "한국경제",
      time: "5시간 전",
      url: "#",
    },
    {
      title: "원/달러 1,380원대 … 수출주 환율 효과 점검",
      publisher: "Reuters",
      time: "어제",
      url: "#",
    },
  ],
  apiNotes: [
    "fetch_market_overview_from_yfinance (카테고리별 현재값·변동률·차트)",
    "ensure_listed_companies",
  ],
};

/** 종목 상세 우측 레일이 쓰는 축약 형태 */
export const MOCK_MARKET_OVERVIEW: MarketOverview = {
  category: "index",
  asOf: ASOF,
  indices: INDICES,
};
