import { NextResponse, type NextRequest } from "next/server";
import { createOwnerKey, isOwnerKey, OWNER_COOKIE } from "@/lib/watchlist/anon-cookie";

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
/**
 * NextAuth v5 의 세션 쿠키 이름. https 에서는 `__Secure-` 접두가 붙는다.
 * 둘 다 봐야 하는 이유: 개발은 http, 배포는 https 라 한쪽만 보면 한쪽에서 안 먹는다.
 */
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

/**
 * 관리자 경로에 **세션 쿠키조차 없는 요청**을 렌더 전에 끊는다.
 *
 * ## 이건 인가가 아니다 — 인가는 `lib/auth/admin.requireAdmin()` 이 한다
 *
 * 여기는 Edge 런타임이라 DB 를 못 본다. 세션 전략이 `database` 이므로 쿠키 값이
 * 유효한지, 그 사람이 관리자인지 **여기서는 알 수 없다.** 알 수 있는 것은 "쿠키가
 * 아예 없다 = 로그인한 적이 없다" 하나뿐이고, 그 경우만 거른다.
 *
 * ## 그런데도 두는 이유 둘
 *
 * 1. **진짜 404 를 준다.** 페이지의 `notFound()` 는 내용을 막지만 상태 코드는
 *    200 이다 — 루트 `loading.tsx` 가 만든 Suspense 경계 때문에 헤더가 먼저
 *    나가기 때문이다(실측). 익명 요청은 대부분 스캐너이고, 그쪽에 200 을 주면
 *    "여기 뭔가 있다" 는 신호가 된다.
 * 2. **렌더를 아낀다.** 로그인도 안 한 요청에 세션 조회와 서버 컴포넌트 렌더를
 *    태울 이유가 없다.
 *
 * 로그인했지만 관리자가 아닌 사람은 여기를 그대로 지나가고, 페이지의
 * `requireAdmin()` 이 404 로 끊는다. **그 층이 없으면 안 된다** — 쿠키만 있으면
 * 통과하는 이 검사를 인가로 착각하는 순간 아무나 관리자 화면을 보게 된다.
 */
function blockAnonymousAdmin(request: NextRequest): NextResponse | null {
  if (!request.nextUrl.pathname.startsWith("/admin")) return null;

  const signedIn = SESSION_COOKIES.some((name) => request.cookies.get(name)?.value);
  if (signedIn) return null;

  // 403 이 아니라 404 다. 403 은 "여기 뭔가 있는데 권한이 부족하다" 를 알려 준다 —
  // 관리자 화면은 존재 자체를 광고할 이유가 없다 (`requireAdmin` 과 같은 판단).
  return new NextResponse(null, { status: 404 });
}

export function proxy(request: NextRequest) {
  const blocked = blockAnonymousAdmin(request);
  if (blocked) return blocked;

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
