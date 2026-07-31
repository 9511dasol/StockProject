// AI 아침 브리핑 (홈 3b). 백엔드에 대응 엔드포인트가 없다 —
// 종목 단위 generate_stock_advice 는 있지만 시장 단위 브리핑은 없다.

export interface WatchlistVerdict {
  name: string;
  code: string;
  /** README 판단 용어: 비중 확대 / 유지 / 관망 / 과열 주의 */
  label: "비중 확대" | "유지" | "관망" | "과열 주의";
}

export interface MorningBriefing {
  /** 07:40 */
  time: string;
  headline: string;
  /** ＋ 로 표시되는 우호 근거 */
  positives: string[];
  /** － 로 표시되는 부담 근거 */
  negatives: string[];
  watchlist: WatchlistVerdict[];
}

export const MOCK_BRIEFING: MorningBriefing = {
  time: "07:40",
  headline: "반도체가 지수를 끌고, 2차전지가 눌렀습니다.",
  positives: [
    "HBM 수요 보도 3건 · 반도체 업종 +2.41%",
    "외국인 5거래일 연속 순매수",
  ],
  negatives: ["원/달러 1,381원 · 2차전지 -2.18%"],
  watchlist: [
    { name: "삼성전자", code: "005930", label: "비중 확대" },
    { name: "SK하이닉스", code: "000660", label: "유지" },
    { name: "에코프로", code: "086520", label: "관망" },
  ],
};

/**
 * 판단 용어 → 반전 배경 위 색.
 * 등락 색과는 다른 축이라 Delta 를 재사용하지 않는다.
 */
export const VERDICT_TONE: Record<WatchlistVerdict["label"], string> = {
  "비중 확대": "text-up-on-ink",
  유지: "text-up-on-ink",
  관망: "text-down-on-ink",
  "과열 주의": "text-down-on-ink",
};
