"""공용 의존성. 엔드포인트는 여기 있는 Annotated 별칭만 쓴다."""

from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import require_advice_key
from app.core.database import get_db
from app.repositories.listed_company import ListedCompanyRepository
from app.repositories.watchlist import WatchlistRepository

DbSession = Annotated[AsyncSession, Depends(get_db)]


def get_listed_company_repository(db: DbSession) -> ListedCompanyRepository:
    return ListedCompanyRepository(db)


ListedCompanyRepo = Annotated[ListedCompanyRepository, Depends(get_listed_company_repository)]


def get_watchlist_repository(db: DbSession) -> WatchlistRepository:
    return WatchlistRepository(db)


WatchlistRepo = Annotated[WatchlistRepository, Depends(get_watchlist_repository)]


async def get_owner_key(
    x_owner_key: str | None = Header(
        default=None,
        alias="X-Owner-Key",
        description="관심종목 소유자. 프런트 BFF 가 httpOnly 쿠키에서 옮겨 붙인다.",
    ),
) -> str:
    """관심종목의 소유자 식별자.

    **인증이 아니라 식별이다.** 남의 키를 알면 그 목록을 볼 수 있다 — 로그인이
    붙기 전까지의 한계이고, 그래서 이 값은 브라우저가 만들지 않고 서버가 발급한
    추측 불가능한 난수다(프런트 `lib/watchlist/owner.ts`).

    없으면 400 이다. 빈 문자열이나 고정값으로 떨어뜨리면 **모든 익명 사용자가 하나의
    목록을 공유**하게 되는데, 그건 비어 보이는 것보다 훨씬 나쁘다.
    """
    key = (x_owner_key or "").strip()
    if not key:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "소유자 식별자(X-Owner-Key)가 필요합니다"
        )
    if len(key) > 80:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "소유자 식별자가 너무 깁니다")
    return key


OwnerKey = Annotated[str, Depends(get_owner_key)]

# 토큰을 쓰는 엔드포인트에만 붙인다 (app/api/auth.py 주석).
# 값을 쓰지 않는 의존성이라 `dependencies=[...]` 가 아니라 별칭으로 둔 것은,
# 엔드포인트 시그니처만 봐도 잠겨 있다는 게 보이게 하기 위함이다.
AdviceKeyGuard = Annotated[None, Depends(require_advice_key)]
