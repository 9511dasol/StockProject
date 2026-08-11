import { AdviceDrawer, AdviceProvider } from "@/features/advice";
import { getMarketOverview } from "@/features/market";
import { SearchTrigger } from "@/features/search";
import { getStockDetail } from "@/features/stocks";
import { getWatchlist } from "@/features/watchlist";
import { API_BASE_URL } from "@/lib/config/env";
import { isResolvableSymbol } from "@/lib/stocks/symbol";
import { readOwnerKey } from "@/lib/watchlist/owner";
import { Masthead } from "@/shared/components/layout/Masthead";
import type { Metadata } from "next";
import { BackendUnreachable } from "./_components/BackendUnreachable";
import { ConsoleView } from "./_components/ConsoleView";
import { EditorialView } from "./_components/EditorialView";
import { StockDetailUnavailable } from "./_components/StockDetailUnavailable";
import { SymbolNotResolved } from "./_components/SymbolNotResolved";
import { ViewSwitch } from "./_components/ViewSwitch";

/**
 * 입력한 문자열을 화면에 보여줄 형태로.
 *
 * `decodeURIComponent` 가 **던질 수 있다.** `/stocks/%` 처럼 이스케이프가 깨진 값이
 * 오면 `URIError` 가 나고, 그러면 원인과 무관한 에러 화면이 후보 고르기 화면을
 * 대신한다. 실패하면 원문을 그대로 쓴다 — 못 읽은 값을 보여주는 것이 화면을
 * 깨뜨리는 것보다 낫다.
 */
function readable(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * 종목일 수 없는 주소는 **색인하지 않는다.**
 *
 * 크롤러가 `/stocks/<아무문자열>` 을 따라오는 것 자체가 상류 호출 증폭이다. 응답이
 * 404 가 아니라 200(후보 고르기)이라, 고지하지 않으면 검색엔진은 그것을 유효한
 * 페이지로 보고 계속 긁는다. 조회는 하지 않고 **모양만** 보므로 비용이 없다.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>;
}): Promise<Metadata> {
  const { symbol } = await params;
  if (isResolvableSymbol(symbol)) return {};

  return { robots: { index: false, follow: false } };
}

export default async function StockDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ ai?: string; fallback?: string; view?: string }>;
}) {
  const [{ symbol }, query] = await Promise.all([params, searchParams]);

  // 여러 도메인을 페이지에서 조합한다 — features 끼리는 직접 import 하지 않는다.
  // 이 fetch 들은 뷰(2a/2b)와 무관하게 한 번만 일어난다: 뷰 전환은 클라이언트에서
  // 표시만 바꾸므로 서버로 다시 오지 않는다.
  // 관심종목은 소유자별 데이터라 쿠키의 신원이 필요하다. proxy.ts 가 렌더보다
  // 먼저 굽고, 여기서는 읽어서 넘기기만 한다 (app/watchlist/page.tsx 와 같은 형태).
  const ownerKey = await readOwnerKey();
  const [result, market, watchlist] = await Promise.all([
    getStockDetail(symbol),
    getMarketOverview("home"),
    getWatchlist(ownerKey),
  ]);

  // 정규화 실패는 404 가 아니라 '후보 고르기'로 받는다 (와이어프레임 1d).
  // 입력한 문자열을 화면에 남겨야 무엇을 못 찾았는지 말할 수 있다.
  if (result.status === "not-found") {
    return (
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-4 pb-[30px] pt-[26px] md:px-8">
        <Masthead
          caption="종목 코드 정규화 실패"
          search={<SearchTrigger />}
        />
        <SymbolNotResolved query={readable(symbol)} />
      </main>
    );
  }

  // 백엔드가 안 떠 있거나 주소가 틀린 경우. 상류 지연과 문구가 달라야 한다 —
  // 여기서는 재시도가 소용없고 서버를 켜는 것이 조치다.
  if (result.status === "offline") {
    return (
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-4 pb-[30px] pt-[26px] md:px-8">
        <Masthead caption="백엔드 연결 실패" search={<SearchTrigger />} />
        <BackendUnreachable baseUrl={API_BASE_URL} />
      </main>
    );
  }

  // 상류 지연. 예외를 던지지 않으므로 렌더는 살아 있고, 이미 있는 에러 화면을
  // 인라인으로 보여준다 — 빈 화면이나 크래시가 아니다.
  if (result.status === "timeout") {
    return (
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-4 pb-[30px] pt-[26px] md:px-8">
        <Masthead caption="시세 응답 지연" search={<SearchTrigger />} />
        <StockDetailUnavailable symbol={readable(symbol)} />
      </main>
    );
  }

  const detail = result.detail;

  return (
    <AdviceProvider
      initialOpen={query.ai === "1"}
      fallback={query.fallback === "1"}
    >
      <ViewSwitch
        initialView={query.view === "console" ? "console" : "editorial"}
        editorial={
          <EditorialView
            detail={detail}
            indices={market.indices}
            watched={watchlist.items.some(
              (item) => item.code === detail.ref.code,
            )}
          />
        }
        console={
          <ConsoleView
            detail={detail}
            indices={market.indices}
            watchlist={watchlist.items}
            universeCount={watchlist.totalCount}
            universeSource="KRX"
          />
        }
      />

      {/* 드로어는 두 뷰가 공유한다 — 하나만 마운트돼야 SSE 스트림도 하나다. */}
      <AdviceDrawer symbol={detail.ref.symbol} />
    </AdviceProvider>
  );
}
