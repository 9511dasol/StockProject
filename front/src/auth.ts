import NextAuth from "next-auth";

/**
 * NextAuth v5 (Auth.js) 구성.
 *
 * **로그인은 아직 켜지 않았다.** `providers` 가 비어 있으므로 지금은 어떤 방법으로도
 * 로그인할 수 없고, `auth()` 는 항상 `null` 을 돌려준다. 화면·API 동작에 영향이 없다.
 * v4 가 아니라 v5(beta)를 쓰는 이유는 v4 가 Next 16 App Router 를 지원하지 않아서다.
 *
 * 나중에 켤 때 할 일:
 *   1. providers 에 Credentials / OAuth 를 추가한다
 *      (백엔드에 이미 bcrypt·pyjwt 의존성이 있으므로 Credentials → FastAPI 검증이 자연스럽다)
 *   2. .env 에 AUTH_SECRET 을 넣는다 (`npx auth secret` 으로 생성)
 *   3. 보호가 필요한 라우트에서 `const session = await auth()` 로 확인한다
 *
 * 세션 전략은 JWT 다 — 사용자 테이블이 프런트가 아니라 FastAPI 쪽에 생길 예정이라
 * 어댑터(DB 세션)를 붙이면 저장소가 두 곳으로 갈라진다.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [],
  session: { strategy: "jwt" },
  pages: {
    // 로그인 화면을 만들 때 이 경로에 놓는다. 지금은 라우트가 없어도
    // providers 가 비어 있어 리다이렉트가 일어나지 않는다.
    signIn: "/login",
  },
  callbacks: {
    /**
     * 미들웨어에서 쓸 접근 판단. 지금은 모든 경로를 공개로 둔다 —
     * 로그인을 켤 때 관심종목처럼 사용자별 데이터가 있는 화면만 잠근다.
     */
    authorized: () => true,
  },
});
