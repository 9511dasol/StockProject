// 숫자·시각 포맷 단일 출처. 화면에서 toLocaleString을 직접 부르지 말 것.

const KRW = new Intl.NumberFormat("ko-KR");

/** 71,300 — 원화 정수. 해외 종목은 소수 2자리. */
export function price(v: number, currency: "KRW" | "USD" = "KRW"): string {
  if (currency === "USD") return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return KRW.format(Math.round(v));
}

/** +2.41% / -0.83% / 0.00% — 부호 항상 표기 */
export function percent(v: number, digits = 2): string {
  const s = v > 0 ? "+" : v < 0 ? "-" : "";
  return `${s}${Math.abs(v).toFixed(digits)}%`;
}

/** +1,700 / -600 — 전일 대비 금액 */
export function delta(v: number): string {
  const s = v > 0 ? "+" : v < 0 ? "-" : "";
  return `${s}${KRW.format(Math.abs(Math.round(v)))}`;
}

/** 12.4M / 843.2K / 1.2B — 거래량·시가총액 */
export function compact(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e12) return (v / 1e12).toFixed(1) + "T";
  if (a >= 1e9) return (v / 1e9).toFixed(1) + "B";
  if (a >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (a >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return String(Math.round(v));
}

/** 시가총액 한국식: 421.8조 / 8,240억 */
export function marketCapKR(v: number): string {
  if (v >= 1e12) return (v / 1e12).toFixed(1) + "조";
  if (v >= 1e8) return KRW.format(Math.round(v / 1e8)) + "억";
  return KRW.format(v);
}

/** 'up' | 'down' | 'flat' — 색 분기는 반드시 이 함수를 통해서 */
export type Direction = "up" | "down" | "flat";
export function direction(v: number): Direction {
  return v > 0 ? "up" : v < 0 ? "down" : "flat";
}

/** Delta 컴포넌트 전용. 그 외 위치에서 호출 금지. */
export function deltaColorClass(v: number, inverted = false): string {
  const d = direction(v);
  if (d === "flat") return "text-muted";
  if (inverted) return d === "up" ? "text-up-on-ink" : "text-down-on-ink";
  return d === "up" ? "text-up" : "text-down";
}

/** 09.30 15:31 — 뉴스·로그 타임스탬프 */
export function stamp(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 3분 전 / 2시간 전 / 09.28 — 뉴스 리스트 */
export function relative(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
  return stamp(iso).slice(0, 5);
}
