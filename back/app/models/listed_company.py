"""상장사 ORM 모델."""

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ListedCompany(TimestampMixin, Base):
    """KRX / KIND에서 수집한 상장사 한 건.

    `search_name`과 `search_symbol`은 정규화된 검색용 사본이다. 원본 코드는 매 자동완성
    요청마다 전체 행을 파이썬으로 끌어와 정규화·정렬했는데, 정규화 결과를 컬럼으로
    저장하면 필터링을 SQL로 내릴 수 있다.
    """

    __tablename__ = "listed_companies"

    id: Mapped[int] = mapped_column(primary_key=True)
    symbol: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160))
    market: Mapped[str | None] = mapped_column(String(40), nullable=True)

    search_symbol: Mapped[str] = mapped_column(String(20), index=True, default="")
    search_name: Mapped[str] = mapped_column(String(160), index=True, default="")
    initial_consonants: Mapped[str] = mapped_column(String(160), index=True, default="")

    def __repr__(self) -> str:  # pragma: no cover - 디버깅용
        return f"<ListedCompany {self.symbol} {self.name}>"
