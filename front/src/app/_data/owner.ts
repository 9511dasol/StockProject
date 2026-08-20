import { currentUser } from "@/auth";
import { readAnonOwnerKey, userOwnerKey } from "@/lib/watchlist/owner";

/**
 * 이 요청이 볼 관심종목의 주인.
 *
 * **로그인했으면 계정, 아니면 브라우저.** 이 함수 하나가 그 규칙의 유일한 출처라
 * 화면·BFF 어디서도 "로그인했나" 를 다시 판단하지 않는다. 백엔드는 둘을 구분조차
 * 하지 않는다 — `owner_key` 가 불투명한 문자열이기 때문이다(9회차 설계).
 *
 * 로그인 상태에서 익명 쿠키는 그대로 남겨 둔다. 지우면 로그아웃했을 때 예전 목록을
 * 볼 수 없는데, 승계는 **이동**이라 그때 익명 쪽은 이미 비어 있다 — 쿠키만 남고
 * 목록은 계정에 있는 상태가 맞다.
 *
 * ## 왜 `lib/` 이 아니라 여기인가
 *
 * 쿠키를 읽는 부분(`readAnonOwnerKey`)과 키 모양(`userOwnerKey`)은 `lib/` 에 있다.
 * 여기가 하는 일은 **세션과 그 둘을 엮는 것**이고, 그러려면 NextAuth 를 알아야 한다.
 * `lib/` 이 그것을 알면 "프레임워크 무관 어댑터" 계약이 깨지고 단위 테스트도
 * NextAuth 를 띄워야 한다 (CONVENTIONS '예외적으로 허용되는 배치').
 */
export async function readOwnerKey(): Promise<string> {
  // 맨 `auth()` 가 아니라 `currentUser()` 다 — 그쪽은 React `cache` 로 묶여 있어
  // 한 요청 안에서 세션을 한 번만 푼다. 이 함수는 한 렌더에서 여러 번 불리고
  // (레이아웃·페이지·BFF 라우트), 세션 전략이 `database` 면 호출마다 Supabase
  // 조회가 하나씩 붙는다.
  const user = await currentUser();
  if (user?.id) return userOwnerKey(user.id);

  return readAnonOwnerKey();
}
