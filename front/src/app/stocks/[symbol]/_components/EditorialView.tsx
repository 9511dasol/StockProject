import { AdviceTrigger } from "@/features/advice";
import { MarketOverviewList, type MarketIndex } from "@/features/market";
import { SearchTrigger } from "@/features/search";
import {
  ApiNote,
  ChartSection,
  DetailTabs,
  FinancialsPanel,
  MetricsRail,
  NewsList,
  ReportDigest,
  ReportList,
  StockHeadline,
  ValuationRail,
  type StockDetail,
} from "@/features/stocks";
import { MARKET_CAPTION_SUFFIX } from "@/lib/config/marketHours";
import { masthead } from "@/lib/format";
import { Masthead } from "@/shared/components/layout/Masthead";
import { ViewToggle } from "./ViewSwitch";

/**
 * 2a 에디토리얼 라이트 — 기본 뷰.
 *
 * 모바일(<768): 헤드라인 세로 스택 → 차트(풀블리드) → 탭 → 리스트 →
 * 우측 레일 섹션들이 본문 아래로 이어붙는다. 레일을 별도 컴포넌트로 갈라놓지
 * 않고 grid 를 1열로 접어 DOM 순서 그대로 흐르게 한다 — 마크업이 하나여야
 * 두 폭에서 내용이 어긋나지 않는다.
 */
export function EditorialView({
  detail,
  indices,
}: {
  detail: StockDetail;
  indices: MarketIndex[];
}) {
  const caption = `${masthead(detail.now)} · ${MARKET_CAPTION_SUFFIX}`;

  return (
    <>
      {/* pb-24: 모바일 하단 고정 AI 버튼에 마지막 섹션이 가리지 않게 띄운다. */}
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-4 pb-24 pt-[26px] md:px-8 md:pb-[30px]">
        <Masthead
          caption={caption}
          search={
            <span className="hidden md:block">
              <SearchTrigger />
            </span>
          }
          action={
            <>
              <ViewToggle />
              <span className="hidden md:block">
                <AdviceTrigger />
              </span>
            </>
          }
        />

        <StockHeadline stock={detail.ref} quote={detail.quote} />

        <div className="grid items-start gap-7 md:grid-cols-[1fr_292px]">
          {/* min-w-0: 그리드 아이템의 기본 min-width:auto 가 차트·표를 밀어내
              1열에서도 가로 스크롤을 만든다 */}
          <div className="flex min-w-0 flex-col gap-3.5">
            <ChartSection candles={detail.candles} />
            <DetailTabs
              panels={[
                {
                  key: "news",
                  label: `뉴스 ${detail.news.length}`,
                  content: <NewsList items={detail.news} now={detail.now} />,
                },
                {
                  key: "reports",
                  label: `애널리스트 리포트 ${detail.reports.length}`,
                  content: <ReportList items={detail.reports} now={detail.now} />,
                },
                {
                  key: "financials",
                  label: "재무",
                  content: (
                    <FinancialsPanel
                      fundamentals={detail.fundamentals}
                      currency={detail.quote.currency}
                    />
                  ),
                },
              ]}
            />
          </div>

          <aside className="flex min-w-0 flex-col gap-[18px]">
            <MetricsRail metrics={detail.metrics} />
            {/* 재무 탭은 세 번째라 기본으로 가려져 있다 — "지금 비싼가/얼마 주나"는
                클릭 없이 보이게 여기에 3행만 요약해 둔다. */}
            <ValuationRail fundamentals={detail.fundamentals} />
            <MarketOverviewList indices={indices} />
            <ReportDigest reports={detail.reports} />
            <ApiNote notes={detail.apiNotes} />
          </aside>
        </div>
      </main>

      {/* 모바일 유일한 AI 진입점 — 누르면 animate-sheet-up 전체화면 시트가 뜬다.
          main 밖에 둔다: fixed 요소가 스크롤 컨테이너 안에 있으면 브라우저마다
          클리핑이 갈린다. */}
      <AdviceTrigger variant="bar" />
    </>
  );
}
