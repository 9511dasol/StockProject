// Tailwind v3를 쓰는 코드베이스일 때만. v4면 globals.css의 @theme만으로 충분.
import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        surface: { DEFAULT: "var(--surface)", hover: "var(--surface-hover)" },
        ink: { DEFAULT: "var(--ink)", 2: "var(--ink-2)" },
        muted: "var(--muted)",
        line: "var(--line)",
        up: { DEFAULT: "var(--up)", ink: "var(--up-on-ink)" },
        down: { DEFAULT: "var(--down)", ink: "var(--down-on-ink)" },
        accent: "var(--accent)",
      },
      fontFamily: {
        "serif-kr": ["var(--font-noto-serif-kr)", "serif"],
        "sans-kr": ["var(--font-plex-sans-kr)", "sans-serif"],
        mono: ["var(--font-plex-mono)", "monospace"],
        "serif-en": ["var(--font-instrument-serif)", "serif"],
      },
      letterSpacing: { label: "0.16em" },
      borderRadius: { DEFAULT: "0" },
      boxShadow: {
        drawer: "var(--shadow-drawer)",
        modal: "var(--shadow-modal)",
        palette: "var(--shadow-palette)",
        tooltip: "var(--shadow-tooltip)",
      },
      animation: {
        "fade-up": "fadeUp .34s ease both",
        "slide-in": "slideIn .32s cubic-bezier(.2,.8,.2,1)",
        "pop-in": "popIn .28s ease both",
        "sheet-up": "sheetUp .34s cubic-bezier(.2,.8,.2,1)",
        "pulse-wf": "wfpulse 1.2s ease-in-out infinite",
        "dot-spin": "dotSpin .8s linear infinite",
      },
    },
  },
} satisfies Config;
