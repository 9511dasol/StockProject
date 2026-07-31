import { Skeleton, SkeletonScreen } from "@/shared/components/feedback";

/** 3b 홈 골격. 지수 4카드 → 브리핑 → 등락 상위 2열 → 우측 레일 */
export default function MarketHomeLoading() {
  return (
    <main className="mx-auto w-full max-w-[1180px] px-4 pb-28 pt-[26px] md:px-8 md:pb-[30px]">
      <SkeletonScreen label="시장 현황을 불러오는 중입니다">
        <div className="flex flex-col gap-[22px]">
          <div className="flex items-end justify-between gap-4 border-b-2 border-ink pb-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton w="min(220px, 100%)" h={22} i={0} />
              <Skeleton w="min(300px, 100%)" h={10} i={1} />
            </div>
            {/* 우측 검색·액션 자리는 모바일에서 숨는다 (실제 화면과 동일) */}
            <span className="hidden md:block">
              <Skeleton w={380} h={36} i={2} />
            </span>
          </div>

          <div className="grid grid-cols-2 gap-px bg-line-16 md:grid-cols-4">
            {[0, 1, 2, 3].map((card) => (
              <div
                key={card}
                className="flex flex-col gap-2.5 bg-paper px-[18px] pb-3 pt-4"
              >
                <Skeleton w={90} h={12} i={0} />
                <Skeleton w={140} h={26} i={1} />
                <Skeleton w={110} h={12} i={2} />
                <Skeleton w="100%" h={58} i={card} />
              </div>
            ))}
          </div>

          <div className="grid items-start gap-[26px] xl:grid-cols-[1fr_328px]">
            <div className="flex flex-col gap-[22px]">
              <Skeleton w="100%" h={190} i={0} />
              <div className="grid gap-[26px] md:grid-cols-2">
                {[0, 1].map((column) => (
                  <div key={column} className="flex flex-col gap-2.5">
                    <Skeleton w={180} h={14} i={0} />
                    {[0, 1, 2, 3, 4].map((row) => (
                      <Skeleton key={row} w="100%" h={40} i={row} />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-5">
              <Skeleton w="100%" h={190} i={0} />
              <Skeleton w="100%" h={200} i={1} />
              <Skeleton w="100%" h={40} i={2} />
            </div>
          </div>
        </div>
      </SkeletonScreen>
    </main>
  );
}
