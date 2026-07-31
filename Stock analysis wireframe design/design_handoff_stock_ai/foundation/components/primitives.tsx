// 전체 화면의 약 70%를 덮는 6종. 이것 외의 공통 컴포넌트는 화면 만들며 뽑을 것.
import { deltaColorClass, direction, percent as fmtPercent, delta as fmtDelta } from "@/lib/format";

/* 1. SectionLabel — 모든 섹션 머리. mono uppercase */
export function SectionLabel({
  children, size = 10.5, right,
}: { children: React.ReactNode; size?: 9.5 | 10.5 | 11; right?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 pb-2">
      <span className="font-mono uppercase tracking-label text-muted" style={{ fontSize: size }}>
        {children}
      </span>
      {right ? <span className="font-mono text-muted" style={{ fontSize: size - 0.5 }}>{right}</span> : null}
    </div>
  );
}

/* 2. Delta — 등락. 상승/하락 색 분기는 오직 여기서만 일어난다. */
export function Delta({
  change, changePercent, size = 13.5, inverted = false, showAmount = true, arrow = true,
}: {
  change: number; changePercent: number;
  size?: number; inverted?: boolean; showAmount?: boolean; arrow?: boolean;
}) {
  const d = direction(changePercent);
  const glyph = d === "up" ? "▲" : d === "down" ? "▼" : "—";
  return (
    <span className={`num inline-flex items-baseline gap-1.5 ${deltaColorClass(changePercent, inverted)}`}
          style={{ fontSize: size }}>
      {arrow ? <span style={{ fontSize: size * 0.68 }}>{glyph}</span> : null}
      {showAmount ? <span>{fmtDelta(change)}</span> : null}
      <span>{fmtPercent(changePercent)}</span>
    </span>
  );
}

/* 3. Chip — 정규화 심볼 / 시장 / 섹터. radius 0. */
export function Chip({
  children, variant = "outline", size = 10.5,
}: { children: React.ReactNode; variant?: "outline" | "solid"; size?: number }) {
  const base = "font-mono uppercase tracking-label inline-flex items-center px-2 py-1 leading-none";
  return (
    <span
      className={variant === "solid"
        ? `${base} bg-ink text-paper`
        : `${base} border border-line text-muted`}
      style={{ fontSize: size }}
    >
      {children}
    </span>
  );
}

/* 4. Hairline / DottedRow — 직접 border를 쓰지 말 것 */
export function Hairline({ strong = false }: { strong?: boolean }) {
  return <hr className={strong ? "border-0 border-t-2 border-ink" : "border-0 border-t border-line"} />;
}

export function DottedRow({
  children, hover = true, onClick,
}: { children: React.ReactNode; hover?: boolean; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 py-2.5 border-b border-dotted border-[var(--line-dot)] ${
        hover ? "hover:bg-surface-hover cursor-pointer" : ""
      }`}
    >
      {children}
    </div>
  );
}

/* 5. Sparkline — 데스크탑 76×24 / 검색 92×26 / 관심종목 104×28 */
export function Sparkline({
  points, w = 76, h = 24, inverted = false,
}: { points: number[]; w?: number; h?: number; inverted?: boolean }) {
  if (points.length < 2) return <svg width={w} height={h} aria-hidden />;
  const min = Math.min(...points), max = Math.max(...points);
  const span = max - min || 1;
  const pad = 2;
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * (w - pad * 2) + pad;
      const y = h - pad - ((p - min) / span) * (h - pad * 2);
      return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const up = points[points.length - 1] >= points[0];
  const stroke = inverted
    ? up ? "var(--up-on-ink)" : "var(--down-on-ink)"
    : up ? "var(--up)" : "var(--down)";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden style={{ display: "block" }}>
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.25} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* 6. StatRow — 라벨/값 2열. 투자 지표·시장 개요·AI 근거 */
export function StatRow({
  label, value, accent, last = false,
}: { label: string; value: React.ReactNode; accent?: "up" | "down"; last?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-2 ${last ? "" : "border-b border-line"}`}>
      <span className="font-mono uppercase tracking-label text-muted" style={{ fontSize: 10 }}>{label}</span>
      <span className={`num text-[13.5px] ${accent === "up" ? "text-up" : accent === "down" ? "text-down" : "text-ink"}`}>
        {value}
      </span>
    </div>
  );
}
