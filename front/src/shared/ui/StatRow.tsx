/**
 * 라벨 / 값 2열 행. 투자 지표 · 시장 개요 · AI 근거에서 쓴다.
 *
 * 구분선은 없다 — 2a 우측 레일은 행 간격(gap)으로만 구분한다.
 * accent 는 상승/하락 색을 값에 입힌다. 색 문자열을 직접 넘기지 말 것.
 */
export function StatRow({
  label,
  value,
  accent,
  labelSize = 12.5,
  valueSize = 13,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  accent?: "up" | "down";
  labelSize?: number;
  valueSize?: number;
}) {
  const valueColor =
    accent === "up" ? "text-up" : accent === "down" ? "text-down" : "text-ink";
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-60" style={{ fontSize: labelSize }}>
        {label}
      </span>
      <span
        className={`num text-right font-medium ${valueColor}`}
        style={{ fontSize: valueSize }}
      >
        {value}
      </span>
    </div>
  );
}
