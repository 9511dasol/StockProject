import { apiGet, apiPost, ApiError } from "@/lib/api";
import { readOwnerKey } from "@/lib/watchlist/owner";
import { NextResponse } from "next/server";

/**
 * 관심종목 BFF — 조회·추가.
 *
 * 브라우저는 FastAPI 를 직접 부르지 않는다(CONVENTIONS). 그 규칙이 여기서 값을
 * 하는 지점이 하나 더 있다: **소유자 키가 브라우저를 거치지 않는다.** 쿠키는
 * httpOnly 라 JS 가 읽지 못하고, 헤더로 옮기는 일은 이 서버 코드가 한다.
 */

export const dynamic = "force-dynamic";

/** 신원이 없으면 401. 빈 목록으로 얼버무리면 화면이 "비었다"와 구분하지 못한다. */
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

export async function GET() {
  const owner = await readOwnerKey();
  if (!owner) return unauthorized();

  try {
    return NextResponse.json(
      await apiGet("/watchlist", { headers: { "X-Owner-Key": owner } }),
    );
  } catch (error) {
    return toResponse(error);
  }
}

export async function POST(request: Request) {
  const owner = await readOwnerKey();
  if (!owner) return unauthorized();

  const { symbol = "", group } = (await request.json().catch(() => ({}))) as {
    symbol?: string;
    group?: string;
  };

  try {
    return NextResponse.json(
      await apiPost(
        "/watchlist",
        { symbol, group },
        { headers: { "X-Owner-Key": owner } },
      ),
    );
  } catch (error) {
    return toResponse(error);
  }
}
