import { handlers } from "@/auth";

/**
 * NextAuth 라우트 핸들러. 구성은 src/auth.ts 한 곳에만 둔다.
 * providers 가 비어 있는 동안에도 이 엔드포인트는 살아 있고
 * `/api/auth/session` 은 빈 세션(null)을 돌려준다.
 */
export const { GET, POST } = handlers;
