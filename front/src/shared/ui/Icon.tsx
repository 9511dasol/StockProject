import {
  BiBarChartAlt2,
  BiBell,
  BiBellOff,
  BiBrain,
  BiCaretDown,
  BiCaretUp,
  BiCheck,
  BiChevronDown,
  BiCompass,
  BiFilterAlt,
  BiGridVertical,
  BiHome,
  BiLeftArrowAlt,
  BiMinus,
  BiPlus,
  BiRefresh,
  BiRightArrowAlt,
  BiSearch,
  BiSolidStar,
  BiSortDown,
  BiStar,
  BiUser,
  BiX,
} from "react-icons/bi";
import type { IconType } from "react-icons";

/**
 * 아이콘 프리미티브 — BoxIcons(react-icons/bi) 를 감싸는 유일한 지점.
 *
 * 핸드오프 README 161행: "아이콘은 전용 에셋 없이 텍스트 글리프로 표현했습니다.
 * 구현 시 코드베이스의 아이콘 세트로 교체하세요. 크기는 12~17px, 색은 muted 계열."
 *
 * 왜 한 파일로 묶었나
 * - 다른 모듈은 react-icons 를 직접 import 하지 않는다. 아이콘 세트를 갈아끼울 때
 *   고칠 파일이 이 하나다 (CONVENTIONS: 경계는 index.ts 로만 노출).
 * - 이름을 REGISTRY 키에서 파생시켜 오타가 타입 에러가 된다. 문자열 유니온을
 *   따로 적어두면 레지스트리와 어긋나는 순간을 아무도 못 잡는다.
 * - react-icons 컴포넌트는 훅 없는 순수 SVG 함수라 서버 컴포넌트에서 그대로
 *   렌더된다. 'use client' 가 필요 없고, 웹폰트가 아니라 FOUT/CLS 도 없다.
 *
 * 색은 currentColor 를 그대로 상속한다 — 호출부가 text-muted-50 같은 토큰
 * 클래스를 이미 쓰고 있고, 여기서 색을 박으면 반전 배경(bg-ink)에서 어긋난다.
 */
const REGISTRY = {
  search: BiSearch,
  close: BiX,
  home: BiHome,
  star: BiStar,
  "star-filled": BiSolidStar,
  ai: BiBrain,
  plus: BiPlus,
  minus: BiMinus,
  drag: BiGridVertical,
  bell: BiBell,
  "bell-off": BiBellOff,
  "caret-up": BiCaretUp,
  "caret-down": BiCaretDown,
  "arrow-left": BiLeftArrowAlt,
  "arrow-right": BiRightArrowAlt,
  "chevron-down": BiChevronDown,
  check: BiCheck,
  retry: BiRefresh,
  chart: BiBarChartAlt2,
  compass: BiCompass,
  /** 모집단을 자르는 축 (종목 탐색의 '시장' 필터) */
  filter: BiFilterAlt,
  /** 순서를 바꾸는 축. 이 서비스의 정렬은 전부 내림차순이라 down 하나면 된다 */
  "sort-desc": BiSortDown,
  /** 계정 — 제호 우측의 로그인 표시 */
  user: BiUser,
} as const satisfies Record<string, IconType>;

/** 레지스트리에 있는 이름만 허용한다 — 새 아이콘은 위에 등록해야 쓸 수 있다. */
export type IconName = keyof typeof REGISTRY;

export interface IconProps {
  name: IconName;
  /** 핸드오프 스펙 12~17px. 기본 14. */
  size?: number;
  className?: string;
  /**
   * 접근성 이름. 생략하면 장식으로 간주해 aria-hidden 이 붙는다.
   * 옆에 텍스트 라벨이 있거나 감싼 버튼에 aria-label 이 있으면 생략이 맞다 —
   * 아이콘까지 이름을 가지면 스크린리더가 같은 말을 두 번 읽는다.
   */
  label?: string;
}

export function Icon({ name, size = 14, className, label }: IconProps) {
  const Glyph = REGISTRY[name];
  return (
    <Glyph
      size={size}
      className={className}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      focusable="false"
    />
  );
}
