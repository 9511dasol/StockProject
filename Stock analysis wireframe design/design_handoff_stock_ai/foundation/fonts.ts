// app/fonts.ts — layout.tsx에서 <html className={fontVars}>로 주입
import { Noto_Serif_KR, IBM_Plex_Sans_KR, IBM_Plex_Mono, Instrument_Serif } from "next/font/google";

export const notoSerifKR = Noto_Serif_KR({
  subsets: ["latin"], weight: ["300", "500", "700"],
  variable: "--font-noto-serif-kr", display: "swap",
});

export const plexSansKR = IBM_Plex_Sans_KR({
  subsets: ["latin"], weight: ["300", "400", "500", "600"],
  variable: "--font-plex-sans-kr", display: "swap",
});

export const plexMono = IBM_Plex_Mono({
  subsets: ["latin"], weight: ["400", "500", "600"],
  variable: "--font-plex-mono", display: "swap",
});

export const instrumentSerif = Instrument_Serif({
  subsets: ["latin"], weight: ["400"], style: ["normal", "italic"],
  variable: "--font-instrument-serif", display: "swap",
});

export const fontVars = [
  notoSerifKR.variable, plexSansKR.variable, plexMono.variable, instrumentSerif.variable,
].join(" ");
