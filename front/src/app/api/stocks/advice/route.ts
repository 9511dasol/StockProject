import type { AdviceStreamEvent } from "@/features/advice";
import {
  mockAdviceEvents,
  toAdviceEvent,
  type WireAdviceEvent,
} from "@/features/advice/server";
import { apiPostStream, ApiError, consumeRateLimit } from "@/lib/api";
import { ADVICE_API_KEY, AI_TIMEOUT_MS, USE_MOCK } from "@/lib/config/env";
import { isResolvableSymbol } from "@/lib/stocks/symbol";
import { readOwnerKey } from "@/app/_data/owner";

/**
 * AI 판단 스트리밍 (BFF). 브라우저는 FastAPI 를 직접 부르지 않는다.
 *
 * 실 모드에서는 백엔드 `POST /stocks/advice/stream` 의 SSE 를 그대로 흘려보내고,
 * 이벤트 스키마만 프런트 타입으로 맞춘다 (snake_case → camelCase).
 * `USE_MOCK=1` 이면 고정 타이밍 목 시퀀스를 낸다 — 백엔드 없이 화면을 확인할 때 쓴다.
 */

export const revalidate = 0;

const encoder = new TextEncoder();
const frame = (event: AdviceStreamEvent) =>
  encoder.encode(`data: ${JSON.stringify(event)}\n\n`);

/** 스트림을 열기도 전에 끝나는 실패를 단일 에러 프레임으로 낸다 — 드로어는
 * SSE 프레임만 파싱하므로 여기서도 평범한 4xx 본문 대신 이 형태를 쓴다. */
function errorStream(message: string): ReadableStream {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(frame({ stage: 0, error: message }));
      controller.close();
    },
  });
}

/**
 * 종목당 LLM 4회다. 한 소유자가 짧은 시간에 너무 많이 돌리면 막는다 — 클라이언트의
 * `MAX_CONCURRENT`·`MAX_BULK_SYMBOLS`(features/advice/model/cache.ts)는 이 라우트를
 * 직접 두드리면 우회된다. 전체 AI 분석 한 번(최대 10종목)을 넉넉히 담는 값으로 잡는다.
 */
const ADVICE_RATE_LIMIT_MAX = 15;
const ADVICE_RATE_LIMIT_WINDOW_MS = 5 * 60_000;

/** 목 시퀀스는 feature 가 소유한다 — 여기서는 SSE 로 감싸기만 한다. */
function mockStream(fallback: boolean, signal: AbortSignal): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const event of mockAdviceEvents(fallback, signal)) {
          controller.enqueue(frame(event));
        }
      } catch {
        // 중단은 정상 종료다 (sleep 이 signal.reason 으로 reject 한다).
      }
      controller.close();
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
              frame(toAdviceEvent(JSON.parse(raw.slice(5).trim()) as WireAdviceEvent)),
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

  // 소유자를 여기서 붙여야 백엔드가 그 사람의 투자 성향으로 판단을 개인화한다
  // (2축 판단 · `personal`). 브라우저는 이 헤더를 직접 만들지 않는다 — 관심종목과
  // 같은 규약이고, `readOwnerKey` 가 "로그인이면 계정, 아니면 브라우저" 규칙의
  // 유일한 출처다.
  const owner = await readOwnerKey();

  // 신원이 없으면 거절한다. 정상적인 브라우저 요청은 로그인 여부와 무관하게
  // `proxy.ts` 가 구운 익명 쿠키로 소유자 키를 갖는다(매처가 `/api/*` 를 포함한다) —
  // 이게 비어 있다는 것은 쿠키 없이 엔드포인트를 직접 두드리는 스크립트일 확률이
  // 높다. 종목당 LLM 4회짜리 문을 그런 요청에 열어 둘 수 없다.
  if (!owner) {
    return new Response(
      errorStream("세션을 확인할 수 없습니다. 새로고침해 주세요."),
      { headers, status: 401 },
    );
  }

  // 모양이 종목 심볼이 아니면 백엔드까지 보내지 않는다 — `getStockDetail` 이
  // 상세 조회에 쓰는 것과 같은 게이트다(`isResolvableSymbol` 주석: 임의 문자열이
  // 그대로 상류 호출로 증폭되는 것을 막는다).
  if (!isResolvableSymbol(symbol)) {
    return new Response(errorStream("종목을 특정할 수 없습니다."), {
      headers,
      status: 400,
    });
  }

  // 클라이언트의 `MAX_CONCURRENT`·`MAX_BULK_SYMBOLS` 는 이 라우트를 직접 두드리면
  // 우회된다 — 여기서도 소유자 단위로 한 번 더 막는다.
  if (!consumeRateLimit(`advice:${owner}`, ADVICE_RATE_LIMIT_MAX, ADVICE_RATE_LIMIT_WINDOW_MS)) {
    return new Response(errorStream("요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요."), {
      headers,
      status: 429,
    });
  }

  try {
    const upstream = await apiPostStream(
      "/stocks/advice/stream",
      { symbol },
      {
        signal,
        timeoutMs: AI_TIMEOUT_MS,
        // 공유 비밀키는 **여기서만** 붙는다. 이 라우트 핸들러는 서버에서만 돌므로
        // 브라우저는 이 헤더도, 값도 보지 못한다. 비어 있으면 헤더를 붙이지 않고,
        // 백엔드도 미설정이면 통과시킨다 — 로컬 개발이 키 없이 그대로 돈다.
        // `owner` 는 위에서 이미 빈 값을 걸렀으므로 여기서는 항상 있다.
        headers: {
          ...(ADVICE_API_KEY ? { "X-Advice-Key": ADVICE_API_KEY } : {}),
          "X-Owner-Key": owner,
        },
      },
    );
    return new Response(proxyStream(upstream, signal), { headers });
  } catch (error) {
    // 스트림을 열기도 전에 실패한 경우 — 드로어가 에러 상태를 그리도록 이벤트로 전달한다.
    const message =
      error instanceof ApiError ? error.message : "AI 분석을 시작하지 못했습니다.";
    return new Response(errorStream(message), { headers });
  }
}
