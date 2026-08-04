import {
  getStockRanking,
  parseBoard,
  parseSort,
  RankingFilters,
  RankingTable,
} from "@/features/market";
import { SearchTrigger } from "@/features/search";
import { MARKET_CAPTION_SUFFIX } from "@/lib/config/marketHours";
import { masthead } from "@/lib/format";
import { Masthead } from "@/shared/components/layout/Masthead";
import { MobileTabBar } from "@/shared/components/layout/MobileTabBar";
import Link from "next/link";

/**
 * 종목 탐색 · 랭킹.
 *
 * 홈과 같은 이유로 요청 시 렌더한다 — 정적 프리렌더로 두면 `next build` 가 빌드
 * 머신에서 백엔드에 접속해야 하고, 성공해도 빌드 시점 시세가 이미지에 구워진다.
 * 실제 백엔드 호출 빈도는 fetch 의 revalidate(장중 60초/장외 900초)가 정한다.
 */
export const dynamic = "force-dynamic";

/**
 * 필터·정렬 상태를 클라이언트가 아니라 **URL** 이 들고 있다.
 *
 * 관심종목 화면(WatchlistBoard)은 'use client' 로 상태를 들지만 여기는 그럴 이유가
 * 없다: 200행을 브라우저로 내려보낼 필요가 없고, 링크 방식이 공유 가능한 주소와
 * 뒤로가기를 공짜로 준다. 덕분에 이 화면은 전부 서버 컴포넌트다.
 */
export default async function StockBrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; board?: string }>;
}) {
  const query = await searchParams;
  const sort = parseSort(query.sort);
  const board = parseBoard(query.board);

  const ranking = await getStockRanking({ sort, board });

  const caption = ranking.asOf
    ? `${masthead(`${ranking.asOf}T06:30:00Z`)} · ${MARKET_CAPTION_SUFFIX}`
    : MARKET_CAPTION_SUFFIX;

  return (
    <>
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-4 pb-28 pt-[26px] md:px-8 md:pb-[30px]">
        <Masthead
          caption={caption}
          search={
            <span className="hidden md:block">
              <SearchTrigger />
            </span>
          }
          action={
            <Link
              href="/watchlist"
              className="hidden border border-ink px-4 py-2 font-medium hover:bg-ink hover:text-on-ink md:block"
              style={{ fontSize: 13 }}
            >
              관심 종목
            </Link>
          }
        />

        <div className="flex items-baseline justify-between gap-4 border-b border-line-20 pb-2">
          <h1
            className="font-mono font-medium uppercase tracking-label"
            style={{ fontSize: 11 }}
          >
            종목 탐색
          </h1>
          {/* 모집단을 그대로 밝힌다 — 전 종목을 훑은 것처럼 읽히면 안 된다 */}
          <span className="font-mono text-muted-45" style={{ fontSize: 10 }}>
            {ranking.scope || "랭킹 준비 중"}
          </span>
        </div>

        <RankingFilters sort={sort} board={board} total={ranking.total} />
        <RankingTable rows={ranking.rows} />
      </main>

      <MobileTabBar current="stocks" search={<SearchTrigger variant="tab" />} />
    </>
  );
}
