// AI 멀티 에이전트 판단 타입. 백엔드 app/schemas/advice.py 와 필드 의미를 맞춘다.

/** 백엔드 Verdict — BUY=매수 가능 / WATCH=관망 / AVOID=매수 보류 */
export type Verdict = "BUY" | "WATCH" | "AVOID";

export type AgentStatus = "done" | "fallback";

/**
 * 하위 에이전트 1인의 의견. 백엔드 AgentOpinion 대응.
 *
 * nameEn / stance 는 백엔드에 없다 — 디자인의 에이전트 카드가 요구하는 표시 항목이다.
 * nameEn 은 AGENT_META 로 프런트에서 채우고, stance(긍정·중립·부정)는 LLM 출력이
 * 필요하므로 백엔드 확장 대상이다.
 */
export interface AgentOpinion {
  /** "AI 저널리스트" — 백엔드 프로필 이름 그대로 */
  agent: string;
  status: AgentStatus;
  summary: string;
  error?: string | null;
  stance?: "긍정" | "중립" | "부정";
  /** 근거로 삼은 데이터 출처 한 줄 */
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
