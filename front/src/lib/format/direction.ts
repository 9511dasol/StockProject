// 등락 방향 → 색·기호. 국내 관례로 상승 빨강 / 하락 파랑.
//
// 이 파일이 색 분기의 유일한 소유자다. 컴포넌트에서 value > 0 ? "text-up" : ... 를
// 다시 쓰지 말 것 — 글로벌 사용자용 색 반전 토글이 생기면 여기만 고치면 된다.

export type Direction = "up" | "down" | "flat";

export function direction(value: number): Direction {
  if (value > 0) return "up";
  if (value < 0) return "down";
  return "flat";
}

/** ▲ / ▼ / — */
export function directionGlyph(value: number): string {
  const d = direction(value);
  return d === "up" ? "▲" : d === "down" ? "▼" : "—";
}

/**
 * 등락 색 클래스. `inverted` 는 반전 배경(bg-ink) 위에서 쓴다.
 * Delta·StatRow 프리미티브 안에서만 호출한다.
 */
export function deltaColorClass(value: number, inverted = false): string {
  const d = direction(value);
  if (d === "flat") return inverted ? "text-on-ink-75" : "text-muted-60";
  if (inverted) return d === "up" ? "text-up-on-ink" : "text-down-on-ink";
  return d === "up" ? "text-up" : "text-down";
}

/**
 * 등락 **배경** 색. 업종 등락 막대처럼 글자가 아니라 면을 칠하는 자리용이다.
 *
 * Delta 는 글자 전용이라 이 자리를 대신할 수 없다. 그렇다고 컴포넌트가
 * `value > 0 ? "bg-up" : "bg-down"` 를 직접 쓰면 보합(0)이 하락으로 칠해져
 * 바로 옆 숫자(deltaColorClass 는 0 을 muted 로 준다)와 색이 어긋난다.
 * 그래서 분기를 이 파일에 함께 둔다 — 방향 판정의 소유자는 하나여야 한다.
 */
export function deltaBgClass(value: number): string {
  const d = direction(value);
  if (d === "flat") return "bg-muted-30";
  return d === "up" ? "bg-up" : "bg-down";
}
