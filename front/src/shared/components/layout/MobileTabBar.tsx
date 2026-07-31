import Link from "next/link";
import { Icon } from "@/shared/ui";

/** 각 탭은 44×44 히트 영역을 갖는다 (WCAG 2.5.5). 라벨 10px + 아이콘 15px 는 그대로다. */
const ITEM =
  "flex min-h-[var(--tap)] min-w-[var(--tap)] flex-col items-center justify-center gap-1";

/**
 * 모바일(<768) 하단 탭바. 패딩 11px 12px 22px (README 1절).
 *
 * 높이는 --tabbar-h 로 고정한다. 관심종목(4b)처럼 이 위에 액션 바를 하나 더
 * 얹는 화면이 그 값만큼 띄워야 겹치지 않는다 — 두 요소가 서로를 모른 채
 * 각자 bottom-0 을 잡으면 정확히 포개진다.
 *
 * 검색 트리거는 features/search 소유라 슬롯으로 받는다.
 * AI 는 종목 컨텍스트가 있어야 열 수 있어 여기서는 안내만 한다.
 */
export function MobileTabBar({
  current,
  search,
}: {
  current: "home" | "watchlist";
  search: React.ReactNode;
}) {
  return (
    <nav
      aria-label="주요 화면"
      className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t-2 border-ink bg-paper px-3 pt-[11px] md:hidden"
      style={{
        minHeight: "var(--tabbar-h)",
        paddingBottom: "calc(21px + var(--safe-b))",
      }}
    >
      <Link
        href="/"
        aria-current={current === "home" ? "page" : undefined}
        className={`${ITEM} ${current === "home" ? "text-ink" : "text-muted-35"}`}
        style={{ fontSize: 10 }}
      >
        <Icon name="home" size={17} />
        홈
      </Link>

      {search}

      <Link
        href="/watchlist"
        aria-current={current === "watchlist" ? "page" : undefined}
        className={`${ITEM} ${current === "watchlist" ? "text-ink" : "text-muted-35"}`}
        style={{ fontSize: 10 }}
      >
        <Icon name={current === "watchlist" ? "star-filled" : "star"} size={17} />
        관심
      </Link>

      <span
        aria-disabled
        title="AI 판단은 종목 상세에서 열 수 있습니다"
        className={`${ITEM} text-muted-35`}
        style={{ fontSize: 10 }}
      >
        <Icon name="ai" size={17} />
        AI
      </span>
    </nav>
  );
}
