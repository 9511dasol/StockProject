"""공용 의존성. 엔드포인트는 여기 있는 Annotated 별칭만 쓴다."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import require_advice_key
from app.core.database import get_db
from app.repositories.listed_company import ListedCompanyRepository

DbSession = Annotated[AsyncSession, Depends(get_db)]


def get_listed_company_repository(db: DbSession) -> ListedCompanyRepository:
    return ListedCompanyRepository(db)


ListedCompanyRepo = Annotated[ListedCompanyRepository, Depends(get_listed_company_repository)]

# 토큰을 쓰는 엔드포인트에만 붙인다 (app/api/auth.py 주석).
# 값을 쓰지 않는 의존성이라 `dependencies=[...]` 가 아니라 별칭으로 둔 것은,
# 엔드포인트 시그니처만 봐도 잠겨 있다는 게 보이게 하기 위함이다.
AdviceKeyGuard = Annotated[None, Depends(require_advice_key)]
