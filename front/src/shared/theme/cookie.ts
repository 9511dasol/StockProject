/**
 * 테마 저장 위치. 서버와 클라이언트가 같은 규칙을 봐야 하므로 여기 한 곳에 둔다.
 *
 * localStorage 가 아니라 쿠키인 이유: 서버가 첫 HTML 을 그릴 때 테마를 알아야
 * `<html data-theme>` 을 처음부터 올바르게 렌더할 수 있다. localStorage 는 서버가
 * 읽을 수 없어 인라인 스크립트로 하이드레이션 전에 DOM 을 고쳐야 했고, 그 결과
 * 서버 HTML 과 클라이언트 DOM 이 반드시 어긋나 하이드레이션 경고가 났다.
 */

export type Theme = "editorial" | "terminal";

export const THEME_COOKIE = "ledger.theme";

/** 1년. 테마는 사용자가 명시적으로 고른 값이라 오래 기억한다. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function parseTheme(value: string | undefined | null): Theme {
  return value === "terminal" ? "terminal" : "editorial";
}

/**
 * 브라우저에서 쿠키를 쓴다.
 *
 * HttpOnly 가 아니다 — 테마 토글이 클라이언트에서 일어나므로 JS 가 써야 한다.
 * 민감 정보가 아니고, 서버는 이 값을 표시용으로만 쓴다.
 * SameSite=Lax 로 두어 외부 사이트발 요청에는 실려 가지 않는다.
 */
export function writeThemeCookie(theme: Theme): void {
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;
}
