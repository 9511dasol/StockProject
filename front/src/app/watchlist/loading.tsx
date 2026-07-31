import { Skeleton, SkeletonScreen } from "@/shared/components/feedback";
// feature 내부 파일이 아니라 공개 경계로 가져온다 (CONVENTIONS 4번 원칙)
import { WATCH_GRID } from "@/features/watchlist";

/** 4b 표 골격. 컬럼 폭이 같아 로드 후 표가 흔들리지 않는다. */
export default function WatchlistLoading() {
  return (
    <main className="mx-auto w-full max-w-[1180px] px-4 pb-40 pt-[26px] md:px-8 md:pb-[30px]">
      <SkeletonScreen label="관심 종목을 불러오는 중입니다">
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

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {[0, 1, 2, 3, 4].map((chip) => (
                <Skeleton key={chip} w={72} h={31} i={chip} />
              ))}
            </div>
            <Skeleton w="min(220px, 100%)" h={14} i={0} />
          </div>

          {/* 데스크탑 8열 표 골격 */}
          <div className="hidden flex-col gap-5 md:flex">
            <div className="border-y border-line-20 py-[9px]">
              <Skeleton w="100%" h={10} i={0} />
            </div>

            {[0, 1, 2, 3, 4, 5].map((row) => (
              <div
                key={row}
                className={`${WATCH_GRID} border-b border-dotted border-line-22 pb-3`}
              >
                <Skeleton w={13} h={13} i={row} />
                <div className="flex flex-col gap-[3px] pr-4">
                  <Skeleton w="70%" h={17} i={row} />
                  <Skeleton w="50%" h={10} i={row + 1} />
                </div>
                <Skeleton w="80%" h={14} i={row} className="ml-auto" />
                <Skeleton w="60%" h={13} i={row + 1} className="ml-auto" />
                <Skeleton w={104} h={28} i={row + 2} className="mx-auto" />
                <div className="flex flex-col items-end gap-0.5">
                  <Skeleton w="80%" h={12} i={row} />
                  <Skeleton w="50%" h={12} i={row + 1} />
                </div>
                <div className="flex items-center gap-[9px] pl-[18px]">
                  <Skeleton w={26} h={15} i={row} />
                  <Skeleton w="60%" h={11} i={row + 1} />
                </div>
                <Skeleton w="70%" h={12} i={row} className="ml-auto" />
              </div>
            ))}
          </div>

          {/* 모바일 2단 카드 골격 — WatchCard 와 같은 형태여야 자리가 안 튄다 */}
          <div className="flex flex-col md:hidden">
            {[0, 1, 2, 3, 4, 5].map((row) => (
              <div
                key={row}
                className="flex gap-2.5 border-b border-dotted border-line-22 py-3"
              >
                <Skeleton w={13} h={13} i={row} />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-start gap-2.5">
                    <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                      <Skeleton w="70%" h={17} i={row} />
                      <Skeleton w="45%" h={10} i={row + 1} />
                    </div>
                    <Skeleton w={72} h={28} i={row + 2} />
                    <div className="flex flex-col items-end gap-0.5">
                      <Skeleton w={54} h={14} i={row} />
                      <Skeleton w={40} h={12} i={row + 1} />
                    </div>
                  </div>
                  <Skeleton w="85%" h={14} i={row + 2} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </SkeletonScreen>
    </main>
  );
}
