"""공용 의존성. 엔드포인트는 여기 있는 Annotated 별칭만 쓴다."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.repositories.listed_company import ListedCompanyRepository

DbSession = Annotated[AsyncSession, Depends(get_db)]


def get_listed_company_repository(db: DbSession) -> ListedCompanyRepository:
    return ListedCompanyRepository(db)


ListedCompanyRepo = Annotated[ListedCompanyRepository, Depends(get_listed_company_repository)]
