"""관심종목 엔드포인트 (신규 저장소).

라우터는 파라미터 수신과 서비스 호출만 한다 — 비즈니스 로직은 서비스 계층에 있다.

## 소유자를 헤더로 받는 이유

`X-Owner-Key` 헤더 하나가 이 화면의 인증 전부다. 로그인이 아직 없어서(P2 후속)
프런트가 브라우저마다 발급한 익명 ID를 httpOnly 쿠키에 두고, BFF 가 그 값을 헤더로
옮겨 붙인다. 브라우저는 이 헤더를 직접 만들지 않는다 — FastAPI 를 직접 부르지
않기 때문이다(CONVENTIONS).

**이것은 인증이 아니라 식별이다.** 남의 owner_key 를 알면 그 목록을 볼 수 있다.
공개 배포 전에 로그인을 붙여야 하는 이유이고, 그때 이 헤더는 세션에서 파생된
사용자 ID로 바뀐다 — 엔드포인트 시그니처는 그대로다.
"""

import logging

from fastapi import APIRouter, HTTPException, status

from app.api.deps import ListedCompanyRepo, OwnerKey, WatchlistRepo
from app.schemas.watchlist import (
    Watchlist,
    WatchlistAddRequest,
    WatchlistItemPatch,
    WatchlistOrderRequest,
)
from app.services import watchlist_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/watchlist", tags=["watchlist"])


@router.get("", response_model=Watchlist, summary="관심종목 목록 (그룹·순서·시세 포함)")
async def get_watchlist(
    owner: OwnerKey, repo: WatchlistRepo, listings: ListedCompanyRepo
) -> Watchlist:
    return await watchlist_service.get_watchlist(repo, listings, owner)


@router.post("", response_model=Watchlist, summary="관심종목 추가")
async def add_watchlist_item(
    payload: WatchlistAddRequest,
    owner: OwnerKey,
    repo: WatchlistRepo,
    listings: ListedCompanyRepo,
) -> Watchlist:
    """추가 후 **목록 전체**를 돌려준다.

    추가된 한 건만 주면 화면이 그룹 집계·합계를 스스로 다시 계산해야 하고, 그 계산이
    서버와 어긋나는 순간 사용자는 새로고침해야만 맞는 숫자를 본다. 목록은 최대
    200행이라 통째로 주는 비용이 그 위험보다 싸다.
    """
    try:
        await watchlist_service.add_item(
            repo, listings, owner, symbol=payload.symbol, group=payload.group
        )
    except watchlist_service.UnknownSymbolError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except watchlist_service.WatchlistFullError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc

    return await watchlist_service.get_watchlist(repo, listings, owner)


@router.delete("/{code}", response_model=Watchlist, summary="관심종목 제거")
async def remove_watchlist_item(
    code: str, owner: OwnerKey, repo: WatchlistRepo, listings: ListedCompanyRepo
) -> Watchlist:
    # 없는 것을 지우라는 요청을 404 로 만들지 않는다 — 결과 상태("그 종목은 목록에
    # 없다")가 요청자가 원한 그대로다. 연타·재시도가 오류로 보이면 안 된다.
    await repo.remove_by_code(owner, code)
    return await watchlist_service.get_watchlist(repo, listings, owner)


@router.put("/order", response_model=Watchlist, summary="관심종목 순서 변경")
async def reorder_watchlist(
    payload: WatchlistOrderRequest,
    owner: OwnerKey,
    repo: WatchlistRepo,
    listings: ListedCompanyRepo,
) -> Watchlist:
    await repo.reorder(owner, payload.codes)
    return await watchlist_service.get_watchlist(repo, listings, owner)


@router.patch("/{code}", response_model=Watchlist, summary="그룹·알림·보유 수정")
async def patch_watchlist_item(
    code: str,
    payload: WatchlistItemPatch,
    owner: OwnerKey,
    repo: WatchlistRepo,
    listings: ListedCompanyRepo,
) -> Watchlist:
    found = await watchlist_service.patch_item(repo, owner, code, payload)
    if not found:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "관심종목에 없는 종목입니다")

    return await watchlist_service.get_watchlist(repo, listings, owner)
