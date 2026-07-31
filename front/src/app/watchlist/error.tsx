"use client";

import { useEffect } from "react";
import { ErrorScreen } from "@/shared/components/feedback";

export default function WatchlistError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-[1180px] px-4 pb-[30px] pt-[26px] md:px-8">
      <ErrorScreen
        scope="watchlist"
        title="관심 종목을 불러오지 못했습니다"
        description="목록·보유·알림 조건을 읽는 중 문제가 발생했습니다. 저장된 설정은 지워지지 않았습니다."
        digest={error.digest}
        onRetry={reset}
      />
    </main>
  );
}
