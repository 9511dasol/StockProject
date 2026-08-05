import { auth } from "@/auth";
import { SearchTrigger } from "@/features/search";
import { getWatchlist } from "@/features/watchlist";
import { USE_MOCK } from "@/lib/config/env";
import { MARKET_CAPTION_SUFFIX } from "@/lib/config/marketHours";
import { masthead } from "@/lib/format";
import { claimAnonymousWatchlist } from "@/lib/watchlist/claim";
import { readOwnerKey } from "@/lib/watchlist/owner";
import { AccountMenu } from "@/shared/components/layout/AccountMenu";
import { Masthead } from "@/shared/components/layout/Masthead";
import { MobileTabBar } from "@/shared/components/layout/MobileTabBar";
import { WatchlistBoard } from "./_components/WatchlistBoard";

/**
 * 관심종목은 **사용자별 데이터**라 캐시하거나 프리렌더할 수 없다.
 * 소유자마다 응답이 다르므로 URL 을 키로 쓰는 어떤 캐시에도 담기면 안 된다.
 */
export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const session = await auth();
  const userId = session?.user?.id;

  // 로그인 상태에서 익명 쿠키가 아직 남아 있으면 그쪽 목록을 한 번 가져온다.
  // 승계는 **이동**이라 한 번 끝나면 옮길 것이 없고, 그다음부터는 익명 쿠키가
  // 있어도 0건이라 비용이 거의 없다 (lib/watchlist/claim.ts).
  if (userId) await claimAnonymousWatchlist(userId);

  // 소유자 = 로그인했으면 계정, 아니면 브라우저. 그 규칙의 출처는 readOwnerKey 하나다.
  // 익명 쿠키는 렌더보다 먼저 도는 proxy.ts 가 굽는다 — 서버 컴포넌트는 쿠키를
  // 읽을 수만 있다(Next 제약).
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
          action={<AccountMenu />}
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
