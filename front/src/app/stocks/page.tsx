import { currentUser } from "@/auth";
import {
  getStockRanking,
  parseRankingQuery,
  RankingFilterBar,
  RankingTable,
} from "@/features/market";
import { SearchTrigger } from "@/features/search";
import { MARKET_CAPTION_SUFFIX } from "@/lib/config/marketHours";
import { masthead } from "@/lib/format";
import { AccountMenu } from "@/shared/components/layout/AccountMenu";
import { Masthead } from "@/shared/components/layout/Masthead";
import { MobileTabBar } from "@/shared/components/layout/MobileTabBar";
import Link from "next/link";
import { BrowseHeader } from "./_components/BrowseHeader";
import { BrowseTabs } from "./_components/BrowseTabs";

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
  const signedIn = Boolean(await currentUser());

  const caption = ranking.asOf
    ? `${masthead(`${ranking.asOf}T06:30:00Z`)} ·${MARKET_CAPTION_SUFFIX}`
    : MARKET_CAPTION_SUFFIX;

  return (
    <>
      <main className="mx-auto flex w-full max-w-shell flex-col gap-4 px-4 pb-28 pt-[26px] md:px-8 md:pb-[30px]">
        {/* **검색 필드를 두지 않는다.** 이 자리에 250px 짜리 필드가 있었는데,
            나머지 컨트롤(테마 토글·관심 종목·계정)이 전부 컴팩트한 버튼이라
            혼자 넓은 요소가 줄의 리듬을 깼다.

            잃는 것이 거의 없다: 팔레트는 ⌘K 로 어디서나 열리고, 모바일은 하단
            탭바에 검색 항목이 있으며, 홈은 본문 첫 블록이 통째로 검색이다(FindBand).
            홈이 이미 마스트헤드 검색을 비워 두고 있으므로 오히려 그쪽과 맞는다.

            조건 검색 탭(/stocks/screener)도 **같이** 비운다 — 한 화면의 두 탭이
            제호 구성이 다르면 탭을 옮길 때마다 줄이 흔들린다. */}
        <Masthead
          caption={caption}
          action={
            <>
              {/* 담아 둔 종목을 여는 곳은 대시보드 하나다. 로그인해야 열리므로
                  안 한 사람에게는 두지 않는다 — 누르면 로그인으로 튕기는 미끼가 된다.
                  로그인 자체는 바로 옆 AccountMenu 가 안내한다. */}
              {signedIn ? (
                <Link
                  href="/dashboard" 
                  className="hidden border border-ink px-4 py-2 font-medium hover:bg-ink hover:text-on-ink md:block"
                  style={{ fontSize: 13 }}
                >
                  대시보드
                </Link>
              ) : null}
              <AccountMenu />
            </>
          }
        />

        <BrowseHeader scope={ranking.scope} />

        <BrowseTabs current="ranking" />

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
