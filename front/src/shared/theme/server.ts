import { cookies } from "next/headers";
import { parseTheme, THEME_COOKIE, type Theme } from "./cookie";

/**
 * 요청에 실려 온 테마. 루트 레이아웃이 `<html data-theme>` 을 그리는 데 쓴다.
 *
 * `cookies()` 는 요청 시점 API 라 이걸 쓰는 라우트는 정적 프리렌더 대상에서 빠진다.
 * 루트 레이아웃에서 부르므로 **모든 라우트가 동적 렌더링**이 된다 — 테마를 첫
 * HTML 에 정확히 담기 위한 대가다. 이 앱은 시세·관심종목처럼 요청마다 달라지는
 * 화면이 대부분이라 손해가 크지 않다.
 */
export async function getServerTheme(): Promise<Theme> {
  const store = await cookies();
  return parseTheme(store.get(THEME_COOKIE)?.value);
}
