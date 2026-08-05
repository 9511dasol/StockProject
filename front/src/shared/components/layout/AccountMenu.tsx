import Link from "next/link";
import { auth, AUTH_ENABLED, signOut } from "@/auth";
import { Icon } from "@/shared/ui";

/**
 * 제호 우측 컨트롤 덩어리에 들어가는 계정 표시.
 *
 * ## 로그인이 꺼져 있으면 **아무것도 그리지 않는다**
 *
 * 자격 증명이 없는 채로 버튼을 보여 주면 누르는 순간 깨진다. 그보다는 없는 편이
 * 정직하고, 관심종목은 익명 신원으로 그대로 동작하므로 사용자가 잃는 것도 없다.
 * 키가 `.env.local` 에 들어오면 이 컴포넌트가 저절로 나타난다.
 *
 * ## 서버 컴포넌트다
 *
 * 세션을 읽는 데 클라이언트 훅(`useSession`)이 필요 없고, 그러려면 Provider 를
 * 트리에 얹어야 한다. 로그아웃만 form action 으로 처리하면 클라이언트 JS 가 0이다 —
 * 제호는 모든 화면에 있으므로 그 차이가 전 페이지에 적용된다.
 */
export async function AccountMenu() {
  if (!AUTH_ENABLED) return null;

  const session = await auth();

  if (!session?.user) {
    return (
      <Link
        href="/login"
        className="hidden items-center gap-1.5 border border-line-28 px-3 py-2 font-medium hover:border-ink md:flex"
        style={{ fontSize: 13 }}
      >
        <Icon name="user" size={14} className="text-muted-45" />
        로그인
      </Link>
    );
  }

  // 이름이 없는 계정(매직링크로만 가입)은 이메일 앞부분을 쓴다. 그마저 없으면
  // '내 계정' — 빈 자리를 두면 로그인했는지 아닌지 화면에서 알 수 없다.
  const label =
    session.user.name || session.user.email?.split("@")[0] || "내 계정";

  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
      className="hidden items-center gap-2 md:flex"
    >
      <span
        className="max-w-[120px] truncate text-muted-60"
        style={{ fontSize: 12.5 }}
        title={session.user.email ?? undefined}
      >
        {label}
      </span>
      <button
        type="submit"
        className="border border-line-28 px-3 py-2 font-medium hover:border-ink"
        style={{ fontSize: 13 }}
      >
        로그아웃
      </button>
    </form>
  );
}
