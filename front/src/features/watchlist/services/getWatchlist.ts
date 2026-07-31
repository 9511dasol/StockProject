import { MOCK_WATCHLIST } from "../model/mock";
import type { Watchlist } from "../model/types";

/**
 * 관심종목 한 벌. 서버에서만 실행된다.
 *
 * TODO(백엔드 연결): 대응 엔드포인트가 하나도 없다. 시세(yfinance)와 달리
 * 그룹·순서·보유·평단·알림 조건은 사용자 소유 데이터라 저장소가 새로 필요하다.
 *   GET    /watchlist                  목록 (그룹·순서 포함)
 *   PATCH  /watchlist/order            순서 변경
 *   PATCH  /watchlist/{code}/alert     알림 조건
 *   DELETE /watchlist/{code}
 * 순서 변경은 낙관적 업데이트 후 PATCH 를 보내고, 실패 시 되돌린다.
 *
 * 검색 팔레트의 ⇥(관심 추가)는 지금 localStorage(store/watchlist)에만 쌓인다.
 * 저장소가 생기면 두 경로를 하나로 합친다.
 */
export async function getWatchlist(): Promise<Watchlist> {
  return MOCK_WATCHLIST;
}
