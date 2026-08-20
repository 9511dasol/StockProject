import type { Metadata } from "next";
import { SearchProvider } from "@/features/search";
import { SessionProvider } from "@/shared/auth/SessionProvider";
import { Footer } from "@/shared/components/layout/Footer";
import { QueryProvider } from "@/shared/query";
import { ThemeProvider } from "@/shared/theme";
import { getServerTheme } from "@/shared/theme/server";
import { fontVars } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "종목 원장 · The Stock Ledger",
  description: "KRX·해외 종목의 주가·뉴스·리포트와 멀티 에이전트 AI 판단",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 쿠키에서 테마를 읽어 첫 HTML 에 그대로 담는다. 인라인 스크립트로 하이드레이션
  // 전에 DOM 을 고치던 방식과 달리 서버·클라이언트가 처음부터 같은 값을 본다 —
  // 깜빡임도, 하이드레이션 불일치도 없어 suppressHydrationWarning 이 필요 없다.
  const theme = await getServerTheme();

  return (
    <html
      lang="ko"
      className={`${fontVars} h-full`}
      data-theme={theme === "terminal" ? "terminal" : undefined}
    >
      <body className="flex min-h-full flex-col">
        {/* 순서: 세션 → 쿼리 캐시 → 테마 → 전역 검색.
            검색 팔레트가 쿼리 캐시를 쓰므로 QueryProvider 안쪽에 있어야 한다. */}
        <SessionProvider>
          <QueryProvider>
            <ThemeProvider initialTheme={theme}>
              <SearchProvider>{children}</SearchProvider>
            </ThemeProvider>
          </QueryProvider>
        </SessionProvider>

        {/* 데이터 출처·시세 지연·투자 판단 면책 — 모든 화면 공통, 본문 다음에 한 번.
            `body` 가 flex-col 이라 `mt-auto` 로 짧은 화면에서도 바닥에 붙는다. */}
        <Footer />
      </body>
    </html>
  );
}
