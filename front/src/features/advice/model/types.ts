// AI 멀티 에이전트 판단 타입. 백엔드 app/schemas/advice.py 와 필드 의미를 맞춘다.

/** 백엔드 Verdict — BUY=매수 가능 / WATCH=관망 / AVOID=매수 보류 */
export type Verdict = "BUY" | "WATCH" | "AVOID";

export type AgentStatus = "done" | "fallback";

/**
 * 에이전트가 근거로 인용한 문서. 백엔드 RAG 검색 결과 중 그 에이전트가 실제로
 * 인용한 것만 온다 — 검색됐지만 안 쓴 문서는 넘어오지 않는다.
 */
export interface DocRef {
  title: string;
  publisher?: string;
  url?: string;
  /** ISO 날짜 (YYYY-MM-DD). 모르면 빈 문자열 */
  publishedAt?: string;
}

/**
 * 하위 에이전트 1인의 의견. 백엔드 AgentOpinion 대응.
 *
 * nameEn 은 백엔드에 없다 — AGENT_META 로 프런트에서 채우는 표시용 부제다.
 *
 * stance·sources 는 LLM 경로에서만 온다. 규칙 기반 폴백 의견(status="fallback")은
 * 근거 문서가 없으므로 비어 있고, 카드는 그 자리에 아무것도 그리지 않는다.
 */
export interface AgentOpinion {
  /** "AI 저널리스트" — 백엔드 프로필 이름 그대로 */
  agent: string;
  status: AgentStatus;
  summary: string;
  error?: string | null;
  stance?: "긍정" | "중립" | "부정";
  /** RAG 로 검색·인용된 근거 문서 */
  sources?: DocRef[];
  /** 근거 한 줄 요약. 목 데이터가 쓰는 형태로, sources 가 있으면 그쪽이 우선한다 */
  source?: string;
}

/**
 * 최종 판단. 백엔드 StockAdviceResponse 의 판단 부분에 대응.
 * source 는 fallback_decision(LLM 실패) 여부 — 백엔드는 agents[].status 로 알려준다.
 */
export interface Decision {
  verdict: Verdict;
  /** 사용자에게 보여줄 짧은 판단 문구 — "비중 확대" */
  decisionLabel: string;
  /** 0~100 */
  confidence: number;
  answer: string;
  buyConditions: string[];
  riskNotes: string[];
  source: "llm" | "fallback";
  /** ISO */
  updatedAt: string;
}

/** 진행 단계 0~4 */
export type AdviceStage = 0 | 1 | 2 | 3 | 4;

export const ADVICE_STAGE_LABELS: Record<Exclude<AdviceStage, 0>, string> = {
  1: "주가 데이터 조회",
  2: "뉴스·리포트 수집",
  3: "3개 에이전트 의견 생성",
  4: "최종 판단 종합",
};

/** SSE 로 흘러오는 이벤트 한 건 */
export interface AdviceStreamEvent {
  stage: AdviceStage;
  agent?: AgentOpinion;
  decision?: Decision;
  error?: string;
}

/** 에이전트 카드의 영문 부제. 백엔드 프로필 이름 → 표시 메타 */
export const AGENT_META: Record<string, { nameEn: string }> = {
  "AI 저널리스트": { nameEn: "Journalist" },
  "AI 경제학자": { nameEn: "Economist" },
  "AI 애널리스트": { nameEn: "Analyst" },
};

export const AGENT_COUNT = 3;
