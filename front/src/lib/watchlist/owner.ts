import { cookies } from "next/headers";

/**
 * 관심종목 소유자 식별자 — 로그인이 붙기 전까지의 임시 신원.
 *
 * ## 왜 쿠키인가
 *
 * 관심종목은 이 프로젝트에서 처음으로 **사용자가 소유하는** 데이터인데 로그인이
 * 아직 없다(`auth.ts` 는 `providers: []`). 그렇다고 저장소를 로그인 뒤로 미루면
 * 화면이 계속 목 데이터로 남는다. 그래서 브라우저마다 서버가 난수 ID를 발급해
 * 그것을 소유자로 쓴다.
 *
 *     지금:   anon:9f3c…   (이 쿠키)
 *     로그인: user:42      (세션의 사용자 ID)
 *
 * 로그인이 붙는 날 할 일은 백엔드 `transfer_owner(anon:…, user:…)` 한 번이다 —
 * 익명으로 모아 둔 관심종목이 그대로 계정에 승계된다.
 *
 * ## httpOnly 인 이유
 *
 * **이것은 인증이 아니라 식별이다.** 남의 키를 알면 그 목록을 볼 수 있다. 그래서
 * 최소한 브라우저 JS 가 읽지 못하게 두고(XSS 로 새어나가는 표면을 줄인다), 값도
 * 브라우저가 아니라 서버가 만든다 — 클라이언트가 만들면 사용자가 아무 값이나
 * 넣어 남의 목록을 조회할 수 있다.
 *
 * `sameSite: "lax"` 는 외부 사이트에서 걸어온 POST 에 이 쿠키가 실려 나가지 않게
 * 한다. 이 서비스의 관심종목 변경은 전부 자기 화면에서 시작한다.
 */

const COOKIE = "ledger.owner";
/** 1년. 익명 신원이 며칠 만에 사라지면 담아 둔 목록도 함께 사라진 것처럼 보인다. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** 익명 소유자임을 드러내는 접두사. 로그인 뒤 `user:` 와 한 컬럼에 섞여 산다. */
const ANON_PREFIX = "anon:";

/**
 * 새 소유자 키. `crypto.randomUUID()` 는 Node·Edge 런타임 모두에 있다.
 *
 * 추측 불가능해야 한다 — 순번이나 타임스탬프로 만들면 남의 키를 세어 볼 수 있다.
 */
export function createOwnerKey(): string {
  return `${ANON_PREFIX}${crypto.randomUUID()}`;
}

export function isOwnerKey(value: string | undefined): value is string {
  return typeof value === "string" && value.startsWith(ANON_PREFIX);
}

export const OWNER_COOKIE = {
  name: COOKIE,
  maxAge: MAX_AGE_SECONDS,
  /** 서버 컴포넌트·라우트 핸들러·proxy 가 같은 옵션으로 굽도록 한 곳에 둔다 */
  options: {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
    // 로컬 개발은 http 라 secure 를 켜면 쿠키가 아예 안 심긴다.
    secure: process.env.NODE_ENV === "production",
  },
} as const;

/**
 * 현재 요청의 소유자 키. **읽기 전용이다.**
 *
 * 서버 컴포넌트에서는 쿠키를 구울 수 없다(Next 제약). 그래서 발급은 `proxy.ts` 가
 * 렌더보다 먼저 하고, 여기서는 그 값을 읽기만 한다. 그래도 없을 수 있는 경우
 * (proxy matcher 밖에서 호출)에는 빈 문자열을 돌려주고 호출부가 빈 목록으로
 * 처리한다 — 임의의 키를 지어내면 그 요청만 남의 것도 내 것도 아닌 목록을 만든다.
 */
export async function readOwnerKey(): Promise<string> {
  const store = await cookies();
  const value = store.get(COOKIE)?.value;
  return isOwnerKey(value) ? value : "";
}
