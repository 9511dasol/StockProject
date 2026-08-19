import { loadWatchlist } from "@/app/_data/watchlist";
import { DashboardDetail } from "./_components/DashboardDetail";

/**
 * `/dashboard` — nav **맨 위 종목**의 상세를 그린다.
 *
 * 리다이렉트하지 않는다. `/dashboard/{첫코드}` 로 튕기면 주소가 사용자가 고르지도
 * 않은 종목으로 바뀌고, 모바일(상세를 안 쓰는 폭)에서도 코드가 붙은 주소를 갖게 된다.
 * 여기서 그냥 그리면 주소는 `/dashboard` 로 남는다.
 *
 * 목록 조회는 레이아웃과 공유한다 — `loadWatchlist` 가 요청 단위로 캐시한다.
 */
export const dynamic = "force-dynamic";

export default async function DashboardDefaultPage({
  searchParams,
}: {
  searchParams: Promise<{ ai?: string }>;
}) {
  const [watchlist, query] = await Promise.all([loadWatchlist(), searchParams]);
  const first = watchlist.items[0];

  if (!first) {
    return (
      <div className="flex flex-col items-center gap-2.5 border border-dashed border-line-25 px-6 py-16">
        <p
          className="font-mono uppercase tracking-label text-muted-35"
          style={{ fontSize: 10.5 }}
        >
          empty
        </p>
        <p className="text-muted-70" style={{ fontSize: 13 }}>
          종목을 담으면 여기에 상세가 열립니다.
        </p>
        <p className="text-muted-45" style={{ fontSize: 12 }}>
          ⌘K 검색에서 ⇥ 로 추가하세요.
        </p>
      </div>
    );
  }

  return <DashboardDetail code={first.code} adviceOpen={query.ai === "1"} />;
}
