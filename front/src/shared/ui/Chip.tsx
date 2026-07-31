/** 정규화 심볼 / 시장 / 섹터. radius 0. 섹터 칩만 solid. */
export function Chip({
  children,
  variant = "outline",
  size = 10.5,
}: {
  children: React.ReactNode;
  variant?: "outline" | "solid";
  size?: number;
}) {
  const base =
    "inline-flex items-center px-2 py-[3px] font-mono font-medium leading-none tracking-label-tight";
  return (
    <span
      className={
        variant === "solid"
          ? `${base} bg-ink text-on-ink`
          : `${base} border border-line-25 text-ink`
      }
      style={{ fontSize: size }}
    >
      {children}
    </span>
  );
}
