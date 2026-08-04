import { Skeleton, SkeletonScreen } from "@/shared/components/feedback";

/** 종목 탐색 골격. 제호 → 섹션 머리 → 필터 칩 → 목록 행 */
export default function StockBrowseLoading() {
  return (
    <main className="mx-auto w-full max-w-[1180px] px-4 pb-28 pt-[26px] md:px-8 md:pb-[30px]">
      <SkeletonScreen label="종목 목록을 불러오는 중입니다">
        <div className="flex flex-col gap-5">
          <div className="flex items-end justify-between gap-4 border-b-2 border-ink pb-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton w="min(220px, 100%)" h={22} i={0} />
              <Skeleton w="min(300px, 100%)" h={10} i={1} />
            </div>
            <span className="hidden md:block">
              <Skeleton w={380} h={36} i={2} />
            </span>
          </div>

          <div className="flex items-baseline justify-between gap-4 border-b border-line-20 pb-2">
            <Skeleton w={90} h={12} i={0} />
            <Skeleton w={130} h={10} i={1} />
          </div>

          {/* 필터 칩 두 묶음 */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((chip) => (
                <Skeleton key={chip} w={64} h={34} i={chip} />
              ))}
            </div>
            <div className="flex gap-1.5">
              {[0, 1].map((chip) => (
                <Skeleton key={chip} w={82} h={34} i={chip} />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((row) => (
              <Skeleton key={row} w="100%" h={44} i={row} />
            ))}
          </div>
        </div>
      </SkeletonScreen>
    </main>
  );
}
