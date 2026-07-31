// 자동완성 목 유니버스. 백엔드 /stocks/suggestions 가 붙으면 삭제된다.

import { initialConsonants } from "./match";
import type { Suggestion } from "./types";

/** 시드 고정 — 스파크라인이 매 렌더 흔들리지 않게 한다 */
function spark(seed: number, changePercent: number, length = 24): number[] {
  let state = seed;
  const next = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  const drift = changePercent / length;
  const points: number[] = [];
  let level = 100;
  for (let i = 0; i < length; i += 1) {
    level += drift + (next() - 0.5) * 1.6;
    points.push(level);
  }
  return points;
}

type Seed = Omit<Suggestion, "initials" | "spark" | "price" | "changePercent"> & {
  seed: number;
  price: number;
  changePercent: number;
};

const SEEDS: Seed[] = [
  { name: "삼성전자", nameEn: "Samsung Electronics", code: "005930", symbol: "005930.KS", market: "KOSPI", price: 71_400, changePercent: 1.42, seed: 5930 },
  { name: "삼성전자우", nameEn: "Samsung Elec. Pref.", code: "005935", symbol: "005935.KS", market: "KOSPI", price: 60_800, changePercent: 0.99, seed: 5935 },
  { name: "삼성SDI", nameEn: "Samsung SDI", code: "006400", symbol: "006400.KS", market: "KOSPI", price: 318_000, changePercent: -2.14, seed: 6400 },
  { name: "삼성바이오로직스", nameEn: "Samsung Biologics", code: "207940", symbol: "207940.KS", market: "KOSPI", price: 862_000, changePercent: 0.35, seed: 207940 },
  { name: "삼성전기", nameEn: "Samsung Electro-Mechanics", code: "009150", symbol: "009150.KS", market: "KOSPI", price: 148_900, changePercent: -0.6, seed: 9150 },
  { name: "SK하이닉스", nameEn: "SK hynix", code: "000660", symbol: "000660.KS", market: "KOSPI", price: 198_300, changePercent: 2.86, seed: 660 },
  { name: "에코프로", nameEn: "Ecopro", code: "086520", symbol: "086520.KQ", market: "KOSDAQ", price: 104_200, changePercent: -1.05, seed: 86520 },
  { name: "카카오", nameEn: "Kakao", code: "035720", symbol: "035720.KS", market: "KOSPI", price: 42_150, changePercent: 0.72, seed: 35720 },
  { name: "네이버", nameEn: "NAVER", code: "035420", symbol: "035420.KS", market: "KOSPI", price: 186_400, changePercent: -0.32, seed: 35420 },
  { name: "애플", nameEn: "Apple Inc.", code: "AAPL", symbol: "AAPL", market: "NASDAQ", price: 241.86, changePercent: 0.54, seed: 1001 },
  { name: "엔비디아", nameEn: "NVIDIA", code: "NVDA", symbol: "NVDA", market: "NASDAQ", price: 178.32, changePercent: 3.11, seed: 1002 },
  { name: "테슬라", nameEn: "Tesla", code: "TSLA", symbol: "TSLA", market: "NASDAQ", price: 402.7, changePercent: -1.83, seed: 1003 },
];

export const MOCK_UNIVERSE: Suggestion[] = SEEDS.map(({ seed, ...item }) => ({
  ...item,
  initials: initialConsonants(item.name),
  spark: spark(seed, item.changePercent),
}));

export function findByCode(code: string): Suggestion | undefined {
  return MOCK_UNIVERSE.find((item) => item.code === code);
}

/**
 * ensure_listed_companies 진행 시뮬레이션.
 * 서버 기동 후 첫 8초 동안 "준비 중"으로 응답한다.
 */
export const LISTED_TOTAL = 2_614;
export const LISTED_WARMUP_MS = 8_000;
