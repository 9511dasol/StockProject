"""AI 판단 엔드포인트의 자물쇠 — 공유 비밀키 헤더.

## 왜 이것만 잠그나

전 엔드포인트가 공개였고, 그중 **돈이 나가는 것은 둘뿐이다**: `/stocks/advice` 와
`/stocks/advice/stream`. 나머지(`/markets/*`, `/stocks/history`, `/stocks/suggestions`)는
yfinance·KRX 결과라 남이 불러도 우리 토큰이 줄지 않는다. 잠글 이유가 있는 곳만 잠근다 —
전부 잠그면 프런트 서버 컴포넌트의 모든 호출에 키를 실어야 하고, 키가 닿는 표면이
넓어질수록 새어나갈 곳도 많아진다.

## 왜 로그인이 아니라 공유 키인가

제대로 된 답은 사용자 인증이지만, 그건 `auth.ts`가 `providers: []`인 지금 상태에서
관심종목 실데이터화(P2)를 통째로 끌고 들어온다. 반면 지금 막아야 하는 위협은
"외부에서 남이 우리 토큰을 태우는 것" 하나이고, 여기에는 **프런트 BFF만 아는 키**로
충분하다. 이 프로젝트는 이미 "브라우저는 FastAPI를 직접 호출하지 않는다"는 규칙이
있어서(CONVENTIONS), 키를 실을 자리가 서버 한 곳으로 이미 좁혀져 있다.

    브라우저 ──(키 없음)──▶ Next BFF ──(X-Advice-Key)──▶ FastAPI
                             └ 키는 서버 측 env 에만 있다

사용자별 한도·과금이 필요해지면 그때 로그인으로 올린다. 그때 이 의존성은 그대로
두고 `require_advice_key`를 세션 검사로 바꾸면 엔드포인트는 손대지 않아도 된다.

## 미설정이면 열려 있다

`ADVICE_API_KEY`가 비어 있으면 인증을 건너뛴다. 로컬 개발이 키 없이 돌아야 하고,
그렇지 않으면 이 자물쇠가 "개발 시작 전에 먼저 풀어야 하는 것"이 되어 결국 아무도
켜지 않게 된다. 대신 **꺼져 있다는 사실을 기동 로그가 경고로 남긴다** (main.py) —
조용히 열려 있는 것이 가장 나쁘다.
"""

import logging
import secrets

from fastapi import Header, HTTPException, status

from app.core.config import settings

logger = logging.getLogger(__name__)

_HEADER = "X-Advice-Key"


async def require_advice_key(
    x_advice_key: str | None = Header(
        default=None,
        alias=_HEADER,
        description="AI 판단 엔드포인트 공유 비밀키. 프런트 BFF가 서버 측에서 붙인다.",
    ),
) -> None:
    """키가 설정돼 있으면 검사하고, 아니면 통과시킨다."""
    if not settings.advice_auth_enabled:
        return

    # `==` 가 아니라 상수 시간 비교다. 문자열 비교는 첫 불일치 문자에서 즉시 빠져나와
    # 응답 시간에 "앞에서 몇 글자가 맞았는지"가 실린다. 네트워크 지터에 묻히긴 하지만
    # 비밀을 비교하는 자리에서 굳이 그 논쟁을 남길 이유가 없다.
    expected = settings.advice_api_key or ""
    if x_advice_key is None or not secrets.compare_digest(x_advice_key, expected):
        # 어느 쪽이 틀렸는지(미제출인지 오유인지) 응답에 싣지 않는다. 구분해 주면
        # 헤더 이름을 모르는 사람에게 그것부터 알려주는 셈이다.
        logger.warning("AI 판단 요청이 잘못된 키로 거절되었습니다")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="AI 판단 엔드포인트에 접근할 수 없습니다.",
        )
