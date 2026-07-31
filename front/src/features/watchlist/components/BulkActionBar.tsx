"use client";

/** 밑줄 텍스트 버튼이지만 모바일 히트 영역은 44px 를 채운다 (글자 위치는 그대로). */
const ACTION =
  "inline-flex min-h-[var(--tap)] items-center border-b border-line-control hover:border-ink disabled:border-transparent disabled:text-muted-35 md:min-h-0";

export function BulkActionBar({
  count,
  analyzing,
  remaining,
  onMoveGroup,
  onBulkAlert,
  onDelete,
}: {
  count: number;
  analyzing: boolean;
  remaining: number;
  onMoveGroup: () => void;
  onBulkAlert: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-surface px-[18px] py-3.5">
      <span className="flex items-center gap-[22px]">
        <span
          className="num font-medium tracking-[0.1em]"
          style={{ fontSize: 12 }}
        >
          선택 {count}종목
        </span>
        <span
          className="flex gap-2.5 text-muted-70"
          style={{ fontSize: 12.5 }}
        >
          <button type="button" onClick={onMoveGroup} className={ACTION}>
            그룹 이동
          </button>
          <button type="button" onClick={onBulkAlert} className={ACTION}>
            알림 일괄 설정
          </button>
          <button type="button" onClick={onDelete} className={ACTION}>
            삭제
          </button>
        </span>
      </span>

      {analyzing ? (
        <span
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 text-muted-70"
          style={{ fontSize: 11.5 }}
        >
          <span
            aria-hidden
            className="dot block h-[11px] w-[11px] animate-dot-spin border-[1.6px] border-line-25 border-t-up"
          />
          AI 분석 진행 중 · {remaining}종목 남음 — 종목당 LLM 4회를 부르므로
          시간이 걸립니다
        </span>
      ) : (
        <span
          className="font-mono text-muted-45"
          style={{ fontSize: 9.5 }}
        >
          generate_stock_advice ×{count} (병렬) · 종목당 LLM 4회 → 지연 안내 필요
        </span>
      )}
    </div>
  );
}
