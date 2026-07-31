import type { SearchScope } from "@/features/search/model/match";
import type { SearchMode } from "@/features/search/model/types";
import { searchSuggestions } from "@/features/search/services/searchSuggestions";

const SCOPES: SearchScope[] = ["all", "name", "code", "ticker"];
const MODES: SearchMode[] = ["name", "initials", "code"];

/**
 * 자동완성 BFF. 브라우저는 FastAPI 를 직접 부르지 않는다.
 *
 * 디바운스(200ms)는 호출하는 쪽(useSuggestions)에 있다 — 서버는 매 요청을 그대로 처리한다.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = params.get("q") ?? "";
  const recentCodes =
    params.get("recent")?.split(",").filter(Boolean).slice(0, 10) ?? [];

  // 프리픽스 파싱은 입력 핸들러(클라이언트)가 하고, 결과만 넘겨받는다.
  const rawScope = params.get("scope");
  const rawMode = params.get("mode");
  const scope = SCOPES.includes(rawScope as SearchScope)
    ? (rawScope as SearchScope)
    : "all";
  const mode = MODES.includes(rawMode as SearchMode)
    ? (rawMode as SearchMode)
    : undefined;

  const result = await searchSuggestions({ query, recentCodes, scope, mode });

  return Response.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
