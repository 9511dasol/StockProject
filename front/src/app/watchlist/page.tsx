import { SearchTrigger } from "@/features/search";
import { getWatchlist } from "@/features/watchlist";
import { MARKET_CAPTION_SUFFIX } from "@/lib/config/marketHours";
import { masthead } from "@/lib/format";
import { Masthead } from "@/shared/components/layout/Masthead";
import { MobileTabBar } from "@/shared/components/layout/MobileTabBar";
import { WatchlistBoard } from "./_components/WatchlistBoard";

export default async function WatchlistPage() {
  const watchlist = await getWatchlist();

  // 이 화면은 아직 전부 목 데이터라 '예시 데이터' 표시를 남긴다. 날짜는 하드코딩돼
  // 있었는데(2026. 07. 30 고정) 어제 본 화면과 오늘 본 화면이 같은 날짜를 말해
  // 오히려 신뢰를 깎았다 — 실제 오늘 날짜로 바꾼다.
  const caption = `${masthead(new Date().toISOString())} · ${MARKET_CAPTION_SUFFIX} · 예시 데이터`;

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
