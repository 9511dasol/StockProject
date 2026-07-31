import {
  IBM_Plex_Mono,
  IBM_Plex_Sans_KR,
  Instrument_Serif,
  Noto_Serif_KR,
} from "next/font/google";

/**
 * 4개 서체를 CSS 변수로 주입한다. globals.css 의 @theme 이 이 변수를 받아
 * font-serif-kr / font-sans-kr / font-mono / font-serif-en 유틸로 노출한다.
 *
 * subsets 에 "korean" 을 넣을 수 없다 — next/font 메타데이터상 Noto Serif KR 과
 * IBM Plex Sans KR 은 latin / latin-ext 만 선언한다. 한글 글리프는 unicode-range 로
 * 자체 호스팅되어 정상 표시되지만 preload 대상은 아니다. display:swap 으로 덮는다.
 */

export const notoSerifKR = Noto_Serif_KR({
  subsets: ["latin"],
  weight: ["300", "500", "700"],
  variable: "--font-noto-serif-kr",
  display: "swap",
});

export const plexSansKR = IBM_Plex_Sans_KR({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-plex-sans-kr",
  display: "swap",
});

export const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

export const fontVars = [
  notoSerifKR.variable,
  plexSansKR.variable,
  plexMono.variable,
  instrumentSerif.variable,
].join(" ");
