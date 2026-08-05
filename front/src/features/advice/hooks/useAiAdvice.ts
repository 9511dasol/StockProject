"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import {
  ADVICE_GC_MS,
  ADVICE_STALE_MS,
  adviceQueryKey,
  type AdviceResult,
} from "../model/cache";
import { runAdvice } from "../model/run";
import type { AdviceStage, AgentOpinion, Decision } from "../model/types";

/** 스트림이 도는 동안만 의미가 있는 상태. 결과는 React Query 가 들고 있다. */
interface Progress {
  stage: AdviceStage;
  agents: AgentOpinion[];
  error: string | null;
}

const IDLE: Progress = { stage: 0, agents: [], error: null };

export interface AiAdviceState {
  stage: AdviceStage;
  agents: AgentOpinion[];
  decision: Decision | null;
  error: string | null;
  running: boolean;
  /** 캐시를 건너뛰고 다시 요청한다 */
  retry: () => void;
}

/**
 * AI 판단 스트림 구독 + 결과 캐시.
 *
 * 예전에는 `enabled` 가 true 가 될 때마다 무조건 스트림을 열었다. 드로어를 닫았다
 * 다시 열면 같은 종목에 **LLM 4회가 또 나갔다** — 재무 조회에도 15분 캐시가 있는데
 * 정작 제일 비싼 경로만 캐시가 없었다.
 *
 * 이제 결과를 React Query 가 들고 있고, `ADVICE_STALE_MS` 안에는 요청 자체가 나가지
 * 않는다. 그 시간이 지나면 다시 물어보되, 새 기사가 없으면 **서버가** LLM 없이 같은
 * 답을 즉시 돌려준다 (model/cache.ts 의 2층 구조 주석).
 *
 * 상태가 두 갈래인 이유: 진행 단계·중간 에이전트 카드는 이번 실행에만 의미가 있어
 * 캐시하면 안 되고(다음에 열었을 때 남의 진행 바를 보게 된다), 판단 결과는 캐시해야
 * 한다. 그래서 진행은 로컬 state, 결과는 쿼리 캐시다.
 */
export function useAiAdvice({
  symbol,
  enabled,
  fallback = false,
}: {
  symbol: string;
  enabled: boolean;
  fallback?: boolean;
}): AiAdviceState {
  const queryClient = useQueryClient();
  // useQuery 자체는 키를 해시하므로 매 렌더 새 배열이어도 상관없지만, 아래 retry 의
  // useCallback 의존성에 들어가므로 고정한다 — 안 그러면 retry 가 렌더마다 새 함수가
  // 되어 FinalDecision 의 onRetry prop 이 계속 바뀐다.
  const queryKey = useMemo(
    () => adviceQueryKey(symbol, fallback),
    [symbol, fallback],
  );
  const [progress, setProgress] = useState<Progress>(IDLE);

  // 종목·모드가 바뀌면 진행 상태를 버린다. effect 로 하면 이전 종목의 진행 바가
  // 한 프레임 남으므로 렌더 중 조정 패턴을 쓴다(예전 구현과 같은 이유).
  const runToken = `${symbol}:${fallback}`;
  const [seenToken, setSeenToken] = useState(runToken);
  if (seenToken !== runToken) {
    setSeenToken(runToken);
    setProgress(IDLE);
  }

  const query = useQuery<AdviceResult>({
    queryKey,
    enabled,
    staleTime: ADVICE_STALE_MS,
    gcTime: ADVICE_GC_MS,
    // 전역 기본값은 5xx 를 한 번 더 시도한다. 여기서는 끈다 — 실패한 분석을 자동으로
    // 다시 돌리면 사용자가 아무것도 누르지 않았는데 LLM 4회가 더 나간다.
    retry: false,
    queryFn: ({ signal }) =>
      runAdvice({
        symbol,
        fallback,
        signal,
        onEvent: (event) =>
          setProgress((prev) => ({
            // 진행은 되감기지 않는다. 에러 이벤트는 stage 를 싣지 않아 0 으로
            // 내려오는데, 그대로 반영하면 3/4 까지 찬 진행 바가 0 으로 튄다.
            stage: Math.max(prev.stage, event.stage) as AdviceStage,
            agents: event.agent ? [...prev.agents, event.agent] : prev.agents,
            error: event.error ?? prev.error,
          })),
      }),
  });

  const retry = useCallback(() => {
    setProgress(IDLE);
    // refetch 는 staleTime 을 무시한다. 서버 캐시까지 무시하지는 않는데, 그게 맞다 —
    // 재시도가 곧 LLM 4회를 다시 태우는 뜻이면 이 버튼을 누르기 무서워진다.
    // 규칙 기반 폴백은 애초에 서버가 캐시하지 않으므로 이 버튼이 진짜로 다시 돌린다.
    void queryClient.refetchQueries({ queryKey, exact: true });
  }, [queryClient, queryKey]);

  const cached = query.data ?? null;

  return {
    // 캐시 적중이면 진행 바가 돈 적이 없다 — 완료 상태로 그린다.
    stage: cached ? 4 : progress.stage,
    // 완료 전에는 도착한 순서대로 쌓인 것을, 완료 뒤에는 캐시된 한 벌을 쓴다.
    // 실패했을 때 progress 쪽이 남아 있어야 이미 받은 카드가 사라지지 않는다.
    agents: cached ? cached.agents : progress.agents,
    decision: cached?.decision ?? null,
    error: query.error ? query.error.message : progress.error,
    running: query.isFetching,
    retry,
  };
}
