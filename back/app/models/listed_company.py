"""상장사 ORM 모델."""

from datetime import date, datetime

from sqlalchemy import BigInteger, Date, DateTime, String
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

    # 오늘의 일정(실적발표·배당락). 시총과 같은 결의 값이다 — 하루 1회 배치가 채우고,
    # 아직 안 채웠거나 공급자에 없는 종목은 NULL 로 남는다.
    #
    # **날짜 자체를 저장하는 이유**: yfinance 는 종목당 1회 호출(~1초)이라 "이번 주에
    # 실적발표가 있는 종목" 을 요청 시점에 찾으려면 전 종목을 훑어야 한다. 미리 적재해
    # 두면 그 질문이 인덱스를 타는 SQL 한 번이 된다.
    #
    # 둘 다 인덱스를 건다. 이 컬럼들의 유일한 용도가 "오늘부터 N일" 범위 조회다.
    next_earnings_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    ex_dividend_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    # 마지막으로 **물어본** 시각이다. 값을 못 받아도 갱신한다 — 그러지 않으면 일정이
    # 없는 종목(대부분)을 배치가 매번 다시 물어보고 영원히 앞으로 나아가지 못한다.
    calendar_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )

    def __repr__(self) -> str:  # pragma: no cover - 디버깅용
        return f"<ListedCompany {self.symbol} {self.name}>"
