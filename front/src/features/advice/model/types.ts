// AI 멀티 에이전트 판단 타입. 백엔드 app/schemas/advice.py 와 필드 의미를 맞춘다.

/** 백엔드 Verdict — BUY=매수 가능 / WATCH=관망 / AVOID=매수 보류 */
export type Verdict = "BUY" | "WATCH" | "AVOID";

export type AgentStatus = "done" | "fallback";

/**
 * 최종 판단이 **어떻게** 만들어졌는가. 백엔드 `app/schemas/advice.py` 의
 * `DecisionSource` 와 1:1 이다 — 한쪽만 바뀌면 계약이 조용히 갈라진다.
 *
 * `"timeout"` 은 실패가 아니라 **착지 방식**이다. 백엔드가 실행 예산(기본 90초)을
 * 넘겨 그때까지 모은 지표로 규칙 기반 판단을 냈다는 뜻이고, 화면 취급은
 * `"fallback"` 과 같되 **이유 문장만 다르다**.
 *
 * 값을 늘릴 때 `=== "fallback"` 같은 리터럴 비교를 남겨 두면 안 된다 — 유니온이
 * 넓어져도 tsc 가 아무 말을 하지 않고 조용히 false 가 된다. 화면은 조회
 * 테이블(`FinalDecision` 의 `RULE_BASED`)로 받아 새 값이 컴파일 에러가 되게 한다.
 */
export type DecisionSource = "llm" | "fallback" | "timeout";

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

/** 적합도가 깎인 이유 한 건. 백엔드 FitConcern 대응 */
export interface FitConcern {
  /** 적합도 축 이름 — "변동성 부담" */
  axis: string;
  severity: "low" | "medium" | "high";
  /** 사용자에게 그대로 보여줄 문장 */
  message: string;
}

/**
 * 2축 판단. 백엔드 PersonalVerdict 대응 (사주 통합 계획 5.4).
 *
 * 투자 성향 프로파일이 저장돼 있을 때만 온다. 없으면 undefined 이고 화면은 시장
 * 판단만 그린다 — 개인화는 얹는 기능이지 전제 조건이 아니다.
 *
 * `marketVerdict` 가 따로 있는 이유: 화면이 "시장은 BUY 인데 당신에게는 관망"
 * 이라는 **불일치 자체**를 보여주기 때문이다(계획 5.6). 결합 결과만으로는 그 화면을
 * 만들 수 없다.
 */
export interface PersonalVerdict {
  /** 보정 전 시장 판단 */
  marketVerdict: Verdict;
  marketConfidence: number;
  /** 0~100 */
  fitScore: number;
  fitLevel: "high" | "medium" | "low";
  /** 보정 후 최종 판단. **절대 상향되지 않는다** (단방향 보정 원칙) */
  verdict: Verdict;
  /** "분할 매수" · "관망" 등 화면 라벨 */
  label: string;
  /** 프로파일이 실제로 판단을 움직였는지 — '왜 갈렸나' 블록을 켜는 근거 */
  adjusted: boolean;
  concerns: FitConcern[];
  /** "그래도 사겠다면" — 막지 않고 방법을 준다 */
  guardrails: string[];
}

/**
 * 최종 판단. 백엔드 StockAdviceResponse 의 판단 부분에 대응.
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
  source: DecisionSource;
  /** 투자 성향 프로파일이 있을 때만. 위 verdict 는 **시장 판단 그대로**다 */
  personal?: PersonalVerdict;
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
  /**
   * 이번 실행에 허용된 시간(ms). 진행 단계 이벤트에만 실린다.
   *
   * 서버가 보내 주는 이유: 진행 표시가 "N초가 지나면 그때까지 모은 지표로
   * 마무리합니다" 라고 예고하는데, 그 N 을 프런트 상수로 두면 백엔드 예산을
   * 조이는 순간 화면이 거짓말을 한다.
   */
  budgetMs?: number;
}

/** 에이전트 카드의 영문 부제. 백엔드 프로필 이름 → 표시 메타 */
export const AGENT_META: Record<string, { nameEn: string }> = {
  "AI 저널리스트": { nameEn: "Journalist" },
  "AI 경제학자": { nameEn: "Economist" },
  "AI 애널리스트": { nameEn: "Analyst" },
};

export const AGENT_COUNT = 3;
