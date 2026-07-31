"""yfinance 지연 로딩과 공용 헬퍼.

yfinance는 동기 블로킹 라이브러리다. 이 패키지의 함수는 모두 동기이며, 서비스 계층이
`asyncio.to_thread`로 감싸 호출한다 — 이벤트 루프를 막지 않는 경계를 한 곳에 모았다.
"""

import logging
from typing import Any

from app.core.exceptions import ProviderUnavailableError
from app.domain.symbols import is_usable_stock_name

logger = logging.getLogger(__name__)


def load_yfinance() -> Any:
    """import 실패를 도메인 예외로 변환한다."""
    try:
        import yfinance as yf
    except ImportError as exc:  # pragma: no cover - 설치 환경에 의존
        raise ProviderUnavailableError("yfinance 패키지가 설치되어 있지 않습니다.") from exc

    return yf


def get_stock_name(ticker: Any, fallback: str) -> str:
    """`ticker.info`는 느리고 자주 실패한다 — 실패 시 조용히 fallback을 쓴다.

    성공해도 값을 그대로 믿지 않는다. 야후에 없는 심볼이면 `shortName`에
    검색 결과가 섞여 나와("247540.KS,0P0001GZPV,623889") 그게 화면 제목이
    된다 — 이름 검증(`is_usable_stock_name`)을 통과한 값만 내보낸다.
    """
    try:
        info = ticker.info
    except Exception as exc:
        logger.debug("ticker.info 조회 실패 (%s) → fallback=%r", exc, fallback)
        return fallback

    name = info.get("shortName") or info.get("longName")
    if is_usable_stock_name(name, fallback):
        return str(name).strip()

    if name:
        logger.info("%s 의 shortName 이 이름 형태가 아닙니다 (%r) → fallback", fallback, name)
    return fallback
