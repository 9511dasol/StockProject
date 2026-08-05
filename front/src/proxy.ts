import { NextResponse, type NextRequest } from "next/server";
import { createOwnerKey, isOwnerKey, OWNER_COOKIE } from "@/lib/watchlist/owner";

/**
 * 관심종목 소유자 쿠키를 발급한다.
 *
 * **Next 16 에서는 `middleware.ts` 가 아니라 `proxy.ts` 다.** 파일 규약이 바뀌었고
 * (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`),
 * 예전 이름으로 두면 파일이 조용히 무시되어 쿠키가 영영 안 심긴다 — 관심종목이
 * 항상 비어 보이는데 오류는 없는 상태가 된다.
 *
 * ## 왜 여기서 굽나
 *
 * 서버 컴포넌트는 쿠키를 **읽을 수만** 있다(Next 제약). 관심종목 화면은 서버
 * 컴포넌트라 첫 렌더에 이미 소유자가 정해져 있어야 하고, 그 일을 할 수 있는 곳은
 * 렌더보다 먼저 도는 여기뿐이다. 라우트 핸들러에서 구우면 "첫 방문에는 목록이 비고
 * 뭔가를 눌러야 신원이 생기는" 이상한 순서가 된다.
 *
 * ## 왜 응답에도 요청에도 심나
 *
 * 새로 발급한 값은 브라우저에 아직 없다. 응답에만 심으면 **이번 요청의 렌더는**
 * 여전히 쿠키를 못 읽어 첫 화면이 빈 목록이 된다. 요청 헤더에도 얹어 이번 렌더부터
 * 같은 신원을 보게 한다.
 */
export function proxy(request: NextRequest) {
  const existing = request.cookies.get(OWNER_COOKIE.name)?.value;
  if (isOwnerKey(existing)) return NextResponse.next();

  const owner = createOwnerKey();

  // 요청 쿠키를 먼저 고친 뒤 그 헤더를 상류로 넘긴다. 문서가 명시한 형태는
  // `NextResponse.next({ request: { headers } })` 이고, `{ headers }` (request 없이)
  // 는 **클라이언트용 응답 헤더**라 이번 렌더에는 닿지 않는다.
  request.cookies.set(OWNER_COOKIE.name, owner);
  const response = NextResponse.next({
    request: { headers: new Headers(request.headers) },
  });

  // 브라우저가 다음 요청부터 같은 신원을 보내도록 응답에도 굽는다.
  response.cookies.set(OWNER_COOKIE.name, owner, OWNER_COOKIE.options);
  return response;
}

/**
 * 정적 자산·이미지에는 돌지 않는다. 쿠키가 필요한 것은 화면과 BFF 라우트뿐이고,
 * proxy 는 매 요청 도는 코드라 범위를 좁힐수록 좋다.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
