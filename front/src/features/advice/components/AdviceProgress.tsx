import { ADVICE_STAGE_LABELS, type AdviceStage } from "../model/types";

/**
 * `stage` 는 '끝난 단계 수'다. 라벨은 '지금 하고 있는 단계'를 말해야 한다 —
 * 그래서 stage 가 아니라 stage+1 을 읽는다.
 *
 * 전에는 ADVICE_STAGE_LABELS[stage] 를 그대로 썼다. 그 결과
 * (a) 스펙에 없는 '분석 준비 중 · 0/4 단계' 가 뜨고,
 * (b) stage 가 4 가 되는 순간 running 이 false 라 '최종 판단 종합' 라벨이
 *     한 번도 렌더되지 않았다. README '진행 표시(필수)' 의 4단계 중 하나가
 *     사용자에게 영영 안 보이던 셈이다.
 */
function stageLabel(stage: AdviceStage, running: boolean): string {
  if (stage >= 4 && !running) return "분석 완료 · 4/4 단계";
  const current = Math.min(stage + 1, 4) as Exclude<AdviceStage, 0>;
  return `${ADVICE_STAGE_LABELS[current]} · ${current}/4 단계`;
}

export function AdviceProgress({
  stage,
  running,
}: {
  stage: AdviceStage;
  running: boolean;
}) {
  const percent = (stage / 4) * 100;

  return (
    <div className="flex flex-col gap-2 border-b border-dotted border-line-30 px-[22px] py-3.5">
      <div className="flex items-center justify-between gap-3">
        <span
          role="status"
          aria-live="polite"
          className="text-muted-70"
          style={{ fontSize: 12 }}
        >
          {stageLabel(stage, running)}
        </span>
        {running ? (
          <span
            aria-hidden
            className="dot block h-[11px] w-[11px] animate-dot-spin border-[1.6px] border-line-25 border-t-up"
          />
        ) : null}
      </div>
      <div
        className="h-[3px] bg-line-14"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={stage}
        aria-label="AI 분석 진행"
      >
        <span
          className="block h-[3px] bg-ink transition-[width] duration-[400ms] ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
