import { SearchTrigger } from "@/features/search";
import { getWatchlist } from "@/features/watchlist";
import { Masthead } from "@/shared/components/layout/Masthead";
import { MobileTabBar } from "@/shared/components/layout/MobileTabBar";
import { WatchlistBoard } from "./_components/WatchlistBoard";

export default async function WatchlistPage() {
  const watchlist = await getWatchlist();

  return (
    <>
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-4 pb-40 pt-[26px] md:px-8 md:pb-[30px]">
        <Masthead
          caption="2026. 07. 30 목요일 · 장 마감 15:30 KST · 예시 데이터"
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
