import { detectMode, initialConsonants } from "../model/match";
import { MOCK_UNIVERSE } from "../model/mock";
import type { Suggestion } from "../model/types";

/**
 * 정규화에 실패한 입력에 대해 "이건가요?" 후보를 뽑는다 (와이어프레임 1d).
 *
 * 자동완성(searchSuggestions)과 다른 점: 정확히 일치하지 않아도 되고, 결과가
 * 비면 안 되므로 부분 일치·초성 일치까지 폭을 넓힌다.
 *
 * TODO(백엔드 연결): normalize_stock_code 가 실패했을 때 후보 목록을 함께
 * 내려주면 이 근사 매칭을 지울 수 있다.
 */
export function resolveCandidates(query: string, limit = 5): Suggestion[] {
  const q = query.trim();
  if (!q) return MOCK_UNIVERSE.slice(0, limit);

  const mode = detectMode(q);
  const lower = q.toLowerCase();
  const initials = initialConsonants(q);

  const scored = MOCK_UNIVERSE.map((item) => {
    let score = 0;
    // 가장 긴 공통 접두사 — "삼성전자우선주" 는 "삼성전자"와 4글자를 공유한다
    let shared = 0;
    while (
      shared < Math.min(q.length, item.name.length) &&
      q[shared] === item.name[shared]
    ) {
      shared += 1;
    }
    score += shared * 10;

    if (item.name.toLowerCase().includes(lower)) score += 40;
    if (item.code.toLowerCase().startsWith(lower)) score += 60;
    if (item.symbol.toLowerCase().startsWith(lower)) score += 60;
    if (item.nameEn?.toLowerCase().startsWith(lower)) score += 30;
    if (mode === "initials" && item.initials.startsWith(initials)) score += 50;

    return { item, score };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  // 하나도 안 걸리면 빈 화면 대신 대표 종목이라도 보여준다.
  const matches = scored.slice(0, limit).map((entry) => entry.item);
  return matches.length > 0 ? matches : MOCK_UNIVERSE.slice(0, limit);
}
