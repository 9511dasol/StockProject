"use client";

import { useId, useState } from "react";

/**
 * 뉴스 / 애널리스트 리포트 / 재무 전환.
 *
 * 이 화면에서 유일한 클라이언트 컴포넌트다. 세 패널은 모두 서버에서 렌더해
 * `panels` 로 받고 여기서는 표시 여부만 바꾼다 — 뉴스·리포트 본문은 번들에 들어가지
 * 않고, 전환에 네트워크 왕복도 없다.
 */
export function DetailTabs({
  panels,
}: {
  panels: { key: string; label: string; content: React.ReactNode }[];
}) {
  const [active, setActive] = useState(0);
  const baseId = useId();

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const step = event.key === "ArrowRight" ? 1 : -1;
    const next = (active + step + panels.length) % panels.length;
    setActive(next);
    document.getElementById(`${baseId}-tab-${next}`)?.focus();
  }

  return (
    <section className="flex flex-col gap-3.5">
      <div
        role="tablist"
        aria-label="종목 상세 정보"
        onKeyDown={onKeyDown}
        className="mt-1.5 flex border-t border-line-20 pt-3"
      >
        {panels.map((panel, index) => {
          const isActive = index === active;
          return (
            <button
              key={panel.key}
              id={`${baseId}-tab-${index}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`${baseId}-panel-${index}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActive(index)}
              className={`flex min-h-[var(--tap)] items-end pb-2 md:min-h-0 ${index === 0 ? "pr-3.5" : "px-3.5"} ${
                isActive
                  ? "border-b-2 border-ink font-medium text-ink"
                  : "text-muted-45 hover:text-ink"
              }`}
              style={{ fontSize: 12.5 }}
            >
              {panel.label}
            </button>
          );
        })}
      </div>

      {panels.map((panel, index) => (
        <div
          key={panel.key}
          id={`${baseId}-panel-${index}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${index}`}
          hidden={index !== active}
        >
          {panel.content}
        </div>
      ))}
    </section>
  );
}
