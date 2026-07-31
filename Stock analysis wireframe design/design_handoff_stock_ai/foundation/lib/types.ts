// 백엔드 명세 6.1~6.4 반환값에 1:1로 맞춘 도메인 타입.
// 화면 컴포넌트는 이 타입만 받는다. API 응답 형태를 직접 쓰지 말 것.

export type Market = "KOSPI" | "KOSDAQ" | "NASDAQ" | "NYSE";

/** 6.1 종목 코드 정규화 결과 */
export interface StockRef {
  name: string;            // 삼성전자
  nameEn?: string;         // Samsung Electronics
  code: string;            // 005930 (KRX) 또는 AAPL
  symbol: string;          // 005930.KS — krx_symbol_to_yfinance 결과
  market: Market;
  sector?: string;
  initials?: string;       // ㅅㅅㅈㅈ — get_initial_consonants
}

/** 6.2 상장사 목록 준비 상태 → 첫 호출 지연 배너 */
export interface ListedCompaniesStatus {
  ready: boolean;
  loaded: number;
  total: number;
  source: "KRX" | "KIND";   // KIND는 폴백
}

/** 6.3 주가 */
export interface Candle {
  t: string;               // ISO date
  o: number; h: number; l: number; c: number; v: number;
}

export interface StockHistory {
  ref: StockRef;
  candles: Candle[];
  ma20: (number | null)[];
  ma60: (number | null)[];
  bb: { upper: (number | null)[]; lower: (number | null)[] };
  crosses: { index: number; type: "golden" | "dead" }[];
}

export interface StockQuote {
  price: number;
  change: number;          // 전일 대비 금액
  changePercent: number;
  currency: "KRW" | "USD";
  asOf: string;
  session: "regular" | "closed" | "pre" | "post";
}

/** build_stock_metrics */
export interface StockMetrics {
  per?: number; pbr?: number; eps?: number; bps?: number;
  dividendYield?: number; marketCap?: number;
  high52?: number; low52?: number; volume?: number; foreignRatio?: number;
}

/** 6.3 뉴스 · 리포트 (각 최대 3건) */
export interface NewsItem {
  title: string; source: string; publishedAt: string; url: string; imageUrl?: string;
}

export interface AnalystReport {
  title: string; house: string; publishedAt: string;
  opinion: "매수" | "중립" | "매도" | string;
  targetPrice?: number; summary: string; url?: string;
}

/** 6.4 멀티 에이전트 */
export type AgentRole = "technical" | "fundamental" | "sentiment";

export interface AgentOpinion {
  role: AgentRole;
  label: string;           // 기술적 분석 / 재무 분석 / 시장 심리
  stance: "긍정" | "중립" | "부정";
  confidence: number;      // 0~1
  body: string;
  evidence: string[];
}

export type DecisionVerdict = "비중 확대" | "유지" | "관망" | "과열 주의";

export interface Decision {
  verdict: DecisionVerdict;
  confidence: number;      // 0~1
  summary: string;
  pros: string[];
  cons: string[];
  source: "llm" | "fallback";   // fallback_decision이면 '규칙 기반 판단' 배지
}

/** 스트리밍 진행 단계 — 진행 바 4/4 */
export type AiStage = 0 | 1 | 2 | 3 | 4;
export const AI_STAGE_LABELS: Record<Exclude<AiStage, 0>, string> = {
  1: "주가 데이터 조회",
  2: "뉴스·리포트 수집",
  3: "에이전트 의견 생성",
  4: "최종 판단 종합",
};

export interface AiStreamEvent {
  stage: AiStage;
  agent?: AgentOpinion;
  decision?: Decision;
  error?: string;
}

/** 관심 종목 */
export interface WatchItem {
  ref: StockRef;
  group: string;
  order: number;
  holdings?: { quantity: number; avgPrice: number };
  alert?: { enabled: boolean; above?: number; below?: number };
}
