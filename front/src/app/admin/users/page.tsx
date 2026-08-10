import { fetchUsers, UserTable } from "@/features/admin";
import { ApiError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/admin";
import { Icon } from "@/shared/ui";
import { AdminShell } from "../_components/AdminShell";
import { AdminUnavailable } from "../_components/AdminUnavailable";

/** 관리자 · 회원 관리. 현황과 같은 이유로 캐시하지 않는다. */
export const dynamic = "force-dynamic";

interface AdminUsersPageProps {
  searchParams: Promise<{ q?: string; done?: string }>;
}

const DONE_MESSAGES: Record<string, string> = {
  deleted: "회원을 삭제했습니다. 그 계정의 관심종목·투자 성향도 함께 지워졌습니다.",
};

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const actor = await requireAdmin();
  const { q = "", done } = await searchParams;

  let page;
  try {
    page = await fetchUsers(actor, { q });
  } catch (error) {
    return (
      <AdminShell actor={actor} current="users">
        <AdminUnavailable error={error instanceof ApiError ? error : null} />
      </AdminShell>
    );
  }

  return (
    <AdminShell actor={actor} current="users">
      {done && DONE_MESSAGES[done] ? (
        <p
          role="status"
          className="flex items-start gap-2 border border-line-35 px-3 py-3 text-muted-70"
          style={{ fontSize: 12.5, lineHeight: 1.6 }}
        >
          <Icon name="check" size={15} className="mt-0.5 flex-none text-muted-45" />
          {DONE_MESSAGES[done]}
        </p>
      ) : null}

      {/* 검색은 **GET 폼**이다 — 결과가 URL 에 남아 공유·뒤로가기가 그대로 되고,
          이 화면에서 브라우저로 내려가는 JS 가 0 이다 (조건 검색 칩과 같은 판단). */}
      <form action="/admin/users" method="get" className="flex items-center gap-2 pt-1">
        <label htmlFor="q" className="sr-only">
          이메일 또는 이름으로 검색
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="이메일 · 이름"
          className="min-h-[var(--tap)] flex-1 border border-line-control bg-field px-3 py-2 md:min-h-0 md:max-w-[320px]"
          style={{ fontSize: 13 }}
        />
        <button
          type="submit"
          className="flex min-h-[var(--tap)] items-center gap-1.5 border border-ink px-3 py-2 font-medium hover:bg-ink hover:text-on-ink md:min-h-0"
          style={{ fontSize: 13 }}
        >
          <Icon name="search" size={14} />
          찾기
        </button>
      </form>

      <p className="num text-muted-45" style={{ fontSize: 10.5 }}>
        전체 {page.total.toLocaleString("ko-KR")}명 · 관리자 {page.adminCount}명
      </p>

      <UserTable rows={page.rows} total={page.total} />
    </AdminShell>
  );
}
