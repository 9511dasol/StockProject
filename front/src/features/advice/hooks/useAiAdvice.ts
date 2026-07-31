"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { streamAdvice } from "../model/stream";
import type { AdviceStage, AgentOpinion, Decision } from "../model/types";

interface AdviceState {
  stage: AdviceStage;
  agents: AgentOpinion[];
  decision: Decision | null;
  error: string | null;
  running: boolean;
}

const IDLE: AdviceState = {
  stage: 0,
  agents: [],
  decision: null,
  error: null,
  running: false,
};

/**
 * AI 판단 스트림 구독. `enabled` 가 true 가 되는 순간 한 번 실행되고,
 * false 로 돌아가면 요청을 abort 하고 상태를 비운다.
 */
export function useAiAdvice({
  symbol,
  enabled,
  fallback = false,
}: {
  symbol: string;
  enabled: boolean;
  fallback?: boolean;
}) {
  const [state, setState] = useState<AdviceState>(IDLE);
  const [attempt, setAttempt] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // 새 실행이 시작되면 상태를 초기화한다. effect 안에서 setState 하면 렌더가
  // 한 번 더 도는 대신, 렌더 중 조정 패턴으로 같은 프레임에 처리한다.
  const runToken = `${enabled}:${symbol}:${fallback}:${attempt}`;
  const [seenToken, setSeenToken] = useState(runToken);
  if (seenToken !== runToken) {
    setSeenToken(runToken);
    setState(enabled ? { ...IDLE, running: true } : IDLE);
  }

  useEffect(() => {
    if (!enabled) {
      abortRef.current?.abort();
      abortRef.current = null;
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    streamAdvice({
      symbol,
      fallback,
      signal: controller.signal,
      onEvent: (event) =>
        setState((prev) => ({
          // 진행은 되감기지 않는다. 에러 이벤트는 stage 를 싣지 않아 0 으로
          // 내려오는데, 그대로 반영하면 3/4 까지 찬 진행 바가 0 으로 튄다.
          stage: Math.max(prev.stage, event.stage) as AdviceStage,
          agents: event.agent ? [...prev.agents, event.agent] : prev.agents,
          decision: event.decision ?? prev.decision,
          error: event.error ?? prev.error,
          running: event.stage < 4 && !event.error,
        })),
    })
      .then(() => setState((prev) => ({ ...prev, running: false })))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState((prev) => ({
          ...prev,
          running: false,
          error: error instanceof Error ? error.message : "unknown_error",
        }));
      });

    return () => controller.abort();
  }, [enabled, symbol, fallback, attempt]);

  return { ...state, retry };
}
