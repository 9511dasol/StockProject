"""Postgres 방언 회귀 — **테스트가 SQLite 로 도는 한 여기서만 잡힌다.**

테스트 하네스는 인메모리 SQLite 를 쓴다(빠르고 네트워크가 없다). 그 대가는
**방언 차이를 못 잡는다**는 것이고, 실제로 그렇게 새어 나간 버그가 있었다:

    ORDER BY market_cap DESC

SQLite 는 NULL 을 가장 작은 값으로 보므로 시총 미수집 종목이 뒤로 밀린다.
Postgres 는 `DESC` 의 기본이 `NULLS FIRST` 라 **맨 앞을 채운다.** 등락률 랭킹의
모집단 200종목이 시총 없는 종목으로 채워졌는데, 오류가 나지 않아 조용했다.

그래서 이 파일은 쿼리를 **실행하지 않고 Postgres 방언으로 컴파일해서** 본다.
SQLite 위에서 돌면서도 운영 DB 의 SQL 을 검사할 수 있는 유일한 방법이다.
"""

import pytest
from sqlalchemy import or_, select
from sqlalchemy.dialects import postgresql

from app.models.listed_company import ListedCompany


def _pg_sql(stmt) -> str:
    return str(stmt.compile(dialect=postgresql.dialect()))


def test_market_cap_ranking_puts_nulls_last_on_postgres() -> None:
    """`top_by_market_cap` 의 정렬이 NULLS LAST 를 명시하는지.

    리포지토리의 쿼리와 같은 형태를 여기서 다시 만들지 않고, 실제 메서드가 만드는
    SQL 을 봐야 의미가 있다 — 아래 `test_repository_query_is_the_one_checked` 가
    그 연결을 지킨다.
    """
    stmt = (
        select(ListedCompany)
        .where(or_(ListedCompany.symbol.like("%.KS"), ListedCompany.symbol.like("%.KQ")))
        .order_by(ListedCompany.market_cap.desc().nullslast(), ListedCompany.symbol)
    )

    assert "DESC NULLS LAST" in _pg_sql(stmt)


async def test_repository_query_is_the_one_checked(repo, monkeypatch) -> None:
    """리포지토리가 **실제로** 내보내는 SQL 에 NULLS LAST 가 있는지 가로채 확인한다.

    위 테스트만 있으면 리포지토리에서 `nullslast()` 를 지워도 초록이다 — 검사 대상이
    테스트 안에서 다시 만든 쿼리이기 때문이다. 여기서는 실행 직전의 statement 를
    붙잡아 그 구멍을 막는다.
    """
    captured: list[str] = []
    original = repo._db.execute

    async def spy(stmt, *args, **kwargs):
        captured.append(_pg_sql(stmt))
        return await original(stmt, *args, **kwargs)

    monkeypatch.setattr(repo._db, "execute", spy)
    await repo.top_by_market_cap(limit=5)

    assert captured, "쿼리가 실행되지 않았다"
    assert "DESC NULLS LAST" in captured[0], (
        f"top_by_market_cap 이 NULLS LAST 없이 정렬한다 — Postgres 에서 시총 "
        f"미수집 종목이 랭킹 앞을 채운다.\n{captured[0]}"
    )


def test_sqlite_database_url_is_rejected_by_settings() -> None:
    """설정이 SQLite 주소를 기동 시점에 막는지.

    조용히 받아 주면 앱은 뜨고 방언 차이만 런타임에 흩어져 나타난다.
    """
    from app.core.config import Settings

    with pytest.raises(ValueError, match="Postgres"):
        Settings(database_url="sqlite+aiosqlite:///./stock.db")


def test_postgres_database_url_is_accepted() -> None:
    from app.core.config import Settings

    url = "postgresql://u:p@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres"
    assert Settings(database_url=url).database_url == url
