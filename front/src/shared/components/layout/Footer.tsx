import { QUOTE_DELAY_NOTE } from "@/lib/config/marketHours";

/**
 * 전역 푸터 — 데이터 출처·시세 지연·투자 판단 면책을 모든 화면에 상시 노출한다.
 *
 * 예전에는 이 셋이 **실패할 때만** 보였다 — "yfinance 응답이 늦습니다" 는 에러
 * 화면(`app/error.tsx` 등)에만 있고 성공한 화면에는 출처가 어디에도 없었다.
 * 투자 판단 면책도 AI 드로어를 연 사람만 봤다(`FinalDecision.tsx`) — 관심종목
 * 표의 AI 판정(`VerdictCell`)이나 종목 상세의 애널리스트 요약(`ReportDigest`)
 * 처럼 판단을 담은 다른 자리에는 없었다. 여기 한 곳에 상시 두면 화면마다
 * 따로 챙기지 않아도 된다.
 *
 * `RootLayout` 에 한 번만 놓는다. `body` 가 `flex flex-col` 이라 본문이 짧은
 * 화면에서도 `mt-auto` 로 뷰포트 바닥에 붙는다.
 */
export function Footer() {
  return (
    <footer className="mt-auto border-t border-line-20">
      <div
        className="mx-auto flex w-full max-w-shell flex-col gap-2.5 px-4 pt-6 md:px-8"
        style={{ paddingBottom: "calc(28px + var(--safe-b))" }}
      >
        <p
          className="text-pretty text-muted-60"
          style={{ fontSize: 11.5, lineHeight: 1.7 }}
        >
          이 화면의 시세·재무·뉴스·AI 판단은 투자 판단의 참고 자료이며 투자
          권유가 아닙니다. 투자에 따른 손익의 책임은 이용자 본인에게 있습니다.
        </p>
        <p
          className="font-mono text-muted-45"
          style={{ fontSize: 10, letterSpacing: "0.02em" }}
        >
          데이터 제공 Yahoo Finance(yfinance) · KRX · {QUOTE_DELAY_NOTE}
        </p>
      </div>
    </footer>
  );
}
