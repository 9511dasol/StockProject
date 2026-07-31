"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { streamAdvice } from "../model/stream";
import type { AdviceStage, Decision } from "../model/types";

export interface BulkAdviceEntry {
  stage: AdviceStage;
  decision: Decision | null;
  running: boolean;
  error: string | null;
}

const PENDING: BulkAdviceEntry = {
  stage: 0,
  decision: null,
  running: true,
  error: null,
};

/**
 * 동시에 여는 스트림 수 상한.
 *
 * 상한이 없으면 '전체 AI 분석'이 관심종목 수만큼(예시 데이터도 18종목) 장시간
 * SSE POST 를 한꺼번에 연다. 브라우저의 호스트당 연결 한도에 걸려 뒤쪽 요청이
 * 큐에서 굶고, 백엔드는 종목당 LLM 4회를 한꺼번에 얻어맞는다.
 * 3이면 사용자는 계속 진행을 보면서도 상류를 밀어붙이지 않는다.
 */
const MAX_CONCURRENT = 3;

/**
 * 여러 종목의 AI 판단을 돌리고 종목별 진행 상태를 따로 들고 있는다.
 *
 * 종목당 LLM 4회(에이전트 3 + 종합 1)라 오래 걸린다. 그래서 하나의 전체
 * 진행률이 아니라 행마다 자기 단계를 보여준다 — 먼저 끝난 종목부터 판단이 뜬다.
 */
export function useBulkAdvice() {
  const [entries, setEntries] = useState<Record<string, BulkAdviceEntry>>({});
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setEntries({});
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const start = useCallback((symbols: { code: string; symbol: string }[]) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setEntries(
      Object.fromEntries(symbols.map(({ code }) => [code, { ...PENDING }])),
    );

    function run({ code, symbol }: { code: string; symbol: string }) {
      return streamAdvice({
        symbol,
        signal: controller.signal,
        onEvent: (event) =>
          setEntries((prev) => ({
            ...prev,
            [code]: {
              // 되감기 방지 — useAiAdvice 와 같은 이유
              stage: Math.max(prev[code]?.stage ?? 0, event.stage) as AdviceStage,
              decision: event.decision ?? prev[code]?.decision ?? null,
              error: event.error ?? prev[code]?.error ?? null,
              running: event.stage < 4 && !event.error,
            },
          })),
      })
        .then(() =>
          setEntries((prev) =>
            prev[code] ? { ...prev, [code]: { ...prev[code], running: false } } : prev,
          ),
        )
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setEntries((prev) => ({
            ...prev,
            [code]: {
              ...(prev[code] ?? PENDING),
              running: false,
              error: error instanceof Error ? error.message : "unknown_error",
            },
          }));
        });
    }

    // 워커 MAX_CONCURRENT 개가 하나의 큐를 나눠 먹는다. 앞 종목이 끝나야
    // 다음 종목이 시작하므로 열려 있는 스트림 수가 상한을 넘지 않는다.
    const queue = [...symbols];
    const worker = async (): Promise<void> => {
      for (;;) {
        const next = queue.shift();
        if (!next || controller.signal.aborted) return;
        await run(next);
      }
    };
    void Promise.all(
      Array.from({ length: Math.min(MAX_CONCURRENT, queue.length) }, worker),
    );
  }, []);

  const active = Object.keys(entries).length > 0;
  const remaining = Object.values(entries).filter((e) => e.running).length;

  return { entries, start, cancel, active, remaining };
}
