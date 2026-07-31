// 숫자 표시 포맷 단일 출처. 화면에서 toLocaleString 을 직접 부르지 않는다.

const KRW = new Intl.NumberFormat("ko-KR");

/** 71,400 — 원화는 정수, 해외 종목은 소수 2자리 */
export function price(value: number, currency: "KRW" | "USD" = "KRW"): string {
  if (currency === "USD") {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return KRW.format(Math.round(value));
}

/** +1.42% / -0.29% / 0.00% — 부호 항상 표기 */
export function percent(value: number, digits = 2): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${Math.abs(value).toFixed(digits)}%`;
}

/** +1,000 / -202 — 전일 대비 금액 */
export function delta(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${KRW.format(Math.abs(Math.round(value)))}`;
}

/** 1.82x — 거래량 배율 */
export function ratio(value: number, digits = 2): string {
  return `${value.toFixed(digits)}x`;
}

/** 12.4M / 843.2K / 1.2B — 거래량·차트 축 */
export function compact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return String(Math.round(value));
}

/** 421.8조 / 8,240억 — 시가총액 한국식 */
export function marketCapKR(value: number): string {
  if (value >= 1e12) return `${(value / 1e12).toFixed(1)}조`;
  if (value >= 1e8) return `${KRW.format(Math.round(value / 1e8))}억`;
  return KRW.format(value);
}

/** 2,842.19 — 지수처럼 소수점을 유지해야 하는 값 */
export function decimal(value: number, digits = 2): string {
  return value.toLocaleString("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** +23.71 / -12.06 — 지수 변동폭. 부호 항상 표기 */
export function signedDecimal(value: number, digits = 2): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${decimal(Math.abs(value), digits)}`;
}
