"""LLM 호출 경계 (명세 6.4).

**앱 전체에서 이 파일 하나만 LLM SDK를 import한다.** 에이전트 계층은 `ask_text`와
`ask_structured` 두 함수만 보므로, 프로바이더를 바꾸려면 이 파일만 교체하면 된다
(그래서 파일명이 `anthropic_client`가 아니라 `llm`이다).

현재 구현은 공식 Anthropic SDK의 비동기 클라이언트다 — 에이전트 3건을
`asyncio.gather`로 병렬 실행할 수 있고, 구조화 출력은 `messages.parse`가 Pydantic
모델로 검증까지 해준다.
"""

import logging

from anthropic import AsyncAnthropic
from pydantic import BaseModel

from app.core.config import settings
from app.core.exceptions import LLMRefusedError

logger = logging.getLogger(__name__)

# `fallbacks="default"`(스칼라 형태)를 게이트하는 베타 헤더.
# 배열 형태(`fallbacks=[{...}]`)는 -2026-06-01을 쓴다 — 헤더와 형태를 섞으면 400이다.
_FALLBACK_BETA = "server-side-fallback-2026-07-01"

_client: AsyncAnthropic | None = None


def get_client() -> AsyncAnthropic:
    """프로세스 수명 동안 재사용되는 클라이언트.

    `api_key`를 넘기지 않으면 SDK가 ANTHROPIC_API_KEY → ANTHROPIC_AUTH_TOKEN →
    `ant auth login` 프로필 순으로 자격 증명을 해석한다.
    """
    global _client
    if _client is None:
        kwargs: dict[str, object] = {
            "timeout": settings.llm_timeout_seconds,
            "max_retries": settings.llm_max_retries,
        }
        if settings.anthropic_api_key:
            kwargs["api_key"] = settings.anthropic_api_key
        _client = AsyncAnthropic(**kwargs)  # type: ignore[arg-type]
    return _client


async def close_client() -> None:
    global _client
    if _client is not None:
        await _client.close()
        _client = None


def _fallback_kwargs() -> dict:
    if not settings.llm_server_side_fallback:
        return {}
    return {"betas": [_FALLBACK_BETA], "fallbacks": "default"}


def _text_of(response) -> str:
    return "".join(block.text for block in response.content if block.type == "text").strip()


async def ask_text(system_prompt: str, user_content: str) -> str:
    """자유 서술 응답 한 건. 거절되면 `LLMRefusedError`."""
    client = get_client()
    response = await client.beta.messages.create(
        model=settings.anthropic_model,
        max_tokens=settings.llm_max_tokens,
        system=system_prompt,
        messages=[{"role": "user", "content": user_content}],
        # Opus 5는 thinking이 기본 on이지만, 다른 모델로 바꿔도 동작이 같도록 명시한다.
        thinking={"type": "adaptive"},
        output_config={"effort": settings.llm_effort},
        **_fallback_kwargs(),
    )

    # 거절은 HTTP 200으로 온다 — content를 읽기 전에 반드시 검사한다.
    if response.stop_reason == "refusal":
        raise LLMRefusedError(detail=str(getattr(response, "stop_details", None)))

    return _text_of(response)


async def ask_structured[ModelT: BaseModel](
    system_prompt: str,
    user_content: str,
    output_model: type[ModelT],
) -> ModelT:
    """스키마가 검증된 구조화 응답.

    `output_config`(effort)는 넘기지 않는다 — `output_format`이 내부적으로
    `output_config.format`을 채우므로 둘을 함께 지정하지 않는다. 최종 판단은
    기본 effort(high)가 적절하기도 하다.
    """
    client = get_client()
    response = await client.beta.messages.parse(
        model=settings.anthropic_model,
        max_tokens=settings.llm_max_tokens,
        system=system_prompt,
        messages=[{"role": "user", "content": user_content}],
        output_format=output_model,
        **_fallback_kwargs(),
    )

    if response.stop_reason == "refusal":
        raise LLMRefusedError(detail=str(getattr(response, "stop_details", None)))

    parsed = response.parsed_output
    if parsed is None:
        raise LLMRefusedError("구조화 응답을 파싱하지 못했습니다.")

    return parsed
