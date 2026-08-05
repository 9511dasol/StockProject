import {
  getStockRanking,
  parseRankingQuery,
  RankingFilterBar,
  RankingTable,
} from "@/features/market";
import { SearchTrigger } from "@/features/search";
import { MARKET_CAPTION_SUFFIX } from "@/lib/config/marketHours";
import { masthead } from "@/lib/format";
import { Masthead } from "@/shared/components/layout/Masthead";
import { MobileTabBar } from "@/shared/components/layout/MobileTabBar";
import Link from "next/link";
import { BrowseHeader } from "./_components/BrowseHeader";

/**
 * 종목 탐색 · 랭킹.
 *
 * 홈과 같은 이유로 요청 시 렌더한다 — 정적 프리렌더로 두면 `next build` 가 빌드
 * 머신에서 백엔드에 접속해야 하고, 성공해도 빌드 시점 시세가 이미지에 구워진다.
 * 실제 백엔드 호출 빈도는 fetch 의 revalidate(장중 60초/장외 900초)가 정한다.
 */
export const dynamic = "force-dynamic";

/** Next 16 은 searchParams 를 Promise 로 준다 — 페이지에서 await 한다. */
interface StockBrowsePageProps {
  searchParams: Promise<{ sort?: string; board?: string }>;
}

/**
 * 필터·정렬 상태를 클라이언트가 아니라 **URL** 이 들고 있다.
 *
 * 관심종목 화면(WatchlistBoard)은 'use client' 로 상태를 들지만 여기는 그럴 이유가
 * 없다: 200행을 브라우저로 내려보낼 필요가 없고, 링크 방식이 공유 가능한 주소와
 * 뒤로가기를 공짜로 준다. 덕분에 **이 화면에서 클라이언트로 내려가는 컴포넌트는
 * 검색 트리거뿐이다** — 마스트헤드·툴바·표·행 전부 서버에서 HTML 로 끝난다.
 *
 * 페이지는 조립만 한다 (CONVENTIONS: app/ 은 라우팅만). 데이터는 services 가,
 * searchParams 검증과 칩 링크 계산은 model 이, 조판은 features/market 의
 * components/browse 가 소유한다.
 */
export default async function StockBrowsePage({
  searchParams,
}: StockBrowsePageProps) {
  const query = parseRankingQuery(await searchParams);
  const ranking = await getStockRanking(query);

  const caption = ranking.asOf
    ? `${masthead(`${ranking.asOf}T06:30:00Z`)} · ${MARKET_CAPTION_SUFFIX}`
    : MARKET_CAPTION_SUFFIX;

  return (
    <>
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 px-4 pb-28 pt-[26px] md:px-8 md:pb-[30px]">
        {/* 검색은 전역 팔레트라 전역 컨트롤(테마 토글·화면 이동)과 같은 덩어리에
            둔다. 본문 필터 옆에 두면 '타이핑하면 표가 걸러진다' 로 읽힌다
            (Masthead · RankingFilterBar 주석). */}
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

        <BrowseHeader scope={ranking.scope} />

        <RankingFilterBar query={query} />

        <RankingTable
          rows={ranking.rows}
          total={ranking.total}
          sort={query.sort}
        />
      </main>

      <MobileTabBar current="stocks" search={<SearchTrigger variant="tab" />} />
    </>
  );
}
