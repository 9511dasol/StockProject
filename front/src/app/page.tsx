import { getMorningBriefing, MorningBriefingBanner } from "@/features/advice";
import {
  getMarketHome,
  IndexCards,
  MoverList,
  MoversTabs,
  SectorBars,
  TodayNews,
} from "@/features/market";
import { SearchTrigger } from "@/features/search";
import type { SampleSection } from "@/features/market";
import { SampleFrame } from "@/shared/components/feedback";
import { masthead } from "@/lib/format";
import { Masthead } from "@/shared/components/layout/Masthead";
import { MobileTabBar } from "@/shared/components/layout/MobileTabBar";
import Link from "next/link";

/**
 * 요청 시 렌더한다. 데이터 캐시는 fetch 단위의 `revalidate: 60` 이 담당하므로
 * (lib/config/env.ts) 실제 백엔드 호출은 여전히 60초에 한 번이다.
 *
 * 정적 프리렌더로 두면 `next build` 가 빌드 머신에서 백엔드에 접속해야 한다 —
 * CI·도커 빌드에서 백엔드가 없으면 빌드 자체가 실패하고, 성공하더라도 빌드
 * 시점의 시세가 이미지에 구워진다.
 */
export const dynamic = "force-dynamic";

/** 예시 데이터일 때만 틀을 씌운다 — 실데이터로 바뀌면 그대로 통과시킨다. */
function Sample({
  when,
  title,
  children,
}: {
  when: boolean;
  title: string;
  children: React.ReactNode;
}) {
  if (!when) return <>{children}</>;
  return <SampleFrame title={title}>{children}</SampleFrame>;
}

export default async function MarketHomePage() {
  const [market, briefing] = await Promise.all([
    getMarketHome(),
    getMorningBriefing(),
  ]);

  const sample = (section: SampleSection) =>
    market.sampleSections.includes(section);

  const caption = `${masthead(market.asOf)} · 장 마감 15:30 KST · 예시 데이터`;

  return (
    <>
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-[22px] px-4 pb-28 pt-[26px] md:px-8 md:pb-[30px]">
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

        <IndexCards indices={market.indices} />

        {/* ≥1280 3열 유지 · 1024~1279 우측 레일을 본문 아래로 (README 반응형) */}
        <div className="grid items-start gap-[26px] xl:grid-cols-[1fr_328px]">
          <div className="flex flex-col gap-[22px]">
            <MorningBriefingBanner briefing={briefing} />

            {/* 데스크탑은 2열, 모바일은 탭 전환 */}
            <Sample when={sample("movers")} title="등락률 상위">
              <div className="hidden grid-cols-2 gap-[26px] md:grid">
                <MoverList
                  title="상승률 상위"
                  scope={market.moversScope}
                  items={market.gainers}
                />
                <MoverList
                  title="하락률 상위"
                  scope={market.moversScope}
                  items={market.losers}
                />
              </div>
              <div className="md:hidden">
                <MoversTabs gainers={market.gainers} losers={market.losers} />
              </div>
            </Sample>
          </div>

          <div className="flex flex-col gap-5">
            <Sample when={sample("sectors")} title="업종 등락">
              <SectorBars sectors={market.sectors} />
            </Sample>
            <Sample when={sample("news")} title="오늘의 뉴스">
              <TodayNews items={market.news} />
            </Sample>
            <p
              className="num border-t border-line-20 pt-[9px] text-muted-45"
              style={{ fontSize: 10, lineHeight: 1.7 }}
            >
              {market.apiNotes.join(" · ")}
            </p>
          </div>
        </div>
      </main>

      <MobileTabBar current="home" search={<SearchTrigger variant="tab" />} />
    </>
  );
}
