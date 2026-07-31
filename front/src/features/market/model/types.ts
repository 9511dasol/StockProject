// 시장 현황 도메인 타입. 백엔드 GET /markets/overview (명세 6.1) 대응.

export interface MarketIndex {
  /** KOSPI / USD/KRW */
  name: string;
  /** 코스피 / 환율 — 카드 우상단 캡션 */
  label: string;
  value: number;
  change: number;
  changePercent: number;
  /** 소수 자릿수 */
  digits: number;
  /** 카드 영역 스파크라인 원본 값 */
  spark: number[];
}

/** 상승률·하락률 상위 1행 */
export interface Mover {
  name: string;
  nameEn: string;
  code: string;
  price: number;
  changePercent: number;
  spark: number[];
}

/** 업종 등락 바 1행 */
export interface Sector {
  name: string;
  changePercent: number;
}

export interface MarketNewsItem {
  title: string;
  publisher: string;
  /** 서버에서 계산해 내려보내는 상대 시각 문자열 */
  time: string;
  url: string;
}

export interface MarketOverview {
  category: string;
  indices: MarketIndex[];
  /** ISO */
  asOf: string;
}

/** 대응 백엔드 API 가 없어 예시 값으로 채운 블록 */
export type SampleSection = "movers" | "sectors" | "news";

/** 홈(3b) 한 화면이 쓰는 전부 */
export interface MarketHome {
  /** 실데이터가 아닌 섹션. 화면에서 '예시' 뱃지를 붙이는 근거다. */
  sampleSections: SampleSection[];
  indices: MarketIndex[];
  gainers: Mover[];
  losers: Mover[];
  sectors: Sector[];
  news: MarketNewsItem[];
  /** ISO */
  asOf: string;
  apiNotes: string[];
}
