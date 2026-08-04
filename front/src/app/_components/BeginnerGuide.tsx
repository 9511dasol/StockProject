import Link from "next/link";
import { Icon, type IconName } from "@/shared/ui";

/**
 * "어떤 종목을 볼까요" 진입구 3개.
 *
 * 홈에서만 쓰고 데이터가 하나도 없어(순수 링크) 라우트 전용 `_components/` 에 둔다.
 * 실시간 수치가 붙게 되면 그때 features/ 로 승격한다.
 *
 * 이 블록이 필요한 이유: 지수와 등락률 랭킹만으로는 종목 이름을 모르는 사람이
 * 다음에 뭘 눌러야 할지 알 수 없다. 검색(⌘K)은 이미 답을 아는 사람의 도구다.
 *
 * '큰 회사부터' 를 첫 타일로 두는 것은 의도적이다 — 시가총액순은 가장 덜 흔들리는
 * 정렬이고, 급등 종목을 첫인상으로 주면 초보자에게 추격 매수를 가르치는 셈이 된다.
 *
 * SampleFrame 으로 감싸지 않는다: 세 목적지가 전부 실제 라우트다. 그 뱃지는
 * "이 데이터는 꾸며낸 것" 이라는 뜻이라 내비게이션에 붙이면 의미가 희석된다.
 * 같은 이유로 타일에 종목 수 같은 숫자를 넣지 않는다.
 */

interface Entry {
  href: string;
  icon: IconName;
  title: string;
  hint: string;
}

const ENTRIES: Entry[] = [
  {
    href: "/stocks?sort=market_cap",
    icon: "compass",
    title: "큰 회사부터",
    hint: "시가총액 상위 — 이름을 아는 회사부터 봅니다",
  },
  {
    href: "/stocks?sort=change",
    icon: "caret-up",
    title: "오늘 움직인 종목",
    hint: "등락률 상위 — 오늘 시장이 주목한 종목",
  },
  {
    href: "/watchlist",
    icon: "star",
    title: "관심 종목 만들기",
    hint: "검색에서 ⇥ 로 담아 두고 한눈에 봅니다",
  },
];

export function BeginnerGuide() {
  return (
    <section className="flex flex-col gap-2.5">
      <h2
        className="border-b border-line-20 pb-2 font-mono font-medium uppercase tracking-label"
        style={{ fontSize: 11 }}
      >
        어떤 종목을 볼까요
      </h2>

      {/* gap-px + 배경으로 1px 헤어라인을 만든다 (IndexCards 와 같은 관용구) —
          카드마다 보더를 주면 인접 변이 2px 로 겹친다. */}
      <div className="grid gap-px bg-line-16 md:grid-cols-3">
        {ENTRIES.map((entry) => (
          <Link
            key={entry.href}
            href={entry.href}
            className="flex min-h-[var(--tap)] flex-col justify-center gap-1.5 bg-paper px-4 py-3.5 hover:bg-surface-hover"
          >
            <span className="flex items-center gap-2">
              <Icon name={entry.icon} size={14} className="text-muted-55" />
              <span className="font-medium" style={{ fontSize: 13.5 }}>
                {entry.title}
              </span>
            </span>
            <span
              className="text-muted-60"
              style={{ fontSize: 11.5, lineHeight: 1.45 }}
            >
              {entry.hint}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
