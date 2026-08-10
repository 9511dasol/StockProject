"""요청 밖에서 도는 배경 배치를 띄우는 한 곳.

## 왜 모았나 — 같은 모양이 세 벌이었고 셋이 서로 달랐다

`market_service` · `listed_company_service` · `snapshot_service` 가 각자 "요청을
기다리게 하지 않고 배치를 배경으로 던진다" 를 구현하고 있었다. 뒤 두 개는 주석까지
"같은 모양이다" 라고 적어 둔 사실상 같은 코드였고, 첫 번째만 가드 방식이 달랐다
(TTL 없이 `task.done()` 검사).

그 차이 자체는 의도된 것이다 — 등락률 스캔은 `refresh_movers` 가 스스로 `_is_fresh()`
로 만료를 보므로 스케줄러가 한 번 더 걸면 만료 판정이 두 곳에 생긴다. 문제는 **의도된
차이와 그냥 다른 것을 구별할 수 없다**는 점이었다. 여기서는 `min_interval` 을 주는지가
그 차이를 드러낸다.

## 가드 둘

    ① 같은 이름의 배치가 아직 도는 중이면 띄우지 않는다        (항상)
    ② min_interval 안에 이미 시도했으면 띄우지 않는다          (준 경우만)

②는 **DB 를 보지 않는 메모리 가드**다. 매 요청마다 세션을 열어 "마지막 갱신이
언제였나" 를 확인하면 그 확인이 곧 낭비이므로, 시도 시각만 프로세스가 기억한다.
성공·실패와 무관하게 갱신한다 — 실패했을 때 시각을 그대로 두면 매 요청이 갱신을
예약해 실패를 계속 두드린다.

**프로세스 메모리다.** 재시작하면 비고, 워커가 여럿이면 워커마다 따로 센다. 그
성질은 모으기 전과 똑같다 — 여기서 바꾸지 않았다.

## 예외를 삼키지 않는다

태스크 참조를 붙잡는 이유는 GC 가 실행 중인 태스크를 수거하지 못하게 하기 위함이다.
그런데 참조를 계속 들고 있으면 **asyncio 가 "Task exception was never retrieved" 를
낼 기회도 없어진다** (그 경고는 태스크가 파괴될 때 나온다). 배경 배치가 예외로 죽는
것은 화면에 아무 흔적도 남기지 않으므로, 끝날 때 직접 확인해서 로그로 남긴다 —
조용히 틀리는 것이 가장 나쁘다.
"""

import asyncio
import logging
from collections.abc import Callable, Coroutine
from datetime import UTC, datetime, timedelta
from typing import Any

logger = logging.getLogger(__name__)

#: 이름 → 마지막으로 띄운 태스크. 강한 참조를 유지해 GC 를 막고, 동시에
#: "아직 도는 중인가" 를 판정한다.
_running: dict[str, asyncio.Task[Any]] = {}

#: 이름 → 마지막 '시도' 시각. `min_interval` 을 준 배치만 기록된다.
_last_attempt: dict[str, datetime] = {}


def _finished(name: str, task: asyncio.Task[Any]) -> None:
    """끝난 배치의 결과를 확인한다. 예외면 로그로 올린다."""
    if task.cancelled():
        logger.info("배경 배치 %s 가 취소됐습니다", name)
        return

    error = task.exception()
    if error is not None:
        logger.error("배경 배치 %s 가 예외로 끝났습니다", name, exc_info=error)


def schedule_once(
    name: str,
    factory: Callable[[], Coroutine[Any, Any, Any]],
    *,
    min_interval: timedelta | None = None,
) -> bool:
    """배치를 배경 태스크로 띄운다. 실제로 띄웠으면 True.

    `factory` 는 코루틴을 만드는 함수다 — 코루틴 객체를 직접 받으면 가드에 걸려
    안 띄우는 경우에 "await 되지 않은 코루틴" 경고가 남는다.

    호출부는 반환값을 무시해도 된다. 지금 이 값을 보는 곳은 없지만, "예약됐는가" 는
    호출부가 판단할 수 없는 사실이라(가드는 여기 있다) 돌려준다.
    """
    running = _running.get(name)
    if running is not None and not running.done():
        return False

    if min_interval is not None:
        now = datetime.now(UTC)
        last = _last_attempt.get(name)
        if last is not None and now - last < min_interval:
            return False
        _last_attempt[name] = now

    task = asyncio.create_task(factory(), name=f"background:{name}")
    _running[name] = task
    task.add_done_callback(lambda finished: _finished(name, finished))
    return True
