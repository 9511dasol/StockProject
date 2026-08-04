import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseBoard, parseSort, rankingHref } from "./ranking.ts";

/**
 * 탐색 화면은 필터를 URL 로 들고 있다. 즉 사용자가 손으로 고친 문자열이 그대로
 * 백엔드 쿼리에 실릴 수 있는 유일한 자리다 — 그 경계를 고정한다.
 */

describe("ranking · searchParams 파싱", () => {
  test("아는 값은 그대로 통과한다", () => {
    assert.equal(parseSort("change"), "change");
    assert.equal(parseSort("market_cap"), "market_cap");
    assert.equal(parseBoard("KOSDAQ"), "KOSDAQ");
    assert.equal(parseBoard("ALL"), "ALL");
  });

  test("모르는 값은 오류가 아니라 기본값이다", () => {
    // 오래된 북마크나 오타로 들어온 사람에게 400 을 주는 것보다 기본 목록이 낫다.
    assert.equal(parseSort("volume"), "market_cap");
    assert.equal(parseSort(""), "market_cap");
    assert.equal(parseSort(undefined), "market_cap");
    assert.equal(parseBoard("NASDAQ"), "ALL");
    assert.equal(parseBoard(undefined), "ALL");
  });

  test("프로토타입 오염 시도도 기본값으로 떨어진다", () => {
    assert.equal(parseSort("__proto__"), "market_cap");
    assert.equal(parseBoard("constructor"), "ALL");
  });
});

describe("ranking · 링크 생성", () => {
  const base = { sort: "market_cap" as const, board: "ALL" as const };

  test("기본값은 URL 에 싣지 않는다", () => {
    // /stocks 와 /stocks?sort=market_cap&board=ALL 이 같은 화면인데 주소만
    // 다르면 공유·뒤로가기가 지저분해진다.
    assert.equal(rankingHref(base, {}), "/stocks");
    assert.equal(rankingHref(base, { sort: "market_cap" }), "/stocks");
  });

  test("한 축만 바꾸고 나머지는 유지한다", () => {
    assert.equal(rankingHref(base, { sort: "change" }), "/stocks?sort=change");
    assert.equal(rankingHref(base, { board: "KOSPI" }), "/stocks?board=KOSPI");
    assert.equal(
      rankingHref({ sort: "change", board: "KOSDAQ" }, { board: "KOSPI" }),
      "/stocks?sort=change&board=KOSPI",
    );
  });

  test("기본값으로 되돌리면 파라미터가 사라진다", () => {
    assert.equal(
      rankingHref({ sort: "change", board: "KOSPI" }, { board: "ALL" }),
      "/stocks?sort=change",
    );
  });
});
