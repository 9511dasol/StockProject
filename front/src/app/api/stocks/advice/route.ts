import {
  MOCK_AGENTS,
  MOCK_DECISION,
  MOCK_FALLBACK_DECISION,
  MOCK_TIMINGS,
} from "@/features/advice/model/mock";
import type { AdviceStreamEvent } from "@/features/advice/model/types";
import { apiPostStream, ApiError } from "@/lib/api";
import { AI_TIMEOUT_MS, USE_MOCK } from "@/lib/config/env";

/**
 * AI 판단 스트리밍 (BFF). 브라우저는 FastAPI 를 직접 부르지 않는다.
 *
 * 실 모드에서는 백엔드 `POST /stocks/advice/stream` 의 SSE 를 그대로 흘려보내고,
 * 이벤트 스키마만 프런트 타입으로 맞춘다 (snake_case → camelCase).
 * `USE_MOCK=1` 이면 고정 타이밍 목 시퀀스를 낸다 — 백엔드 없이 화면을 확인할 때 쓴다.
 */

export const dynamic = "force-dynamic";

const encoder = new TextEncoder();
const frame = (event: AdviceStreamEvent) =>
  encoder.encode(`data: ${JSON.stringify(event)}\n\n`);

/** back : AdviceStreamEvent */
interface WireAdviceEvent {
  stage: number;
  agent?: {
    agent: string;
    status: "done" | "fallback";
    summary: string;
    error?: string | null;
    stance?: "긍정" | "중립" | "부정" | null;
    sources?: {
      title: string;
      publisher?: string;
      url?: string;
      published_at?: string;
    }[];
  };
  decision?: {
    verdict: "BUY" | "WATCH" | "AVOID";
    decision_label: string;
    confidence: number;
    answer: string;
    buy_conditions: string[];
    risk_notes: string[];
    decision_source: "llm" | "fallback";
    updated_at: string;
  };
  error?: string | null;
}

function toEvent(wire: WireAdviceEvent): AdviceStreamEvent {
  return {
    stage: Math.max(0, Math.min(4, wire.stage)) as AdviceStreamEvent["stage"],
    agent: wire.agent
      ? {
          agent: wire.agent.agent,
          status: wire.agent.status,
          summary: wire.agent.summary,
          error: wire.agent.error ?? null,
          // 규칙 기반 폴백 의견은 둘 다 비어 온다 — 그대로 undefined 로 흘려보내
          // 카드가 근거·성향 자리를 그리지 않게 한다.
          stance: wire.agent.stance ?? undefined,
          sources: wire.agent.sources?.map((doc) => ({
            title: doc.title,
            publisher: doc.publisher ?? "",
            url: doc.url ?? "",
            publishedAt: doc.published_at ?? "",
          })),
        }
      : undefined,
    decision: wire.decision
      ? {
          verdict: wire.decision.verdict,
          decisionLabel: wire.decision.decision_label,
          confidence: wire.decision.confidence,
          answer: wire.decision.answer,
          buyConditions: wire.decision.buy_conditions,
          riskNotes: wire.decision.risk_notes,
          source: wire.decision.decision_source,
          updatedAt: wire.decision.updated_at,
        }
      : undefined,
    error: wire.error ?? undefined,
  };
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

/** 백엔드 없이 화면을 확인하기 위한 고정 타이밍 시퀀스 (README 프로토타입 값) */
function mockStream(fallback: boolean, signal: AbortSignal): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      try {
        let elapsed = 0;
        const waitUntil = async (at: number) => {
          await sleep(at - elapsed, signal);
          elapsed = at;
        };

        await waitUntil(MOCK_TIMINGS.stage1);
        controller.enqueue(frame({ stage: 1 }));
        await waitUntil(MOCK_TIMINGS.stage2);
        controller.enqueue(frame({ stage: 2 }));

        for (let i = 0; i < MOCK_AGENTS.length; i += 1) {
          await waitUntil(MOCK_TIMINGS.agents[i]);
          const agent = fallback
            ? {
                ...MOCK_AGENTS[i],
                status: "fallback" as const,
                summary: "에이전트 호출에 실패했습니다.",
                error: "llm_unavailable",
              }
            : MOCK_AGENTS[i];
          controller.enqueue(frame({ stage: 3, agent }));
        }

        await waitUntil(MOCK_TIMINGS.decision);
        controller.enqueue(
          frame({
            stage: 4,
            decision: fallback ? MOCK_FALLBACK_DECISION : MOCK_DECISION,
          }),
        );
        controller.close();
      } catch {
        controller.close();
      }
    },
  });
}

/** 백엔드 SSE 를 읽어 프런트 이벤트로 다시 내보낸다 */
function proxyStream(upstream: Response, signal: AbortSignal): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      const reader = upstream
        .body!.pipeThrough(new TextDecoderStream())
        .getReader();
      let buffer = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += value;

          let cut = buffer.indexOf("\n\n");
          while (cut !== -1) {
            const raw = buffer.slice(0, cut).trim();
            buffer = buffer.slice(cut + 2);
            cut = buffer.indexOf("\n\n");
            if (!raw.startsWith("data:")) continue;
            controller.enqueue(
              frame(toEvent(JSON.parse(raw.slice(5).trim()) as WireAdviceEvent)),
            );
          }
        }
        controller.close();
      } catch (error) {
        if (!signal.aborted) {
          controller.enqueue(
            frame({ stage: 0, error: (error as Error).message }),
          );
        }
        controller.close();
      } finally {
        void reader.cancel().catch(() => {});
      }
    },
    cancel() {
      void upstream.body?.cancel().catch(() => {});
    },
  });
}

export async function POST(request: Request) {
  const { symbol = "", fallback = false } = (await request
    .json()
    .catch(() => ({}))) as { symbol?: string; fallback?: boolean };

  const signal = request.signal;
  const headers = {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  };

  if (USE_MOCK) {
    return new Response(mockStream(fallback, signal), { headers });
  }

  try {
    const upstream = await apiPostStream(
      "/stocks/advice/stream",
      { symbol },
      { signal, timeoutMs: AI_TIMEOUT_MS },
    );
    return new Response(proxyStream(upstream, signal), { headers });
  } catch (error) {
    // 스트림을 열기도 전에 실패한 경우 — 드로어가 에러 상태를 그리도록 이벤트로 전달한다.
    const message =
      error instanceof ApiError ? error.message : "AI 분석을 시작하지 못했습니다.";
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(frame({ stage: 0, error: message }));
          controller.close();
        },
      }),
      { headers },
    );
  }
}
