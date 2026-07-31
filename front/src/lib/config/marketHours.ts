/**
 * KRX 장 운영 시간 기준 재검증 주기.
 *
 * 장중에는 시세가 계속 바뀌므로 짧게, 장 마감 후·주말에는 값이 고정이므로 길게 잡는다.
 * 같은 60초를 밤새 유지하면 하루에 수백 번을 무의미하게 다시 가져온다.
 *
 * 서버 타임존에 의존하지 않는다 — 배포 환경은 대개 UTC 이고, 로컬은 KST 다.
 * `Intl.DateTimeFormat` 에 timeZone 을 명시해 어디서 돌든 같은 판정을 내린다.
 * 공휴일 캘린더는 두지 않는다: 휴장일에 60초로 잠깐 더 자주 가져와도 손해가
 * 크지 않고, 캘린더는 매년 갱신해야 하는 부채가 된다.
 */

/** 장중 09:00~15:40 (분 단위). 15:30 정규장 + 동시호가 여유 10분. */
const OPEN_MINUTES = 9 * 60;
const CLOSE_MINUTES = 15 * 60 + 40;

/** 장중 — 시세가 계속 움직인다 */
export const REVALIDATE_MARKET_OPEN = 60;
/** 장외 — 다음 개장까지 값이 고정이다 */
export const REVALIDATE_MARKET_CLOSED = 900;

/** 시세와 무관한 데이터(종목 메타·상장사 정보)의 고정 주기 */
export const REVALIDATE_STATIC = 3600;

const KST = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const WEEKEND = new Set(["Sat", "Sun"]);

export interface SeoulClock {
  /** Mon … Sun */
  weekday: string;
  /** 자정부터 지난 분 */
  minutes: number;
}

/** 주어진 시각을 서울 기준 요일·분으로 환산한다. */
export function toSeoulClock(now: Date = new Date()): SeoulClock {
  const parts = KST.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  // en-US + hour12:false 는 자정을 "24" 로 주는 구현이 있다 — 0 으로 정규화한다.
  const hour = Number(get("hour")) % 24;
  return {
    weekday: get("weekday"),
    minutes: hour * 60 + Number(get("minute")),
  };
}

/** 서울 기준 평일 장중인가. */
export function isMarketOpen(now: Date = new Date()): boolean {
  const { weekday, minutes } = toSeoulClock(now);
  if (WEEKEND.has(weekday)) return false;
  return minutes >= OPEN_MINUTES && minutes < CLOSE_MINUTES;
}

/**
 * 시세 계열 fetch 에 줄 revalidate 초.
 *
 * 라우트 세그먼트의 `export const revalidate` 는 정적 값만 허용하므로 여기서
 * 계산한 값은 반드시 fetch 의 `next.revalidate` 로 전달한다.
 */
export function marketRevalidate(now: Date = new Date()): number {
  return isMarketOpen(now) ? REVALIDATE_MARKET_OPEN : REVALIDATE_MARKET_CLOSED;
}
