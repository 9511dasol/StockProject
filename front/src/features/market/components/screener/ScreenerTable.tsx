import type { ScreenerQuery } from "../../model/screener";
import { hasAnyCondition } from "../../model/screener";
import type { ScreenerResult } from "../../services/getScreener";
import { ScreenerCard } from "./ScreenerCard";
import { ScreenerHeadRow } from "./ScreenerHeadRow";
import { ScreenerRow } from "./ScreenerRow";

export interface ScreenerTableProps {
  result: ScreenerResult;
  /** 빈 목록을 어떻게 설명할지 정하는 데 쓴다 */
  query: ScreenerQuery;
}

/**
 * 조건 검색 목록 — 데스크탑 표 / 모바일 행 / 요약을 조립한다.
 *
 * `<table>` 이 아니라 CSS 그리드 + ARIA 다(랭킹 표와 같은 방식). 진짜 표 요소는
 * 7열 중 일부만 다른 폭으로 접는 반응형을 만들 수 없다. 대신 지켜야 할 것이 하나
 * 있다: **`sr-only` 를 그리드 아이템에 직접 주면 안 된다** — position:absolute 가
 * 되어 그리드에서 빠지고 나머지 열이 한 칸씩 밀린다.
 */
export function ScreenerTable({ result, query }: ScreenerTableProps) {
  if (result.rows.length === 0) {
    return <EmptyState result={result} query={query} />;
  }

  return (
    <>
      <div
        role="table"
        aria-label="조건 검색 결과"
        aria-rowcount={result.rows.length + 1}
        className="hidden md:block"
      >
        <ScreenerHeadRow sort={query.sort} order={result.order} />
        {result.rows.map((row) => (
          <ScreenerRow key={row.code} row={row} />
        ))}
      </div>

      <ol className="flex flex-col md:hidden">
        {result.rows.map((row) => (
          <li key={row.code}>
            <ScreenerCard row={row} sort={query.sort} />
          </li>
        ))}
      </ol>

    </>
  );
}

/**
 * 빈 결과를 **세 가지로 갈라 설명한다.**
 *
 * 이 화면에서 "0건" 은 뜻이 하나가 아니다.
 *
 *   ① 배치가 아직 지표를 못 채웠다      → 기다리면 채워진다. 조건을 바꿔도 소용없다
 *   ② 조건이 너무 좁다                  → 조건을 풀면 나온다
 *   ③ 조건이 없는데도 0건               → 백엔드가 꺼져 있거나 목록이 비었다
 *
 * 셋을 "표시할 종목이 없습니다" 하나로 뭉개면, ①인 사람이 조건을 계속 바꾸며
 * 헤매게 된다. 백엔드가 `covered`/`universe_size` 를 함께 주는 이유가 이것이다.
 */
function EmptyState({ result, query }: ScreenerTableProps) {
  const filling = result.covered < result.universeSize;
  const progress =
    result.universeSize > 0
      ? `${result.covered.toLocaleString("ko-KR")} / ${result.universeSize.toLocaleString("ko-KR")}종목`
      : null;

  return (
    <div className="flex flex-col items-center gap-1.5 py-10 text-center">
      <p className="text-muted-60" style={{ fontSize: 12.5 }}>
        {hasAnyCondition(query)
          ? "조건에 맞는 종목이 없습니다."
          : "표시할 종목이 없습니다."}
      </p>

      {filling && progress ? (
        <p className="num text-muted-45" style={{ fontSize: 10.5 }}>
          지표 수집 {progress} — 아직 채우는 중입니다
        </p>
      ) : null}
    </div>
  );
}
