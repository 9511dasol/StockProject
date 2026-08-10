"use server";

import { deleteUser, updateRole } from "@/features/admin";
import { ApiError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/admin";
import type { Role } from "@/features/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/**
 * 관리자 변경 동작 — 권한 수정과 회원 삭제.
 *
 * ## 가드가 **여기에도** 있는 이유
 *
 * 화면(`page.tsx`)이 이미 `requireAdmin()` 을 부르지만, 서버 액션은 **화면과 별개의
 * 진입점**이다. 브라우저는 액션 ID 로 직접 POST 할 수 있고 그때 페이지 컴포넌트는
 * 실행되지 않는다. 즉 화면의 가드는 이 함수를 보호하지 못한다.
 *
 * "메뉴를 숨기는 것은 보안이 아니다" 와 같은 말이고, 서버 액션 버전이다.
 *
 * ## 실패를 예외로 던지지 않고 **주소로 옮긴다**
 *
 * 백엔드의 거절 메시지("마지막 관리자입니다")는 사용자에게 그대로 보여줄 말이다.
 * 예외로 던지면 error.tsx 의 일반 오류 화면이 되어 그 문장이 사라진다. 그래서
 * `?error=` 로 되돌려 보내고 화면이 읽는다 — 로그인 실패를 `/login?error=` 로
 * 받는 것과 같은 방식이다.
 */

function backTo(userId: string, params: Record<string, string>): never {
  const query = new URLSearchParams(params).toString();
  redirect(`/admin/users/${encodeURIComponent(userId)}${query ? `?${query}` : ""}`);
}

/** 백엔드가 준 거절 사유. 없으면 일반 문장으로 떨어뜨린다. */
function reasonOf(error: unknown): string {
  if (error instanceof ApiError && error.message) return error.message;
  return "처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

export async function changeRoleAction(formData: FormData): Promise<void> {
  const actor = await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!userId || (role !== "user" && role !== "admin")) {
    backTo(userId, { error: "요청이 올바르지 않습니다." });
  }

  try {
    await updateRole(actor, userId, role as Role);
  } catch (error) {
    backTo(userId, { error: reasonOf(error) });
  }

  // 목록도 함께 무효화한다 — 권한 뱃지와 관리자 수가 그 화면에 있다.
  revalidatePath("/admin/users");
  backTo(userId, { done: role === "admin" ? "granted" : "revoked" });
}

export async function deleteUserAction(formData: FormData): Promise<void> {
  const actor = await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const typed = String(formData.get("confirmEmail") ?? "").trim();
  const expected = String(formData.get("expectedEmail") ?? "").trim();

  // **이메일을 직접 입력하게 한다.** 확인 버튼 하나는 습관적으로 눌린다 —
  // 되돌릴 수 없는 일에는 "지금 무엇을 지우는지" 를 손으로 쓰게 하는 마찰이 필요하다.
  if (!expected || typed.toLowerCase() !== expected.toLowerCase()) {
    backTo(userId, {
      confirm: "delete",
      error: "이메일이 일치하지 않습니다. 지울 계정의 이메일을 그대로 입력하세요.",
    });
  }

  try {
    await deleteUser(actor, userId);
  } catch (error) {
    backTo(userId, { confirm: "delete", error: reasonOf(error) });
  }

  revalidatePath("/admin/users");
  // 지워진 회원의 상세로 돌아갈 수 없다 — 목록으로 보낸다.
  redirect("/admin/users?done=deleted");
}
