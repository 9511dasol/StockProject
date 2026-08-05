import { ThemeToggle } from "@/shared/theme";
import { Wordmark } from "./Wordmark";

export interface MastheadProps {
  /** 제호 밑 한 줄 (기준 시각 · 시세 지연 고지 등) */
  caption: string;
  /** 검색 트리거 슬롯. features/search 소유라 호출부가 넣는다 */
  search?: React.ReactNode;
  /** 화면별 주요 이동 (관심 종목 · 시장 현황 …) */
  action?: React.ReactNode;
}

/**
 * 신문 제호. 종목 상세 · 홈 · 종목 탐색 · 관심종목 · 404 가 같은 마크업을 공유한다.
 *
 * 검색·액션은 슬롯으로 받는다 — 검색 트리거는 features/search,
 * AI 판단 버튼은 features/advice 소유이고 shared/ 는 features/ 를 import 할 수 없다.
 *
 * **2구역이다: 제호 | 우측 컨트롤 덩어리(검색·토글·액션).**
 *
 * 원래는 3구역이었고 검색이 가운데 칸(`flex-1 justify-center`)에 있었다. 의도는
 * "주 진입 수단을 부가 기능처럼 보이지 않게" 였는데 실제로는 반대로 작동했다:
 * 넓은 화면에서 검색 상자가 제호와도 토글과도 붙지 않은 채 양쪽에 빈 공간을 끼고
 * 혼자 떠 있었다. 이 검색은 ⌘K 로 어디서나 열리는 **전역 팔레트**이지 특정 화면의
 * 도구가 아니라, 같은 성격의 전역 컨트롤(테마 토글·화면 이동)과 한 덩어리로 묶는
 * 편이 정확하다. 2b 콘솔 상단 바(ConsoleView)가 이미 그렇게 하고 있다.
 *
 * 본문으로 내리는 안도 검토했다가 접었다. 필터·정렬 옆에 두면 "타이핑하면 표가
 * 걸러진다" 는 잘못된 기대를 만드는데, 실제로는 팔레트가 열려 다른 종목으로 **이동**한다.
 *
 * 예외는 홈뿐이다 — 홈은 검색이 화면의 주 동사라 본문 첫 블록에서 히어로로 받고
 * (FindBand) 이 슬롯을 비운다. 같은 동작을 한 화면에 두 번 두지 않기 위함이다.
 *
 * 모바일 노출 여부는 **호출부가 정한다**(대개 `hidden md:block` 으로 감싼다).
 * 여기서 일괄로 숨기지 않는 이유: 종목 상세의 오류 화면 3종은 하단 탭바가 없어
 * 마스트헤드 검색이 유일한 진입로다.
 *
 * 제호 자체가 홈 링크다 (Wordmark).
 */
export function Masthead({ caption, search, action }: MastheadProps) {
  return (
    <header className="flex items-end justify-between gap-3 border-b-2 border-ink pb-3 md:gap-6">
      <Wordmark caption={caption} />

      {/* min-w-0: 768px 처럼 빠듯한 폭에서 이 덩어리가 제호를 밀어내는 대신
          검색 필드가 줄어들게 한다 (SearchTrigger "field" 가 truncate 를 들고 있다) */}
      <div className="flex min-w-0 items-center gap-2.5">
        {search}
        <ThemeToggle />
        {action}
      </div>
    </header>
  );
}
