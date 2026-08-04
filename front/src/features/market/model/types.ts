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
  /**
   * 영문 상호. 백엔드 상장사 목록은 KRX 한글명만 갖고 있어 실데이터에서는 비고,
   * 목 데이터에만 채워진다 — 있을 때만 코드 옆에 덧붙인다.
   */
  nameEn?: string;
  code: string;
  price: number;
  changePercent: number;
  spark: number[];
}

export interface MarketOverview {
  category: string;
  indices: MarketIndex[];
  /** ISO */
  asOf: string;
}

/** 홈 한 화면이 쓰는 전부 */
export interface MarketHome {
  /**
   * 등락 상위가 예시 데이터인지. 화면에서 '예시' 뱃지를 붙이는 근거다.
   *
   * 전에는 `sampleSections: SampleSection[]` 였다 — 업종·뉴스가 목이던 시절엔
   * 목록이 필요했지만, 그 둘을 걷어낸 뒤로는 예시가 될 수 있는 블록이 등락 상위
   * 하나뿐이라(랭킹 스냅샷 워밍업 전) 불리언이 정직하다.
   */
  moversAreSample: boolean;
  indices: MarketIndex[];
  gainers: Mover[];
  losers: Mover[];
  /**
   * 등락 상위 목록의 모집단 캡션. 백엔드가 실제로 스캔한 범위를 그대로 받는다
   * ("시가총액 상위 200종목") — 화면에 "KOSPI+KOSDAQ" 을 박아 두면 전 종목을
   * 훑은 것처럼 읽힌다.
   */
  moversScope: string;
  /** ISO */
  asOf: string;
  apiNotes: string[];
}
