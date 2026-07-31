import {
  LISTED_TOTAL,
  LISTED_WARMUP_MS,
} from "@/features/search/model/mock";
import {
  SOURCE_LABELS,
  type ListedCompaniesStatus,
  type ListedSource,
  type SourceStep,
} from "@/features/search/model/types";
import { apiGet } from "@/lib/api";
import { USE_MOCK } from "@/lib/config/env";

/**
 * 상장사 목록 준비 상태 (BFF). 검색 팔레트가 2초 간격으로 폴링한다.
 *
 * 백엔드 `GET /stocks/listed-companies` 는 수집을 유발하지 않고 상태만 읽는다.
 * 응답 스키마가 프런트 타입과 이미 같아(ready/loaded/total/source/steps) 그대로 넘긴다.
 */

export const dynamic = "force-dynamic";

const PIPELINE: ListedSource[] = ["KRX", "KIND", "INTERNAL"];
const BOOTED_AT = Date.now();

function mockSteps(used: ListedSource): SourceStep[] {
  const usedAt = PIPELINE.indexOf(used);
  return PIPELINE.map((source, index) => ({
    label: SOURCE_LABELS[source],
    source,
    state: index < usedAt ? "실패" : index === usedAt ? "사용" : "대기",
  }));
}

function parseSource(value: string | null): ListedSource {
  return value === "KIND" || value === "INTERNAL" ? value : "KRX";
}

export async function GET(request: Request) {
  const forced = parseSource(new URL(request.url).searchParams.get("source"));

  if (USE_MOCK) {
    const ratio = Math.min(1, (Date.now() - BOOTED_AT) / LISTED_WARMUP_MS);
    const status: ListedCompaniesStatus = {
      ready: ratio >= 1,
      loaded: Math.round(LISTED_TOTAL * ratio),
      total: LISTED_TOTAL,
      source: forced,
      steps: mockSteps(forced),
    };
    return Response.json(status, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const status = await apiGet<ListedCompaniesStatus>(
      "/stocks/listed-companies",
    );
    return Response.json(status, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // 상태 조회 실패는 조용히 넘긴다 — 배너가 안 보일 뿐 검색은 동작한다.
    return new Response(null, { status: 204 });
  }
}
