/**
 * 구분선. 컴포넌트에서 border 를 직접 쓰지 말고 이것을 쓴다.
 *
 * weight
 *  - "hair"   1px 헤어라인 (기본)
 *  - "rule"   1px, 조금 진함 — 섹션 구분
 *  - "strong" 2px ink — 마스트헤드 하단
 */
export function Hairline({
  weight = "hair",
}: {
  weight?: "hair" | "rule" | "strong";
}) {
  const cls =
    weight === "strong"
      ? "border-0 border-t-2 border-ink"
      : weight === "rule"
        ? "border-0 border-t border-line-20"
        : "border-0 border-t border-line-14";
  return <hr className={cls} />;
}

/** 리스트 행 — 하단 점선. 뉴스 행은 tone="news" (rgba .25) */
export function DottedRow({
  children,
  tone = "default",
  align = "center",
  hover = false,
  className = "",
}: {
  children: React.ReactNode;
  tone?: "default" | "news";
  align?: "center" | "start" | "baseline";
  hover?: boolean;
  className?: string;
}) {
  const border =
    tone === "news" ? "border-line-25" : "border-line-22";
  const items =
    align === "start"
      ? "items-start"
      : align === "baseline"
        ? "items-baseline"
        : "items-center";
  return (
    <div
      className={`flex border-b border-dotted ${border} ${items} ${
        hover ? "hover:bg-surface-hover" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
