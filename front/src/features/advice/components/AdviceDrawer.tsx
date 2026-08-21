"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/shared/ui";
import { useAiAdvice } from "../hooks/useAiAdvice";
import { useAdvice } from "./AdviceProvider";
import { AdviceProgress } from "./AdviceProgress";
import { AgentCard } from "./AgentCard";
import { AgentSkeleton } from "./AgentSkeleton";
import { FinalDecision } from "./FinalDecision";
import { PersonalVerdictCard } from "./PersonalVerdictCard";

/**
 * AI 종합 판단 패널. 2a·2b 가 같은 인스턴스를 공유한다.
 *
 * 데스크탑(≥768) 은 우측 438px 슬라이드 드로어, 모바일은 전체 화면 시트다.
 * 438px 를 모바일에 그대로 두면 375px 뷰포트를 넘겨 가로 스크롤이 생긴다.
 * 두 컴포넌트로 쪼개지 않고 한 요소에 브레이크포인트만 얹은 이유는 SSE 스트림
 * 때문이다 — 마운트가 둘이면 스트림도 둘로 갈라진다.
 */
export function AdviceDrawer({ symbol }: { symbol: string }) {
  const { open, fallback, setOpen } = useAdvice();
  const {
    stage,
    agents,
    decision,
    error,
    running,
    startedAt,
    stopped,
    budgetMs,
    retry,
    cancel,
  } = useAiAdvice({ symbol, enabled: open, fallback });
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  if (!open) return null;

  // 에이전트 3장이 다 차도 아직 '최종 판단 종합'(4단계) LLM 호출이 남아 있다.
  // agents.length < AGENT_COUNT 만 보면 3번째 카드가 붙는 순간 스켈레톤이 사라져
  // 가장 오래 걸리는 구간이 빈 화면이 된다. 판단이 도착할 때까지 자리를 지킨다.
  const pending = running && !decision;

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-label="AI 종합 판단"
      // fixed: 2a·2b 두 레이아웃이 동시에 렌더돼 있어도 드로어는 하나만 존재해야
      // 한다 (SSE 스트림이 둘로 갈라지면 안 된다). 컨테이너 밖으로 끌어냈으므로
      // 화면 우측(모바일은 전체)에 붙는다.
      className="fixed inset-0 z-40 flex animate-sheet-up flex-col border-t-2 border-ink bg-surface shadow-drawer md:inset-y-0 md:left-auto md:right-0 md:w-[438px] md:animate-slide-in md:border-l-2 md:border-t-0"
    >
      <header className="flex items-start justify-between gap-3 border-b border-line-20 px-[22px] pb-3.5 pt-5">
        <span className="flex flex-col gap-1">
          <span
            className="font-serif-kr font-bold leading-none"
            style={{ fontSize: 22 }}
          >
            AI 종합 판단
          </span>
          <span
            className="font-mono uppercase tracking-[0.1em] text-muted-50"
            style={{ fontSize: 10.5 }}
          >
            3 agents → 1 decision
          </span>
        </span>
        <button
          ref={closeRef}
          type="button"
          onClick={() => setOpen(false)}
          aria-label="AI 판단 닫기"
          className="-mr-2 -mt-1 flex min-h-[var(--tap)] min-w-[var(--tap)] items-center justify-center text-muted-50 hover:text-ink md:-mr-0.5 md:-mt-0 md:min-h-0 md:min-w-0"
        >
          <Icon name="close" size={17} />
        </button>
      </header>

      <AdviceProgress
        stage={stage}
        running={running}
        startedAt={startedAt}
        stopped={stopped}
        budgetMs={budgetMs}
      />

      <div
        className="flex flex-1 flex-col gap-3.5 overflow-auto px-[22px] py-4"
        // 모바일 시트는 화면 아래 끝까지 내려오므로 홈 인디케이터만큼 더 띄운다.
        style={{ paddingBottom: "calc(1rem + var(--safe-b))" }}
      >
        {/* 돌고 있는 동안에는 멈출 수 있어야 한다 — 종목당 모델 호출이 여러 번이라
            잘못 연 분석을 끝까지 기다리게 하면 시간도 비용도 사용자가 떠안는다.
            멈춤은 상류까지 닿는다 (`useAiAdvice.cancel` 주석). */}
        <div className="flex items-baseline justify-between gap-3">
          <p
            className="font-mono text-muted-45"
            style={{ fontSize: 10, lineHeight: 1.6 }}
          >
            AI 분석은 여러 번의 조회를 포함해 시간이 걸립니다.
          </p>
          {running ? (
            <button
              type="button"
              onClick={cancel}
              className="flex-none border border-line-30 px-2.5 py-1 font-medium text-muted-70 hover:border-ink hover:text-ink"
              style={{ fontSize: 11.5 }}
            >
              분석 멈추기
            </button>
          ) : null}
        </div>

        {agents.map((opinion, index) => (
          <AgentCard key={opinion.agent} opinion={opinion} index={index} />
        ))}

        {pending ? <AgentSkeleton /> : null}

        {decision ? (
          <FinalDecision decision={decision} onRetry={retry} />
        ) : null}

        {/* 시장 판단 **다음에** 온다. 위 카드가 "데이터는 이렇게 말한다" 이고
            이 카드가 "당신에게는" 이라, 그 순서로 읽혀야 불일치가 이야기가 된다.
            프로파일이 없으면 personal 자체가 없어 아무것도 그리지 않는다. */}
        {decision?.personal ? (
          <PersonalVerdictCard personal={decision.personal} />
        ) : null}

        {/* 멈춤은 실패가 아니다 — 본인이 알고 한 일이라 사과하지 않는다. 그래도
            흔적은 남아야 한다: 예전에는 취소하면 화면이 '막 열린 화면' 과 완전히
            같아져서, 무엇을 했는지도 무엇을 할 수 있는지도 알 수 없었다. */}
        {stopped && !decision ? (
          <div className="flex flex-col gap-3 border border-dashed border-line-30 p-3.5">
            <p style={{ fontSize: 12.5 }}>
              분석을 멈췄습니다. 받는 중이던 의견은 남기지 않았습니다.
            </p>
            <button
              type="button"
              onClick={retry}
              className="border border-ink px-4 py-2 font-medium hover:bg-ink hover:text-on-ink"
              style={{ fontSize: 12.5 }}
            >
              AI 분석 다시 시도
            </button>
          </div>
        ) : null}

        {/* 시간 초과는 여기로 오지 않는다 — 백엔드가 규칙 기반 판단(stage 4)으로
            착지시키므로 위쪽 `FinalDecision` 이 이유까지 밝혀 그린다. 이 상자는
            판단을 만들 수조차 없었던 경우(주가 조회 실패 등)의 자리다. */}
        {error && !decision && !stopped ? (
          <div className="flex flex-col gap-3 border border-dashed border-line-30 p-3.5">
            <p style={{ fontSize: 12.5 }}>
              AI 분석을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
            </p>
            <button
              type="button"
              onClick={retry}
              className="border border-ink px-4 py-2 font-medium hover:bg-ink hover:text-on-ink"
              style={{ fontSize: 12.5 }}
            >
              AI 분석 다시 시도
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
