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
  const { stage, agents, decision, error, running, retry } = useAiAdvice({
    symbol,
    enabled: open,
    fallback,
  });
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

      <AdviceProgress stage={stage} running={running} />

      <div
        className="flex flex-1 flex-col gap-3.5 overflow-auto px-[22px] py-4"
        // 모바일 시트는 화면 아래 끝까지 내려오므로 홈 인디케이터만큼 더 띄운다.
        style={{ paddingBottom: "calc(1rem + var(--safe-b))" }}
      >
        <p
          className="font-mono text-muted-45"
          style={{ fontSize: 10, lineHeight: 1.6 }}
        >
          AI 분석은 여러 번의 조회를 포함해 시간이 걸립니다.
        </p>

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

        {error && !decision ? (
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
