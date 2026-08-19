import { Skeleton, SkeletonScreen } from "@/shared/components/feedback";
import { DetailSkeleton } from "./DetailSkeleton";

/**
 * 대시보드 골격 — nav 조회가 끝나기 전. 레이아웃의 `Suspense` 가 쓴다.
 *
 * 제호는 이미 떠 있다(레이아웃이 직접 그린다). 여기서는 그 아래만 세운다.
 */
export function BoardSkeleton() {
  return (
    <SkeletonScreen label="관심 종목을 불러오는 중입니다">
      <div className="flex flex-col gap-5">
        <div className="flex items-end justify-between gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton w="min(180px, 100%)" h={19} i={0} />
            <Skeleton w="min(260px, 100%)" h={10} i={1} />
          </div>
          <Skeleton w={150} h={32} i={2} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {[0, 1, 2, 3, 4].map((chip) => (
              <Skeleton key={chip} w={72} h={31} i={chip} />
            ))}
          </div>
          <Skeleton w="min(220px, 100%)" h={14} i={0} />
        </div>

        {/* 데스크탑 2열 — 좁은 nav + 상세 */}
        <div className="hidden gap-6 md:grid md:grid-cols-[340px_1fr] md:items-start">
          <div className="flex flex-col">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((row) => (
              <div
                key={row}
                className="flex gap-1.5 border-b border-dotted border-line-22 px-1.5 py-2"
              >
                <Skeleton w={13} h={13} i={row} className="mt-1" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-baseline gap-2">
                    <Skeleton w="60%" h={15} i={row} />
                    <Skeleton w={54} h={12} i={row + 1} className="ml-auto" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton w="45%" h={9} i={row + 1} />
                    <Skeleton w={52} h={16} i={row + 2} className="ml-auto" />
                    <Skeleton w={40} h={11} i={row} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <DetailSkeleton />
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
  );
}
