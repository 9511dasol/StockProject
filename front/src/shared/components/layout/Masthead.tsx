import { ThemeToggle } from "@/shared/theme";
import { Wordmark } from "./Wordmark";

/**
 * 신문 제호. 종목 상세 · 홈 · 종목 탐색 · 관심종목 · 404 가 같은 마크업을 공유한다.
 *
 * 검색·액션은 슬롯으로 받는다 — 검색 트리거는 features/search,
 * AI 판단 버튼은 features/advice 소유이고 shared/ 는 features/ 를 import 할 수 없다.
 *
 * **3구역이다: 제호 | 검색 | 토글·액션.** 검색을 우측 그룹에 붙여 두면 테마 토글·
 * 관심종목 버튼과 한 덩어리로 읽혀, 이 서비스의 주 진입 수단이 부가 기능처럼 보인다.
 * 가운데로 빼면 폭이 넓어져도 항상 시선 중앙에 남는다.
 *
 * 가운데 칸은 슬롯이 비어도 `flex-1` 로 자리를 차지한다 — 그래야 검색이 없는 화면과
 * 있는 화면에서 제호·토글 위치가 흔들리지 않는다.
 *
 * 모바일 노출 여부는 **호출부가 정한다**(대개 `hidden md:block` 으로 감싼다).
 * 여기서 일괄로 숨기지 않는 이유: 종목 상세의 오류 화면 3종은 하단 탭바가 없어
 * 마스트헤드 검색이 유일한 진입로다.
 *
 * 제호 자체가 홈 링크다 (Wordmark).
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

      {/* min-w-0: 좁은 폭에서 검색 버튼이 제호를 밀어내지 않고 줄어들게 한다 */}
      <div className="flex min-w-0 flex-1 justify-center">{search}</div>

      <div className="flex items-center gap-2.5">
        <ThemeToggle />
        {action}
      </div>
    </header>
  );
}
