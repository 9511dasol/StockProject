"""LLM 경로 라이브 검증.

자격 증명이 생긴 뒤 한 번 돌려서, 테스트로는 덮을 수 없는 "네트워크 왕복"을 확인한다.
앱이 실제로 쓰는 함수(`ask_text` / `ask_structured`)를 그대로 호출하므로, 통과하면
`POST /stocks/advice`의 LLM 경로가 검증된 것과 같다.

    uv run python -m scripts.verify_llm

(`-m`으로 실행해야 프로젝트 루트가 sys.path에 올라 `app` 패키지를 찾는다.)

각 단계는 독립적으로 실패 원인을 좁힌다:
    1. 자격 증명 + 모델 접근        → 키/프로필 문제인지
    2. 기본 요청 형태 (베타 없이)    → thinking/effort 파라미터 문제인지
    3. 서버 측 폴백 베타             → 조직에 베타가 열려 있는지
    4. 구조화 출력                   → InvestmentDecision 스키마가 컴파일되는지
"""

import asyncio
import sys

from app.agents.prompts import DECISION_PROFILE, JOURNALIST
from app.core.config import settings
from app.core.logging import configure_logging
from app.integrations import llm
from app.schemas.advice import InvestmentDecision

_PROBE_CONTEXT = """{
  "stock": {"name": "테스트", "symbol": "TEST"},
  "metrics": {"trend": "상승 우위", "return_20d_pct": 4.0, "recent_cross_signal": "golden"},
  "agent_opinions": []
}"""


def _ok(label: str, detail: str = "") -> None:
    print(f"  [PASS] {label}" + (f" — {detail}" if detail else ""))


def _fail(label: str, exc: BaseException, hint: str) -> None:
    print(f"  [FAIL] {label}")
    print(f"         {type(exc).__name__}: {exc}")
    print(f"         → {hint}")


async def check_credentials() -> bool:
    print("1. 자격 증명 + 모델 접근")
    try:
        client = llm.get_client()
        model = await client.models.retrieve(settings.anthropic_model)
    except Exception as exc:
        _fail(
            settings.anthropic_model,
            exc,
            "ANTHROPIC_API_KEY를 .env에 넣거나 `ant auth login`으로 프로필을 만든다. "
            "모델 ID가 틀렸으면 404가 난다.",
        )
        return False

    _ok(
        model.id,
        f"context={model.max_input_tokens:,} / max_output={model.max_tokens:,}",
    )
    return True


async def check_text(*, server_side_fallback: bool) -> bool:
    label = f"ask_text (서버 측 폴백 {'ON' if server_side_fallback else 'OFF'})"
    print(f"{'2' if not server_side_fallback else '3'}. {label}")

    original = settings.llm_server_side_fallback
    settings.llm_server_side_fallback = server_side_fallback
    try:
        text = await llm.ask_text(
            JOURNALIST.full_prompt(),
            "다음 컨텍스트를 한 문장으로 요약해라.\n" + _PROBE_CONTEXT,
        )
    except Exception as exc:
        hint = (
            "이 조직에 서버 측 폴백 베타가 열려 있지 않다. "
            ".env에 LLM_SERVER_SIDE_FALLBACK=false로 두면 된다 "
            "(앱은 규칙 기반으로 자체 폴백하므로 기능 손실은 없다)."
            if server_side_fallback
            else "베타와 무관한 문제다. 요청 형태(thinking/effort) 또는 모델 권한을 확인한다."
        )
        _fail(label, exc, hint)
        return False
    finally:
        settings.llm_server_side_fallback = original

    if not text:
        print(f"  [WARN] {label} — 빈 응답. max_tokens를 thinking이 다 쓴 경우일 수 있다.")
        return False

    _ok(label, f"{len(text)}자 · {text[:60]}...")
    return True


async def check_structured() -> bool:
    print("4. ask_structured (InvestmentDecision 구조화 출력)")
    try:
        decision = await llm.ask_structured(
            DECISION_PROFILE.full_prompt(), _PROBE_CONTEXT, InvestmentDecision
        )
    except Exception as exc:
        _fail(
            "InvestmentDecision",
            exc,
            "스키마 컴파일 실패거나 거절이다. 첫 요청은 스키마 컴파일 비용이 있어 느릴 수 있다.",
        )
        return False

    _ok(
        "InvestmentDecision",
        f"verdict={decision.verdict} confidence={decision.confidence} "
        f"buy_conditions={len(decision.buy_conditions)} risks={len(decision.risk_notes)}",
    )
    return True


async def main() -> int:
    configure_logging()
    print(f"모델: {settings.anthropic_model}\n")

    if not await check_credentials():
        await llm.close_client()
        return 1

    baseline = await check_text(server_side_fallback=False)
    with_fallback = await check_text(server_side_fallback=True)
    structured = await check_structured()

    await llm.close_client()

    print()
    if baseline and with_fallback and structured:
        print("전부 통과. LLM 경로가 검증됐다.")
        print("마지막으로 실제 엔드포인트를 확인한다:")
        print(
            '  curl -s -X POST -H "content-type: application/json" '
            '-d \'{"symbol":"005930"}\' '
            "http://127.0.0.1:8000/api/v1/stocks/advice"
        )
        print('  → agents[*].status가 모두 "done"이면 (fallback이 아니면) 성공이다.')
        return 0

    if baseline and structured and not with_fallback:
        print("서버 측 폴백만 실패했다 → .env에 LLM_SERVER_SIDE_FALLBACK=false 를 넣는다.")
        print("나머지 LLM 경로는 정상이다.")
        return 0

    print("위 [FAIL] 항목의 조치를 먼저 처리한다.")
    return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
