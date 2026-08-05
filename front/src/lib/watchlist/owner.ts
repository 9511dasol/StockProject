import { cookies } from "next/headers";
import { auth } from "@/auth";
import { isOwnerKey, OWNER_COOKIE, userOwnerKey } from "./anon-cookie";

/**
 * 이 요청이 볼 관심종목의 주인을 정한다.
 *
 * 쿠키를 만들고 알아보는 원시 부분은 `anon-cookie.ts` 에 있다 — 그 파일은 NextAuth 를
 * import 하지 않아 Edge 런타임(`proxy.ts`)에서도 쓸 수 있다. 여기는 **세션을 보는
 * 쪽**이라 Node 런타임 전용이다.
 */

export { createOwnerKey, isOwnerKey, OWNER_COOKIE, userOwnerKey } from "./anon-cookie";

/**
 * 현재 요청의 익명 소유자 키. **읽기 전용이다.**
 *
 * 서버 컴포넌트에서는 쿠키를 구울 수 없다(Next 제약). 그래서 발급은 `proxy.ts` 가
 * 렌더보다 먼저 하고, 여기서는 그 값을 읽기만 한다. 그래도 없을 수 있는 경우
 * (proxy matcher 밖에서 호출)에는 빈 문자열을 돌려주고 호출부가 빈 목록으로
 * 처리한다 — 임의의 키를 지어내면 그 요청만 남의 것도 내 것도 아닌 목록을 만든다.
 */
export async function readAnonOwnerKey(): Promise<string> {
  const store = await cookies();
  const value = store.get(OWNER_COOKIE.name)?.value;
  return isOwnerKey(value) ? value : "";
}

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
 */
export async function readOwnerKey(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (userId) return userOwnerKey(userId);

  return readAnonOwnerKey();
}
