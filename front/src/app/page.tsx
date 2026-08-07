import {
  CalendarList,
  getMarketHome,
  IndexCards,
  MoverList,
  MoversTabs,
} from "@/features/market";
import { SearchTrigger } from "@/features/search";
import { SampleFrame } from "@/shared/components/feedback";
import { MARKET_CAPTION_SUFFIX } from "@/lib/config/marketHours";
import { masthead } from "@/lib/format";
import { Masthead } from "@/shared/components/layout/Masthead";
import { MobileTabBar } from "@/shared/components/layout/MobileTabBar";
import Link from "next/link";
import { FindBand } from "./_components/FindBand";

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
  const market = await getMarketHome();

  const caption = `${masthead(market.asOf)} · ${MARKET_CAPTION_SUFFIX}`;

  return (
    <>
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-[22px] px-4 pb-28 pt-[26px] md:px-8 md:pb-[30px]">
        {/* 홈만 마스트헤드 검색을 비운다 — 바로 아래 히어로가 같은 일을 더 크게 한다.
            둘을 다 두면 같은 동작이 12px 간격으로 두 번 나와 어느 쪽이 본체인지 흐려진다. */}
        <Masthead
          caption={caption}
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

        {/* 본문 첫 블록 — 홈에서 가장 많이 하는 일이 "종목을 고른다" 이므로
            지수보다 먼저 온다. 지수는 읽는 정보고 이 밴드는 하는 일이다. */}
        <FindBand />

        <IndexCards indices={market.indices} />

        {/* 전체 폭을 쓴다. 예전에는 우측 328px 레일(업종 등락·오늘의 뉴스)이 있어
            `xl:grid-cols-[1fr_328px]` 였는데, 그 둘을 걷어낸 뒤로는 레일에 API 메모
            한 줄만 남아 1280px 이상에서 큰 여백이 생겼다. 2열을 없애니 두 목록이
            각각 넓어져 종목명이 덜 잘린다. */}
        <Sample when={market.moversAreSample} title="등락률 상위">
          {/* 데스크탑은 2열, 모바일은 탭 전환 */}
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

        {/* 등락 상위 **다음**이다. 등락률은 "지금 무슨 일이 일어났나"이고 일정은
            "곧 무슨 일이 일어나나"라, 읽는 순서가 그렇다. `Sample` 로 감싸지 않는
            이유는 이 블록에 예시 데이터가 없기 때문이다 — 없으면 없다고 말한다. */}
        <CalendarList block={market.calendar} />

        {/* 화면이 소비한 백엔드 메서드. 레일이 사라져 맨 아래 전체 폭 각주로 내렸다 */}
        <p
          className="num border-t border-line-20 pt-[9px] text-muted-45"
          style={{ fontSize: 10, lineHeight: 1.7 }}
        >
          {market.apiNotes.join(" · ")}
        </p>
      </main>

      <MobileTabBar current="home" search={<SearchTrigger variant="tab" />} />
    </>
  );
}
