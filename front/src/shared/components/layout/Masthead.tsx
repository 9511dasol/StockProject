import { ThemeToggle } from "@/shared/theme";
import { Wordmark } from "./Wordmark";

/**
 * 신문 제호. 2a 종목 상세 · 3a 검색 · 3b 홈 · 4b 관심종목이 같은 마크업을 공유한다.
 *
 * 우측 검색·액션은 슬롯으로 받는다 — 검색 트리거는 features/search,
 * AI 판단 버튼은 features/advice 소유이고 shared/ 는 features/ 를 import 할 수 없다.
 *
 * 제호 자체가 홈 링크다 (Wordmark). 모바일에서는 제호가 줄고 우측 슬롯이 대부분
 * 숨으므로 `items-end` 를 유지해도 두 줄로 무너지지 않는다.
 */
export function Masthead({
  caption,
  search,
  action,
}: {
  caption: string;
  search?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex items-end justify-between gap-3 border-b-2 border-ink pb-3 md:gap-6">
      <Wordmark caption={caption} />

      <div className="flex items-center gap-2.5">
        {search}
        <ThemeToggle />
        {action}
      </div>
    </header>
  );
}
