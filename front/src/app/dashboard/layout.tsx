import { Suspense } from "react";
import { redirect } from "next/navigation";
import { currentUser } from "@/auth";
import { SearchTrigger } from "@/features/search";
import { USE_MOCK } from "@/lib/config/env";
import { MARKET_CAPTION_SUFFIX } from "@/lib/config/marketHours";
import { masthead } from "@/lib/format";
import { AccountMenu } from "@/shared/components/layout/AccountMenu";
import { Masthead } from "@/shared/components/layout/Masthead";
import { MobileTabBar } from "@/shared/components/layout/MobileTabBar";
import { loadWatchlist } from "@/app/_data/watchlist";
import { BoardSkeleton } from "./_components/BoardSkeleton";
import { DashboardBoard } from "./_components/DashboardBoard";
import { MarketTiles, MarketTilesSkeleton } from "./_components/MarketTiles";

/**
 * 대시보드의 껍데기 — 제호 · 좌측 종목 nav · 그 아래 시장 타일.
 *
 * ```
 * ┌ Masthead ───────────────────────────────────────────────┐
 * ├──────────────────────┬──────────────────────────────────┤
 * │ nav                  │  선택된 종목 상세  (children)     │
 * │  담아 둔 종목 세로    │  ─────────────────────────────    │
 * │  목록                │  MarketTiles                     │
 * │                      │   지수 · 등락 · 일정 · AI 현황    │
 * └──────────────────────┴──────────────────────────────────┘
 *       340px                        1fr
 * ```
 *
 * ## 왜 레이아웃이 nav 와 타일을 갖는가
 *
 * 종목을 고르면 **오른쪽 상세만** 바뀌어야 한다. 레이아웃은 자식 간 이동에서 다시
 * 렌더되지 않으므로(Next 의 partial rendering), 여기 둔 것은 조회도 클라이언트 상태
 * (그룹·정렬·선택·돌고 있는 일괄 AI)도 그대로 살아 있다. 반대로 `page.tsx` 에 두면
 * 클릭마다 관심종목과 시장을 다시 조회한다 — 종목과 아무 상관 없는 데이터인데도.
 *
 * ## 조회 둘을 각자 `Suspense` 로 내린다
 *
 * 이 함수가 직접 `await` 하면 제호까지 막히고, 그때 대신 나오는 것은 루트
 * `loading.tsx`(**홈 골격**)라 화면이 틀린다. 목록과 시장은 서로를 기다릴 이유도
 * 없어서 경계를 따로 둔다 — 목록이 먼저 오면 nav 부터 뜬다.
 *
 * ## 로그인을 요구하는 유일한 화면이다
 *
 * 관심종목을 여는 화면이 여기 하나로 합쳐졌다(`/watchlist` 는 여기로 보낸다).
 * 신원이 없으면 `/login` 으로 보낸다 — 앞단의 [proxy.ts](../../proxy.ts) 가 세션
 * 쿠키 없는 요청을 307 로 먼저 끊고, 여기는 쿠키가 유효하지 않은 경우를 받는 문이다.
 */
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const caption = USE_MOCK
    ? `${masthead(new Date().toISOString())} · ${MARKET_CAPTION_SUFFIX} · 예시 데이터`
    : `${masthead(new Date().toISOString())} · ${MARKET_CAPTION_SUFFIX}`;

  return (
    <>
      <main className="mx-auto flex w-full max-w-shell flex-col gap-5 px-4 pb-40 pt-[26px] md:px-8 md:pb-[30px]">
        <Masthead
          caption={caption}
          search={
            <span className="hidden md:block">
              <SearchTrigger />
            </span>
          }
          action={<AccountMenu />}
        />
        <Suspense fallback={<BoardSkeleton />}>
          {/* 상세(children)와 타일은 **이미 만들어진 엘리먼트**로 넘어간다. 여기서
              렌더되지 않으므로 각자의 Suspense 경계를 그대로 데리고 간다. */}
          <Board detail={children} />
        </Suspense>
      </main>

      <MobileTabBar current="dashboard" search={<SearchTrigger variant="tab" />} />
    </>
  );
}

/** 목록 조회를 레이아웃 밖으로 내리기 위한 얇은 서버 컴포넌트 */
async function Board({ detail }: { detail: React.ReactNode }) {
  const watchlist = await loadWatchlist();

  return (
    <DashboardBoard
      initial={watchlist}
      detail={detail}
      tiles={
        <Suspense fallback={<MarketTilesSkeleton />}>
          <MarketTiles watchlist={watchlist} />
        </Suspense>
      }
    />
  );
}
