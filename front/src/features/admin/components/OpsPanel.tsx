import { Icon } from "@/shared/ui";
import type { OpsSnapshot } from "../model/types";

export interface OpsPanelProps {
  ops: OpsSnapshot;
}

/**
 * 운영 현황 — 배치 진행률 · AI 캐시 · 자물쇠 상태.
 *
 * **여기 있는 숫자는 전부 지금까지 DB 를 직접 쳐야만 보이던 값들이다.** 스크리너를
 * 만들던 17회차 내내 스크립트로 확인하던 것이고, 그 사실 자체가 이 화면이 필요한
 * 이유였다.
 *
 * 서버 컴포넌트다 — 막대는 CSS 폭이고 상호작용이 없다.
 */
export function OpsPanel({ ops }: OpsPanelProps) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-2.5">
        <SectionTitle>배치 적재율</SectionTitle>
        <Coverage label="오늘의 일정" done={ops.calendarCovered} total={ops.universeSize} />
        <Coverage
          label="스크리너 지표"
          done={ops.fundamentalsCovered}
          total={ops.universeSize}
        />
        <Coverage label="시가총액" done={ops.marketCapCovered} total={ops.universeSize} />
        <p className="num text-muted-45" style={{ fontSize: 10 }}>
          마지막 배치 · 일정 {stamp(ops.lastCalendarBatch)} · 지표{" "}
          {stamp(ops.lastFundamentalsBatch)}
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        <SectionTitle>AI 판단</SectionTitle>
        {/* 이 프로젝트에서 돈이 나가는 유일한 경로다. 캐시가 실제로 일하고 있는지
            볼 방법이 지금까지 없었다. */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 md:grid-cols-3">
          <Stat label="캐시된 종목" value={`${ops.adviceCached} / ${ops.adviceCapacity}`} />
          <Stat
            label="분석 중"
            value={`${ops.adviceInFlight} / ${ops.adviceMaxConcurrent}`}
          />
          <Stat label="RAG" value={ops.ragEnabled ? "켜짐" : "꺼짐"} />
        </div>
        <p className="text-muted-45" style={{ fontSize: 10.5, lineHeight: 1.5 }}>
          캐시는 프로세스 메모리에 있습니다. <strong>누적 사용량이 아니라 현재
          상태</strong>이고, 서버를 재시작하면 0 이 됩니다.
        </p>
      </div>

      {/* 꺼져 있는 자물쇠는 **경고로** 보여야 한다. 조용히 열려 있는 것이 가장 나쁘다 */}
      {!ops.adviceLocked ? (
        <p
          role="status"
          className="flex items-start gap-2 border border-line-35 px-3 py-3 text-muted-70"
          style={{ fontSize: 12.5, lineHeight: 1.6 }}
        >
          <Icon name="bell" size={15} className="mt-0.5 flex-none text-muted-45" />
          AI 판단 엔드포인트가 잠겨 있지 않습니다. 외부에 노출된 서버라면{" "}
          <code>ADVICE_API_KEY</code> 를 백엔드와 프런트에 같은 값으로 넣으세요.
        </p>
      ) : null}
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="font-mono uppercase tracking-label-wide text-muted-50"
      style={{ fontSize: 10 }}
    >
      {children}
    </h2>
  );
}

/**
 * 진행률 한 줄. **분모가 0 일 때 NaN 을 그리지 않는다.**
 *
 * 상장사 수집 전에는 모집단이 0 이고, 그때 `done/total` 은 NaN 이다. 화면에 NaN 이
 * 뜨면 "값이 이상하다" 로 보이지만 실제로는 "아직 시작 안 했다" 다.
 */
function Coverage({ label, done, total }: { label: string; done: number; total: number }) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <span style={{ fontSize: 12.5 }}>{label}</span>
        <span className="num text-muted-60" style={{ fontSize: 11.5 }}>
          {total > 0
            ? `${done.toLocaleString("ko-KR")} / ${total.toLocaleString("ko-KR")} · ${percent}%`
            : "모집단 없음"}
        </span>
      </div>
      <div
        className="h-[6px] w-full bg-surface"
        role="meter"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className="h-full bg-ink" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span
        className="font-mono uppercase tracking-label text-muted-45"
        style={{ fontSize: 9.5 }}
      >
        {label}
      </span>
      <span className="num font-medium" style={{ fontSize: 14 }}>
        {value}
      </span>
    </span>
  );
}

/** ISO → `08-10 05:34`. 배치는 날짜와 시각이 둘 다 필요하다 (하루 1회라도). */
function stamp(iso: string | null): string {
  if (!iso) return "없음";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "없음";

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
