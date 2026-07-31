// 날짜·시각 표시 포맷.
//
// 상대 시각(relative)은 Date.now() 에 의존해 서버/클라이언트 렌더 결과가 어긋난다.
// 그래서 서버 컴포넌트에서 미리 문자열로 만들어 내려보내고, 화면은 그 문자열만 쓴다.

const PAD = (n: number) => String(n).padStart(2, "0");

/**
 * 이 서비스의 시각은 전부 KST 다 — 화면이 "장 마감 15:30 KST" 라고 선언한다.
 *
 * 전에는 getUTC* 를 썼다. 서버·클라이언트가 같은 값을 내도록 로컬 타임존을
 * 피한 것까지는 맞았지만, 그 결과 화면에 뜨는 값이 UTC 였다 — KST 00:00~09:00
 * 사이에는 날짜가 하루 뒤로 나온다. getFullYear() 같은 로컬 계열로 바꾸면
 * 이번엔 서버(UTC 컨테이너)와 브라우저(KST)가 갈려 하이드레이션이 깨진다.
 *
 * 그래서 타임존을 Asia/Seoul 로 못 박는다. 실행 환경과 무관하게 결정적이라
 * 서버·클라이언트가 같은 문자열을 만든다.
 */
const KST = "Asia/Seoul";

interface KstParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const KST_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: KST,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  weekday: "short",
});

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * 파싱할 수 없는 값이면 null 을 돌려준다.
 *
 * 백엔드 스키마가 `published_at: str = ""` 라 빈 문자열이 실제로 내려온다.
 * `new Date("")` 는 Invalid Date 이고, Intl.formatToParts 는 거기서
 * RangeError 를 던져 서버 렌더를 통째로 무너뜨린다 — 뉴스 한 줄의 날짜가
 * 비었다는 이유로 종목 상세 페이지가 에러 화면이 된다.
 * (이전 getUTC* 구현은 예외 대신 "NaN.NaN" 을 조용히 그렸다. 둘 다 틀렸다.)
 */
function kstParts(iso: string): KstParts | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const parts = KST_FORMAT.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    // KST 자정은 en-US hour12:false 에서 "24" 로 나온다
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: WEEKDAY_INDEX[get("weekday")] ?? 0,
  };
}

/** 값이 없을 때 자리에 남기는 표시 — 빈 문자열보다 '모른다'가 정직하다 */
const UNKNOWN = "—";

/** 2026. 07. 30 목요일 — 마스트헤드 캡션 */
export function masthead(iso: string): string {
  const d = kstParts(iso);
  if (!d) return UNKNOWN;
  return `${d.year}. ${PAD(d.month)}. ${PAD(d.day)} ${WEEKDAYS[d.weekday]}요일`;
}

/** 09.30 15:31 — 뉴스·로그 타임스탬프 */
export function stamp(iso: string): string {
  const d = kstParts(iso);
  if (!d) return UNKNOWN;
  return `${PAD(d.month)}.${PAD(d.day)} ${PAD(d.hour)}:${PAD(d.minute)}`;
}

/** 15:31:02 — AI 로그용 */
export function clock(iso: string): string {
  const d = kstParts(iso);
  if (!d) return UNKNOWN;
  return `${PAD(d.hour)}:${PAD(d.minute)}:${PAD(d.second)}`;
}

/** 3분 전 / 2시간 전 / 09.28 — 기준 시각을 명시적으로 받는다 */
export function relative(iso: string, now: string): string {
  const at = new Date(iso).getTime();
  const base = new Date(now).getTime();
  if (Number.isNaN(at) || Number.isNaN(base)) return UNKNOWN;

  const diff = (base - at) / 1000;
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 172800) return "어제";
  if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
  return stamp(iso).slice(0, 5);
}
