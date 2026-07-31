const SWATCH = "block h-[2px] w-[14px]";

export function ChartLegend() {
  return (
    <div
      className="flex gap-4 font-mono text-muted-60"
      style={{ fontSize: 10.5 }}
    >
      <span className="flex items-center gap-[5px]">
        <span className={`${SWATCH} bg-ink`} />
        MA20
      </span>
      <span className="flex items-center gap-[5px]">
        <span className={`${SWATCH} bg-ma60`} />
        MA60
      </span>
      <span className="flex items-center gap-[5px]">
        <span className="block h-[9px] w-[12px] bg-[var(--bb-band)]" />
        BB(20,2)
      </span>
      <span className="flex items-center gap-[5px]">
        <span className="dot block h-[9px] w-[9px] border-[1.5px] border-up" />
        골든/데드크로스
      </span>
    </div>
  );
}
