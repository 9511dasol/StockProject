/**
 * 서버 전용 환경 설정. 브라우저 번들에 들어가면 안 되므로 NEXT_PUBLIC_ 접두사를
 * 쓰지 않는다 — 백엔드 주소는 BFF 라우트와 서버 컴포넌트만 알면 된다.
 */

function required(name: string, fallback: string): string {
  const value = process.env[name];
  if (!value) return fallback;
  return value.replace(/\/+$/, "");
}

/** FastAPI 베이스 URL. `/api/v1` 까지 포함한다. */
export const API_BASE_URL = required(
  "STOCK_API_BASE_URL",
  "http://localhost:8000/api/v1",
);

/**
 * mock ↔ real 전환 플래그.
 *
 * 목 데이터는 지우지 않는다 — 백엔드 없이 화면을 띄우는 데모·스크린샷·회귀 확인에
 * 계속 쓴다. `USE_MOCK=1` 이면 services 가 features/*\/model/mock.ts 를 돌려준다.
 */
export const USE_MOCK = process.env.USE_MOCK === "1";

/** 일반 조회 타임아웃. yfinance 가 느릴 때 무한정 매달리지 않게 한다. */
export const API_TIMEOUT_MS = Number(process.env.STOCK_API_TIMEOUT_MS ?? 20_000);

/** AI 판단은 종목당 LLM 4회라 별도로 길게 잡는다 (백엔드 기본 300s). */
export const AI_TIMEOUT_MS = Number(process.env.STOCK_AI_TIMEOUT_MS ?? 300_000);

/**
 * AI 판단 엔드포인트를 여는 공유 비밀키 (백엔드 `ADVICE_API_KEY` 와 같은 값).
 *
 * **`NEXT_PUBLIC_` 을 절대 붙이지 않는다.** 붙이는 순간 이 키가 클라이언트 번들에
 * 인라인되어 자물쇠가 무의미해진다 — 브라우저에 있는 키는 키가 아니다. 이 값을
 * 읽는 곳은 `app/api/stocks/advice/route.ts`(BFF) 하나뿐이고, 그 파일은 서버에서만
 * 돈다. 비어 있으면 헤더를 아예 붙이지 않는다(백엔드도 미설정이면 통과시킨다).
 */
export const ADVICE_API_KEY = process.env.ADVICE_API_KEY ?? "";

/** 서버 컴포넌트 fetch 재검증 주기 (README 데이터 페칭 절: 짧게) */
export const REVALIDATE_SECONDS = 60;
