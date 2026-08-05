import { apiSend, ApiError } from "@/lib/api";
import { readOwnerKey } from "@/lib/watchlist/owner";
import { NextResponse } from "next/server";

/** 관심종목 BFF — 개별 종목 제거·수정. */

export const dynamic = "force-dynamic";

/** Next 16 은 동적 세그먼트를 Promise 로 준다 — 라우트 핸들러도 await 한다. */
interface RouteContext {
  params: Promise<{ code: string }>;
}

function unauthorized() {
  return NextResponse.json(
    { error: "소유자 식별자가 없습니다. 새로고침해 주세요." },
    { status: 401 },
  );
}

function toResponse(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json(
    { error: "관심종목 서버에 연결하지 못했습니다." },
    { status: 502 },
  );
}

export async function DELETE(_request: Request, context: RouteContext) {
  const owner = await readOwnerKey();
  if (!owner) return unauthorized();

  const { code } = await context.params;

  try {
    return NextResponse.json(
      await apiSend("delete", `/watchlist/${code}`, undefined, {
        headers: { "X-Owner-Key": owner },
      }),
    );
  } catch (error) {
    return toResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const owner = await readOwnerKey();
  if (!owner) return unauthorized();

  const { code } = await context.params;
  // 본문을 그대로 흘려보낸다. 여기서 필드를 재조립하면 "보내지 않음"과 "명시적
  // null"의 구분이 무너지고, 그룹만 바꾸려는 요청이 보유 정보를 지우게 된다
  // (백엔드 watchlist_service.patch_item 주석).
  const body = await request.json().catch(() => ({}));

  try {
    return NextResponse.json(
      await apiSend("patch", `/watchlist/${code}`, body, {
        headers: { "X-Owner-Key": owner },
      }),
    );
  } catch (error) {
    return toResponse(error);
  }
}
