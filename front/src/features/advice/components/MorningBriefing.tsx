import Link from "next/link";
import { Icon } from "@/shared/ui";
import { VERDICT_TONE, type MorningBriefing } from "../model/briefing";

/** 홈(3b) 상단 AI 아침 브리핑 배너. 반전 배경. */
export function MorningBriefingBanner({
  briefing,
}: {
  briefing: MorningBriefing;
}) {
  return (
    // 모바일 스케일이 없어 데스크탑 값(패딩 22/24 · gap 26 · 헤드라인 27px)이
    // 320px 에서도 그대로 적용됐다. 디자인 4b/3b 모바일 프레임은
    // 패딩 16 · gap 10 · 헤드라인 20px/1.35 다.
    <section className="flex flex-col items-start gap-[10px] bg-ink p-4 text-on-ink md:flex-row md:gap-[26px] md:px-6 md:py-[22px]">
      <div className="flex flex-1 flex-col gap-2 md:gap-[11px]">
        <h2
          className="font-mono uppercase tracking-[0.18em] text-on-ink-55"
          style={{ fontSize: 10.5 }}
        >
          ai morning briefing · {briefing.time}
        </h2>
        <p className="font-serif-kr font-bold text-pretty text-[20px] leading-[1.35] md:text-[27px] md:leading-[1.3]">
          {briefing.headline}
        </p>
        <div className="flex flex-col gap-1.5 border-t border-on-ink-20 pt-[9px] md:pt-[11px]">
          {briefing.positives.map((line) => (
            <span
              key={line}
              className="flex items-start gap-1.5 font-mono text-on-ink-78 text-[11.5px] md:text-[12.5px]"
            >
              <Icon name="plus" size={14} className="mt-px flex-none" />
              {line}
            </span>
          ))}
          {briefing.negatives.map((line) => (
            <span
              key={line}
              className="flex items-start gap-1.5 font-mono text-down-on-ink text-[11.5px] md:text-[12.5px]"
            >
              <Icon name="minus" size={14} className="mt-px flex-none" />
              {line}
            </span>
          ))}
        </div>
      </div>

      <div className="flex w-full flex-col gap-[9px] md:w-[196px]">
        <h3
          className="font-mono uppercase tracking-label-wide text-on-ink-50"
          style={{ fontSize: 10 }}
        >
          관심 종목 판단
        </h3>
        {briefing.watchlist.map((item, index) => (
          <span
            key={item.code}
            className={`flex items-baseline justify-between gap-2 ${
              index === briefing.watchlist.length - 1
                ? ""
                : "border-b border-on-ink-18 pb-1.5"
            }`}
          >
            <span style={{ fontSize: 13 }}>{item.name}</span>
            <span
              className={`num font-medium ${VERDICT_TONE[item.label]}`}
              style={{ fontSize: 11.5 }}
            >
              {item.label}
            </span>
          </span>
        ))}
        <Link
          href={`/stocks/${briefing.watchlist[0]?.code ?? "005930"}?ai=1`}
          className="mt-1 flex min-h-[var(--tap)] items-center justify-center border border-on-ink-55 py-[9px] text-center font-medium hover:bg-on-ink hover:text-ink md:min-h-0"
          style={{ fontSize: 12 }}
        >
          3인 의견 자세히
        </Link>
      </div>
    </section>
  );
}
