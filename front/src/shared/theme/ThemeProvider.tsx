"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { writeThemeCookie, type Theme } from "./cookie";

/**
 * 에디토리얼 라이트(기본) ↔ 다크 터미널 전환.
 *
 * OS 의 prefers-color-scheme 을 따르지 않는다 — 두 테마는 밝기 차이가 아니라
 * 서로 다른 디자인 언어(신문 지면 vs 트레이딩 콘솔)라서, 사용자가 고르는 값이다.
 *
 * 초기값을 **서버가 쿠키에서 읽어 prop 으로 내려준다.** 그래서 서버 HTML 과
 * 클라이언트의 첫 렌더가 처음부터 일치하고, 하이드레이션 불일치도 깜빡임도 없다.
 * (예전에는 localStorage + 인라인 스크립트라 둘 다 있었다.)
 */

interface ThemeContextValue {
  theme: Theme;
  isTerminal: boolean;
  setTheme: (next: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: Theme;
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    // CSS 가 실제로 보는 것은 이 속성이다. 다음 요청부터는 서버가 쿠키를 읽어
    // 같은 값을 처음부터 렌더하므로, 여기서 쓰는 건 '이번 화면'을 위한 것이다.
    if (next === "terminal") {
      document.documentElement.dataset.theme = "terminal";
    } else {
      delete document.documentElement.dataset.theme;
    }
    writeThemeCookie(next);
  }, []);

  const toggle = useCallback(
    () => setTheme(theme === "terminal" ? "editorial" : "terminal"),
    [theme, setTheme],
  );

  return (
    <ThemeContext.Provider
      value={{ theme, isTerminal: theme === "terminal", setTheme, toggle }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return context;
}
