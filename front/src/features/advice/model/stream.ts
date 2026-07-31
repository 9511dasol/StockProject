import type { AdviceStreamEvent } from "./types";

/**
 * BFF 의 SSE 응답을 이벤트 단위로 흘려준다.
 * 단일 드로어(useAiAdvice)와 관심종목 일괄 분석(useBulkAdvice)이 함께 쓴다.
 */
export async function streamAdvice({
  symbol,
  fallback = false,
  signal,
  onEvent,
}: {
  symbol: string;
  fallback?: boolean;
  signal: AbortSignal;
  onEvent: (event: AdviceStreamEvent) => void;
}): Promise<void> {
  const response = await fetch("/api/stocks/advice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol, fallback }),
    signal,
  });
  if (!response.ok || !response.body) {
    throw new Error(`advice stream failed: ${response.status}`);
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;

    // SSE 는 빈 줄 하나로 이벤트를 구분한다.
    let cut = buffer.indexOf("\n\n");
    while (cut !== -1) {
      const raw = buffer.slice(0, cut).trim();
      buffer = buffer.slice(cut + 2);
      cut = buffer.indexOf("\n\n");
      if (!raw.startsWith("data:")) continue;
      onEvent(JSON.parse(raw.slice(5).trim()) as AdviceStreamEvent);
    }
  }
}
