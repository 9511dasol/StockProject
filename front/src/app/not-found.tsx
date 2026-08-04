import Link from "next/link";
import { resolveCandidates } from "@/features/search";
import { SearchTrigger } from "@/features/search";
import {
  NotFoundScreen,
  RequestedPath,
  type NotFoundDestination,
  type NotFoundSuggestion,
} from "@/shared/components/feedback";
import { Masthead } from "@/shared/components/layout/Masthead";
import { MobileTabBar } from "@/shared/components/layout/MobileTabBar";

/**
 * 루트 404. `notFound()` 호출뿐 아니라 어떤 라우트에도 매칭되지 않은 URL 전부를
 * 여기서 받는다 (Next 16 not-found.js 규약).
 *
 * 전부 서버 컴포넌트다. 요청 헤더도 백엔드도 건드리지 않아 404 한 번에 붙는
 * 비용이 없다 — 유일한 클라이언트 조각은 주소 한 줄을 읽는 RequestedPath 다.
 * (라우트가 ƒ 로 잡히는 건 루트 레이아웃이 테마 쿠키를 읽기 때문이고, 이 화면이
 * 더하는 동적 요인은 없다.)
 *
 * metadata 는 내보내지 않는다. Next 는 not-found.js 의 metadata export 를 읽지
 * 않고(레이아웃·페이지 전용), 404 응답에는 `noindex` 를 자동으로 붙인다.
 */

/** 되돌아갈 길. 이 앱이 실제로 가진 라우트만 적는다. */
const DESTINATIONS: readonly NotFoundDestination[] = [
  {
    href: "/",
    label: "시장 현황",
    hint: "지수 · 등락 상위",
    icon: "home",
  },
  {
    href: "/stocks",
    label: "종목 탐색",
    hint: "시가총액 · 등락률 순위",
    icon: "compass",
  },
  {
    href: "/watchlist",
    label: "관심 종목",
    hint: "보유·알림·AI 일괄 판단",
    icon: "star",
  },
  {
    // 종목 URL 형태를 잘못 친 사람에게 올바른 예시를 보여주는 자리다.
    href: "/stocks/005930",
    label: "종목 상세",
    hint: "/stocks/{6자리 코드}",
    icon: "chart",
  },
];

export default function NotFound() {
  // 후보 조회는 features/search 소유다. 여기(app 계층)에서 search·shared 를
  // 조합하고, shared 는 features 를 모른 채 자기 타입만 받는다.
  const suggestions: NotFoundSuggestion[] = resolveCandidates("", 5).map(
    (item) => ({
      name: item.name,
      code: item.code,
      symbol: item.symbol,
      market: item.market,
    }),
  );

  return (
    <>
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-[22px] px-4 pb-28 pt-[26px] md:px-8 md:pb-[30px]">
        <Masthead
          caption="404 · 요청한 지면 없음"
          search={
            <span className="hidden md:block">
              <SearchTrigger />
            </span>
          }
          action={
            <Link
              href="/"
              className="hidden border border-ink px-4 py-2 font-medium hover:bg-ink hover:text-on-ink md:block"
              style={{ fontSize: 13 }}
            >
              시장 현황
            </Link>
          }
        />

        <NotFoundScreen
          scope="route"
          title="이 주소에는 지면이 없습니다"
          description="주소가 바뀌었거나, 종목 코드가 6자리가 아니거나, 링크가 오래된 경우입니다. 아래에서 원하는 화면으로 바로 이동할 수 있습니다."
          trace={<RequestedPath />}
          primaryAction={{ href: "/", label: "시장 현황으로" }}
          destinations={DESTINATIONS}
          suggestions={suggestions}
          suggestionsNote="mock_universe"
          note="route_not_matched · app/not-found.tsx"
        />
      </main>

      {/* 모바일에서는 어느 탭도 활성이 아니다 — 404 는 탭 어디에도 속하지 않는다 */}
      <MobileTabBar search={<SearchTrigger variant="tab" />} />
    </>
  );
}
