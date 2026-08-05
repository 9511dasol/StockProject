import { SearchTrigger } from "@/features/search";
import { getWatchlist } from "@/features/watchlist";
import { USE_MOCK } from "@/lib/config/env";
import { MARKET_CAPTION_SUFFIX } from "@/lib/config/marketHours";
import { masthead } from "@/lib/format";
import { readOwnerKey } from "@/lib/watchlist/owner";
import { Masthead } from "@/shared/components/layout/Masthead";
import { MobileTabBar } from "@/shared/components/layout/MobileTabBar";
import { WatchlistBoard } from "./_components/WatchlistBoard";

/**
 * 관심종목은 **사용자별 데이터**라 캐시하거나 프리렌더할 수 없다.
 * 소유자마다 응답이 다르므로 URL 을 키로 쓰는 어떤 캐시에도 담기면 안 된다.
 */
export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  // 소유자 쿠키는 렌더보다 먼저 도는 proxy.ts 가 굽는다 — 서버 컴포넌트는 쿠키를
  // 읽을 수만 있다(Next 제약). 여기서는 읽어서 서비스에 넘기기만 한다.
  const ownerKey = await readOwnerKey();
  const watchlist = await getWatchlist(ownerKey);

  const caption = USE_MOCK
    ? `${masthead(new Date().toISOString())} · ${MARKET_CAPTION_SUFFIX} · 예시 데이터`
    : `${masthead(new Date().toISOString())} · ${MARKET_CAPTION_SUFFIX}`;

  return (
    <>
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-4 pb-40 pt-[26px] md:px-8 md:pb-[30px]">
        <Masthead
          caption={caption}
          search={
            <span className="hidden md:block">
              <SearchTrigger />
            </span>
          }
        />
        <WatchlistBoard initial={watchlist} />
      </main>

      <MobileTabBar
        current="watchlist"
        search={<SearchTrigger variant="tab" />}
      />
    </>
  );
}
