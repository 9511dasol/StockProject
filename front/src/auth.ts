import PostgresAdapter from "@auth/pg-adapter";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
import { authPool } from "@/lib/auth/pool";

/**
 * NextAuth v5 (Auth.js) 구성.
 *
 * v4 가 아니라 v5(beta)를 쓰는 이유는 v4 가 Next 16 App Router 를 지원하지 않아서다.
 *
 * ## 프로바이더는 **환경 변수가 있을 때만** 켜진다
 *
 * 자격 증명이 없는 채로 프로바이더를 등록하면 로그인 버튼이 보이는데 누르면 깨진다.
 * 그보다는 **아예 없는 편**이 정직하다 — 로그인이 꺼져 있어도 관심종목은 익명 신원
 * (`anon:` 쿠키)으로 그대로 동작하므로 화면이 죽지 않는다.
 *
 * 키가 생기면 `.env.local` 에 넣기만 하면 된다. 코드는 안 고친다.
 *
 * ## 세션 전략을 JWT 가 아니라 DB 로 바꾼 이유
 *
 * 예전 주석은 "사용자 테이블이 FastAPI 쪽에 생길 예정" 이라 JWT 를 골랐다고 적어
 * 두었다. 그 판단이 바뀐 것은 **매직링크** 때문이다 — 검증 토큰은 어딘가에 저장해야
 * 하고(1회용·만료), NextAuth 는 그걸 어댑터로 요구한다. 토큰 발급·만료·재사용 방지를
 * 직접 짜는 것보다 검증된 구현을 쓰는 편이 낫다.
 *
 * "저장소가 두 곳으로 갈라진다" 는 그때의 우려는 **같은 Supabase 를 쓰면서 해소됐다.**
 * 스키마는 alembic 이 만들고(`b3f1c2d47a90`), 자동 생성이 그 테이블을 지우려 들지
 * 않도록 `alembic/env.py` 가 막는다.
 *
 * ## 관심종목과의 접점
 *
 * 로그인하면 소유자가 `anon:<uuid>` → `user:<uuid>` 로 바뀐다. 익명으로 모아 둔
 * 목록은 로그인 뒤 한 번 승계된다 (`lib/watchlist/owner.ts`).
 */

const googleId = process.env.AUTH_GOOGLE_ID;
const googleSecret = process.env.AUTH_GOOGLE_SECRET;
const mailServer = process.env.EMAIL_SERVER;
const mailFrom = process.env.EMAIL_FROM;

/** 로그인 수단이 하나라도 설정돼 있는가. UI 가 로그인 버튼을 그릴지 정한다. */
export const AUTH_ENABLED = Boolean(
  (googleId && googleSecret) || (mailServer && mailFrom),
);

const providers: NextAuthConfig["providers"] = [];

if (googleId && googleSecret) {
  providers.push(Google({ clientId: googleId, clientSecret: googleSecret }));
}

if (mailServer && mailFrom) {
  // 매직링크. `EMAIL_SERVER` 는 SMTP URL 이다
  // (예: smtp://resend:<API_KEY>@smtp.resend.com:587).
  providers.push(Nodemailer({ server: mailServer, from: mailFrom }));
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  // 어댑터는 프로바이더가 하나라도 있을 때만 붙인다. 로그인이 꺼진 상태에서
  // 커넥션 풀을 만들면 쓰지도 않을 Supabase 연결을 잡는다.
  adapter: AUTH_ENABLED ? PostgresAdapter(authPool()) : undefined,
  providers,
  // 어댑터가 있으면 DB 세션이 기본이고, 매직링크가 요구하는 형태이기도 하다.
  session: { strategy: AUTH_ENABLED ? "database" : "jwt" },
  pages: {
    signIn: "/login",
    /**
     * 실패도 **우리 화면**에서 받는다.
     *
     * 기본값은 Auth.js 가 들고 있는 `/api/auth/error` 인데, 그 화면은 검은 배경에
     * "Server error — There is a problem with the server configuration." 만 띄운다.
     * 제호도 없고 돌아갈 링크도 없어서 사용자는 사이트를 벗어난 것처럼 느낀다.
     *
     * **가장 흔한 도착 경로가 '취소' 라서 더 나쁘다.** 구글 OAuth 를 취소하면
     * `error=access_denied` 로 돌아오는데, 구글의 discovery 가
     * `authorization_response_iss_parameter_supported: true` 를 광고하므로 Auth.js 는
     * 응답에 `iss` 를 요구한다. 그런데 구글은 **성공 응답에만** `iss` 를 싣는다.
     * 그래서 취소는 "access_denied" 로 도착하지 못하고 `iss` 검증에서 먼저 터지며,
     * 그 실패가 `CallbackRouteError` → 에러 페이지의 `error=Configuration` 이 된다.
     *
     * 즉 **취소가 서버 설정 오류처럼 보인다.** 로그인만 취소했을 뿐인 사람에게
     * 그 화면을 보여줄 이유가 없다. `/login` 으로 돌려보내면 그 자리에서 다시
     * 시도할 수 있고, 무슨 일이 있었는지도 화면이 말한다 (`app/login/page.tsx`).
     */
    error: "/login",
  },
  callbacks: {
    /**
     * 세션에 사용자 ID 와 권한을 실어 준다.
     *
     * 관심종목 소유자 키(`user:<id>`)가 `id` 에서 나온다 — 없으면 로그인해도 익명
     * 목록을 계속 보게 된다. DB 세션 전략에서는 `user` 인자에 들어 있다.
     *
     * `role` 은 우리가 `users` 에 더한 컬럼이다(`c9b3e7d21a08`). 어댑터가
     * `select * from users` 로 읽으므로(실측) 별도 조회 없이 여기 실려 온다 —
     * 관리자 판단 때문에 매 요청 DB 를 한 번 더 치지 않아도 되는 이유다.
     *
     * **기본값이 `"user"` 인 것이 중요하다.** 컬럼이 없는 환경(마이그레이션 전)에서
     * `undefined` 가 그대로 흐르면, 그 값을 비교하는 쪽이 실수 한 번으로 통과시킬
     * 여지가 생긴다. 모르면 권한 없음이다.
     */
    session({ session, user }) {
      if (user?.id) session.user.id = user.id;
      session.user.role = (user as { role?: string })?.role === "admin" ? "admin" : "user";
      return session;
    },
    /** 지금은 모든 경로가 공개다. 관심종목도 익명으로 쓸 수 있어야 한다. */
    authorized: () => true,
  },
});
