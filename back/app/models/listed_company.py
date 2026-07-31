"""상장사 ORM 모델."""

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, String
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

    # 자동완성 랭킹 가중치. 하루 1회 배치로 채우며 실시간성이 필요 없다 —
    # "삼성" 입력에 삼성전자가 먼저 나오게 하는 용도라 스테일해도 순서가 안 바뀐다.
    # 배치 전이거나 KRX에 없는 종목(해외·신규)은 NULL 이고, 랭킹에서 뒤로 밀린다.
    market_cap: Mapped[int | None] = mapped_column(BigInteger, nullable=True, index=True)
    market_cap_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    def __repr__(self) -> str:  # pragma: no cover - 디버깅용
        return f"<ListedCompany {self.symbol} {self.name}>"
