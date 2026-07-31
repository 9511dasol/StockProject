// 종목 자동완성 도메인 타입.

import type { Market } from "@/shared/types";

/** 입력 모드 — 쿼리에서 도출한다 (사용자가 고르는 값이 아니다) */
export type SearchMode = "name" | "initials" | "code";

export type SuggestionGroupKey = "name" | "recent" | "code";

/**
 * 자동완성 후보 한 건.
 *
 * 백엔드 StockSuggestion 은 {symbol, name, market, initial_consonants} 뿐이다.
 * nameEn / price / changePercent / spark 는 디자인이 요구하는 표시 항목이고
 * 백엔드에 없다 — 실 연결 시 suggestions 응답 확장이나 시세 병합이 필요하다.
 */
export interface Suggestion {
  /** 삼성전자 */
  name: string;
  nameEn?: string;
  /** 005930 — 라우팅에 쓰는 코드 */
  code: string;
  /** 005930.KS — 정규화 심볼 */
  symbol: string;
  market: Market;
  /** ㅅㅅㅈㅈ */
  initials: string;
  /**
   * 시세는 선택 항목이다. 백엔드 `/stocks/suggestions` 는 종목명·코드·시장만
   * 돌려주고, 자동완성 한 번에 N종목의 시세를 얻으려면 종목마다 yfinance 를
   * 불러야 해서 비현실적이다. 목 데이터에만 채워진다.
   */
  price?: number;
  changePercent?: number;
  spark?: number[];
  /** 이름에서 매칭된 구간 [시작, 끝) — 하이라이트용. 없으면 undefined */
  match?: [number, number];
}

export interface SuggestionGroup {
  key: SuggestionGroupKey;
  label: string;
  /** 대응 백엔드 메서드 (개발 참고용, 프로덕션에서는 제거 가능) */
  note: string;
  items: Suggestion[];
}

export interface SuggestionResponse {
  query: string;
  mode: SearchMode;
  groups: SuggestionGroup[];
  total: number;
  /** 서버 소요 시간(ms) — 하단 "결과 8건 · 0.42s" */
  elapsedMs: number;
}

/** 목록 수집 경로. KRX 실패 → KIND → 내부 기본 목록 순으로 내려간다 */
export type ListedSource = "KRX" | "KIND" | "INTERNAL";

export type SourceState = "사용" | "실패" | "대기";

export interface SourceStep {
  /** KRX CSV / KIND 목록 / 내부 기본 종목 */
  label: string;
  source: ListedSource;
  state: SourceState;
}

/** ensure_listed_companies 진행 상태 → 첫 호출 지연 배너 · 폴백 경고 */
export interface ListedCompaniesStatus {
  ready: boolean;
  loaded: number;
  total: number;
  /** 실제로 쓰인 경로 */
  source: ListedSource;
  /** 3단 파이프라인의 각 단계 상태 (1d 폴백 패널) */
  steps: SourceStep[];
}

export const SOURCE_LABELS: Record<ListedSource, string> = {
  KRX: "KRX CSV",
  KIND: "KIND 목록",
  INTERNAL: "내부 기본 종목",
};
