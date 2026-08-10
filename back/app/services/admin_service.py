"""관리자 서비스 — 회원 관리와 운영 현황.

## 이 파일이 지키는 것은 화면이 아니라 **되돌릴 수 없는 일의 안전장치**다

관리자가 할 수 있는 일은 둘 다 되돌릴 수 없다: 권한 변경과 계정 삭제. 그래서 규칙을
화면이 아니라 여기에 둔다 — 화면의 버튼을 감추는 것은 보안이 아니고, API 는 화면 없이도
불릴 수 있다.

    ① 마지막 관리자는 강등되지 않는다     아무도 못 들어가는 상태를 만들 수 없다
    ② 자기 자신은 강등하지 않는다         ①을 우회하는 가장 흔한 실수다
    ③ 모든 행위가 같은 트랜잭션에 기록된다 "권한은 바뀌었는데 기록이 없다" 가 불가능하다
    ④ 실패도 기록한다                     거절된 시도가 안 보이면 공격을 못 본다

## 부트스트랩(첫 관리자)은 여기 없다

`ADMIN_EMAILS` 로 씨앗을 두는 것은 **프런트**다(`front/src/lib/auth/admin.ts`).
세션을 보는 쪽이 거기이고, 그 목록은 DB 와 무관하게 항상 관리자로 인정되는
복구용 마스터키다 — 실수로 자기 권한을 지워도 잠기지 않는 이유가 그것이다.

여기서는 그 사실을 **알 필요가 없다.** 이 서비스는 "요청이 관리자에게서 왔다" 를
전제로 동작하고, 그 전제를 세우는 것은 프런트의 `requireAdmin()` 과 `X-Admin-Key`
두 겹이다 (`api/auth.require_admin_key` 주석).
"""

import logging
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.repositories.admin import AdminRepository, AdminUserRow
from app.repositories.listed_company import ListedCompanyRepository
from app.services import advice_cache

logger = logging.getLogger(__name__)

#: 허용 권한. 열거를 DB 타입이 아니라 여기 두는 이유는 마이그레이션에 적었다.
ROLES = ("user", "admin")

ADMIN_ROLE = "admin"

#: 감사 로그의 `action` 값. 문자열을 흩어 쓰면 오타가 조용히 다른 행위가 된다.
ACTION_ROLE_GRANT = "role.grant"
ACTION_ROLE_REVOKE = "role.revoke"
ACTION_USER_DELETE = "user.delete"


class AdminError(RuntimeError):
    """관리자 요청을 거절한 이유. 메시지가 그대로 화면에 나간다."""


class UsersUnavailable(AdminError):
    """`users` 를 읽을 수 없다 — 판단 근거가 없으므로 아무것도 하지 않는다."""


@dataclass
class Actor:
    """행위를 한 관리자. 감사 로그에 그대로 박힌다."""

    user_id: str
    email: str | None


@dataclass
class UserPage:
    rows: list[AdminUserRow]
    total: int
    admin_count: int


@dataclass
class DeleteReport:
    """무엇이 함께 사라졌는지. 화면이 "관심종목 12건도 지워졌습니다" 를 말할 근거."""

    deleted: dict[str, int]

    @property
    def owned_rows(self) -> int:
        return sum(count for table, count in self.deleted.items() if table != "users")


async def list_users(
    repo: AdminRepository, *, keyword: str = "", limit: int = 50, offset: int = 0
) -> UserPage:
    """회원 한 페이지 + 전체 건수 + 관리자 수.

    `admin_count` 를 함께 내는 것은 화면이 **마지막 관리자의 강등 버튼을 미리
    비활성화**할 수 있게 하기 위해서다. 서버가 어차피 막지만, 누를 수 있는 버튼을
    두고 눌렀을 때 거절하는 것은 나쁜 화면이다.
    """
    if not await repo.users_are_readable():
        raise UsersUnavailable(
            "users 테이블을 읽을 수 없습니다. 백엔드가 프런트와 같은 Supabase 를 "
            "보고 있는지, NextAuth 마이그레이션(b3f1c2d47a90)이 적용됐는지 확인하세요."
        )

    return UserPage(
        rows=await repo.list_users(keyword=keyword, limit=limit, offset=offset),
        total=await repo.count_users(keyword),
        admin_count=await repo.count_admins(),
    )


async def set_role(
    session: AsyncSession, repo: AdminRepository, *, actor: Actor, user_id: str, role: str
) -> AdminUserRow:
    """권한을 바꾼다. 거절 사유는 예외 메시지로 나간다.

    거절도 **기록한다** — 누가 마지막 관리자를 계속 강등하려 하는지는 봐야 할 신호다.
    """
    if role not in ROLES:
        raise AdminError(f"알 수 없는 권한입니다: {role!r}")

    target = await repo.find_user(user_id)
    if target is None:
        raise AdminError("그 회원을 찾을 수 없습니다.")

    if target.role == role:
        # 바뀌는 것이 없으면 기록도 남기지 않는다. 같은 값을 다시 눌러 로그가
        # 부풀면, 진짜 변경이 그 사이에 묻힌다.
        return target

    granting = role == ADMIN_ROLE
    action = ACTION_ROLE_GRANT if granting else ACTION_ROLE_REVOKE

    reason = await _refuse_revocation(repo, actor=actor, target=target, granting=granting)
    if reason:
        await repo.record(
            actor_user_id=actor.user_id,
            actor_email=actor.email,
            action=action,
            target_user_id=target.id,
            target_email=target.email,
            detail=f"거절: {reason}",
            ok=False,
        )
        await session.commit()
        raise AdminError(reason)

    await repo.set_role(user_id, role)
    await repo.record(
        actor_user_id=actor.user_id,
        actor_email=actor.email,
        action=action,
        target_user_id=target.id,
        target_email=target.email,
        detail=f"{target.role} → {role}",
    )
    # 권한 변경과 기록이 **한 트랜잭션**이다. 나눠 커밋하면 그 사이에 프로세스가
    # 죽었을 때 "권한은 바뀌었는데 기록이 없는" 행이 남는다.
    await session.commit()

    logger.warning(
        "권한 변경: %s → %s (대상 %s, 실행 %s)",
        target.role,
        role,
        target.email or target.id,
        actor.email or actor.user_id,
    )
    return await repo.find_user(user_id) or target


async def _refuse_revocation(
    repo: AdminRepository, *, actor: Actor, target: AdminUserRow, granting: bool
) -> str | None:
    """강등을 거절할 이유. 없으면 None.

    **부여(grant)는 막지 않는다.** 관리자가 늘어나는 것으로 잠기는 일은 없다.
    막아야 하는 것은 줄어드는 방향뿐이다.
    """
    if granting:
        return None

    if target.id == actor.user_id:
        # ①의 우회를 막는 것이기도 하다. 관리자가 둘일 때 서로를 강등하는 것은
        # 막을 수 없지만(그건 권한 있는 사람의 판단이다), 자기 자신을 지우는 것은
        # 거의 항상 실수다 — 되돌리려면 방금 잃은 권한이 필요하다.
        return "자기 자신의 관리자 권한은 회수할 수 없습니다. 다른 관리자에게 요청하세요."

    if await repo.count_admins() <= 1:
        return "마지막 관리자입니다. 먼저 다른 관리자를 지정하세요."

    return None


async def delete_user(
    session: AsyncSession, repo: AdminRepository, *, actor: Actor, user_id: str
) -> DeleteReport:
    """회원과 그 사람의 데이터를 지운다.

    ## 고아를 남기지 않는다

    관심종목·투자 성향은 소유자를 **외래키가 아니라 문자열**로 든다(익명이 로그인보다
    먼저 존재할 수 있어야 해서 내린 선택이다). 그 대가로 `users` 행만 지우면 그 사람의
    데이터가 그대로 남는다 — `scripts/cleanup_orphans` 가 나중에 치워야 할 빚이 되고,
    그 스크립트 주석이 정확히 이 자리를 예고해 두었다:

        "계정 삭제 화면이 생기면 그 경로에서 sweep_orphans 를 바로 부르면 된다"

    실제로는 `sweep_orphans`(전체 훑기)를 부르지 않고 **이 사람의 행만** 지운다.
    삭제 한 번에 전 테이블을 훑을 이유가 없고, 같은 트랜잭션 안이라 원자적이다.
    전체 훑기는 여전히 스크립트의 몫이다 — DB 를 직접 만진 경우를 대비한 그물이다.
    """
    target = await repo.find_user(user_id)
    if target is None:
        raise AdminError("그 회원을 찾을 수 없습니다.")

    if target.id == actor.user_id:
        return await _refuse_delete(
            session, repo, actor=actor, target=target,
            reason="자기 계정은 관리자 화면에서 삭제할 수 없습니다.",
        )

    if target.role == ADMIN_ROLE and await repo.count_admins() <= 1:
        return await _refuse_delete(
            session, repo, actor=actor, target=target,
            reason="마지막 관리자입니다. 먼저 다른 관리자를 지정하세요.",
        )

    counts = await repo.delete_user(user_id)
    report = DeleteReport(deleted=counts)

    await repo.record(
        actor_user_id=actor.user_id,
        actor_email=actor.email,
        action=ACTION_USER_DELETE,
        target_user_id=target.id,
        target_email=target.email,
        detail=(
            f"관심종목 {counts.get('watchlist_items', 0)}건 · "
            f"투자성향 {counts.get('investor_profiles', 0)}건 함께 삭제"
        ),
    )
    await session.commit()

    logger.warning(
        "회원 삭제: %s (관심종목 %d · 투자성향 %d, 실행 %s)",
        target.email or target.id,
        counts.get("watchlist_items", 0),
        counts.get("investor_profiles", 0),
        actor.email or actor.user_id,
    )
    return report


async def _refuse_delete(
    session: AsyncSession,
    repo: AdminRepository,
    *,
    actor: Actor,
    target: AdminUserRow,
    reason: str,
) -> DeleteReport:
    """거절을 기록하고 올린다. 성공만 남기면 그 시도는 없던 일이 된다."""
    await repo.record(
        actor_user_id=actor.user_id,
        actor_email=actor.email,
        action=ACTION_USER_DELETE,
        target_user_id=target.id,
        target_email=target.email,
        detail=f"거절: {reason}",
        ok=False,
    )
    await session.commit()
    raise AdminError(reason)


# ── 운영 현황 ──────────────────────────────────────────────────────────────


@dataclass
class OpsSnapshot:
    """관리자 첫 화면이 보여줄 숫자들.

    **여기 있는 것은 전부 지금까지 DB 를 직접 쳐야만 보이던 값들이다.** 17회차 내내
    스크립트로 확인하던 것이고, 그 사실 자체가 이 화면이 필요한 이유다.
    """

    #: 일정(실적발표·배당락)을 한 번이라도 받은 종목 / 배치 모집단
    calendar_covered: int
    calendar_universe: int
    #: PER·PBR 을 받은 종목 / 같은 모집단
    fundamentals_covered: int
    #: 시가총액이 채워진 종목
    market_cap_covered: int
    #: 마지막 배치 시각 (ISO). 한 번도 안 돌았으면 None
    last_calendar_batch: str | None
    last_fundamentals_batch: str | None
    #: AI 판단 캐시 현황. 돈이 나가는 유일한 경로의 관측 지점이다
    advice_cached: int
    advice_capacity: int
    advice_in_flight: int
    advice_max_concurrent: int
    #: 자물쇠 상태. 꺼져 있다는 사실이 화면에 보여야 한다
    advice_locked: bool
    rag_enabled: bool
    generated_at: str


async def get_ops_snapshot(listings: ListedCompanyRepository) -> OpsSnapshot:
    """운영 현황 한 벌.

    배치를 **돌리지 않는다.** 관리자 화면을 여는 것만으로 야후에 2,700회를 치면
    안 되고, 그 상한은 17회차에 실측으로 배웠다(1회 ~500종목). 여기서는 적재된
    값을 읽기만 한다.
    """
    calendar_covered, universe = await listings.calendar_coverage()
    fundamentals_covered, _ = await listings.screener_coverage()
    last_calendar = await listings.latest_calendar_update()
    last_fundamentals = await listings.latest_fundamentals_update()
    caps = await listings.count_with_market_cap()

    stats = advice_cache.stats()

    return OpsSnapshot(
        calendar_covered=calendar_covered,
        calendar_universe=universe,
        fundamentals_covered=fundamentals_covered,
        market_cap_covered=caps,
        last_calendar_batch=last_calendar.isoformat() if last_calendar else None,
        last_fundamentals_batch=last_fundamentals.isoformat() if last_fundamentals else None,
        advice_cached=stats.cached,
        advice_capacity=stats.capacity,
        advice_in_flight=stats.in_flight,
        advice_max_concurrent=settings.advice_max_concurrent,
        advice_locked=settings.advice_auth_enabled,
        rag_enabled=settings.rag_enabled,
        generated_at=datetime.now(UTC).isoformat(timespec="seconds"),
    )
