import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { ADVICE_STALE_MS, adviceQueryKey, MAX_BULK_SYMBOLS } from "./cache.ts";
import { runAdvice } from "./run.ts";

/**
 * AI 판단은 종목당 LLM 4회다 — 이 프로젝트에서 유일하게 돈이 나가는 경로다.
 * 그래서 여기서 지키는 것은 화면 모양이 아니라 **무엇이 캐시에 들어가는가** 다.
 * 실패한 판단이 성공으로 접히면 그게 캐시에 굳어 다음 요청까지 조용히 재생된다.
 */

const encoder = new TextEncoder();
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

/** BFF 가 흘려보내는 SSE 를 그대로 흉내 낸다 */
function serve(frames: unknown[], { ok = true } = {}) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`));
      }
      controller.close();
    },
  });
  globalThis.fetch = (async () =>
    new Response(body, { status: ok ? 200 : 500 })) as typeof fetch;
}

const AGENT = (name: string) => ({
  agent: name,
  status: "done" as const,
  summary: "분석",
  stance: "긍정" as const,
});

const DECISION = {
  verdict: "BUY" as const,
  decisionLabel: "매수 가능",
  confidence: 71,
  answer: "BUY. 참고용.",
  buyConditions: [],
  riskNotes: [],
  source: "llm" as const,
  updatedAt: "2026-08-05T00:00:00Z",
};

function run() {
  return runAdvice({ symbol: "005930", signal: new AbortController().signal });
}

describe("runAdvice · 스트림을 캐시할 결과물로 접는다", () => {
  test("에이전트는 도착 순서대로 모으고 판단은 마지막 것을 쓴다", async () => {
    serve([
      { stage: 1 },
      { stage: 2 },
      { stage: 3, agent: AGENT("AI 저널리스트") },
      { stage: 3, agent: AGENT("AI 경제학자") },
      { stage: 3, agent: AGENT("AI 애널리스트") },
      { stage: 4, decision: DECISION },
    ]);

    const result = await run();

    assert.deepEqual(
      result.agents.map((opinion) => opinion.agent),
      ["AI 저널리스트", "AI 경제학자", "AI 애널리스트"],
    );
    assert.equal(result.decision.verdict, "BUY");
  });

  test("stage 0 에러는 성공으로 접히지 않는다", async () => {
    // 스트림은 **정상 종료**하면서 에러만 싣고 올 수 있다(상류 429 등). 이걸 성공으로
    // 처리하면 실패가 캐시에 들어가 staleTime 동안 계속 재생된다.
    serve([{ stage: 0, error: "Too Many Requests. Rate limited." }]);

    await assert.rejects(run(), /Rate limited/);
  });

  test("판단 없이 끝난 스트림도 거부한다", async () => {
    // 에이전트만 오고 종합이 없는 경우. 캐시에 '판단 없는 판단'이 들어가면
    // 화면은 영원히 빈 최종 블록을 그린다.
    serve([{ stage: 1 }, { stage: 3, agent: AGENT("AI 저널리스트") }]);

    await assert.rejects(run(), /판단을 받지 못했습니다/);
  });

  test("HTTP 실패는 그대로 올린다", async () => {
    serve([], { ok: false });

    await assert.rejects(run(), /advice stream failed: 500/);
  });
});

describe("advice 캐시 정책", () => {
  test("쿼리 키가 fallback 모드를 분리한다", () => {
    // fallback 은 일부러 실패를 재현하는 개발용 경로다. 정상 결과와 같은 칸에
    // 담기면 서로를 덮어써서, 개발 중 한 번 켠 것이 실제 판단을 지운다.
    assert.notDeepEqual(adviceQueryKey("005930.KS"), adviceQueryKey("005930.KS", true));
    assert.deepEqual(adviceQueryKey("005930.KS"), ["advice", "005930.KS", false]);
  });

  test("클라이언트 staleTime 이 서버 TTL 과 같다", () => {
    // back/app/core/config.py 의 advice_cache_ttl_seconds 기본값(600초).
    // 클라이언트가 더 짧으면 서버 캐시에만 닿는 헛 요청이 늘고, 더 길면 새 기사가
    // 떴는데도 화면이 모르는 구간이 생긴다. 한쪽을 바꾸면 이 테스트가 깨진다.
    assert.equal(ADVICE_STALE_MS, 600 * 1000);
  });

  test("일괄 분석 상한이 LLM 호출 40회 안에 있다", () => {
    // 종목당 4회. 이 숫자를 올릴 때는 그게 곧 비용이라는 것을 알고 올려야 한다.
    assert.ok(MAX_BULK_SYMBOLS * 4 <= 40);
  });
});
