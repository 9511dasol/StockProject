"""LLM 호출 경계 (명세 6.4).

**앱 전체에서 이 파일 하나만 LLM SDK를 import한다.** 에이전트 계층은 `ask_text`와
`ask_structured` 두 함수만 보므로, 프로바이더를 바꾸려면 이 파일만 교체하면 된다
(그래서 파일명이 `openai_client`가 아니라 `llm`이다). 실제로 Anthropic → OpenAI
교체 때 바뀐 것은 이 파일과 설정 4줄뿐이고 에이전트 코드는 손대지 않았다.

현재 구현은 공식 OpenAI SDK의 비동기 클라이언트이며 **Responses API**를 쓴다.
Chat Completions가 아니라 Responses인 이유는 구조화 출력(`text_format=`)이 Pydantic
모델을 그대로 받아 검증까지 해주기 때문이다 — 최종 판단이 `InvestmentDecision`
스키마를 반드시 만족해야 하는 이 앱의 요구와 맞는다.
"""

import logging

from openai import AsyncOpenAI
from openai.types.responses import Response
from pydantic import BaseModel

from app.core.config import settings
from app.core.exceptions import LLMRefusedError

logger = logging.getLogger(__name__)

_client: AsyncOpenAI | None = None


def get_client() -> AsyncOpenAI:
    """프로세스 수명 동안 재사용되는 클라이언트.

    `api_key`를 넘기지 않으면 SDK가 `OPENAI_API_KEY` 환경 변수를 읽는다.
    """
    global _client
    if _client is None:
        kwargs: dict[str, object] = {
            "timeout": settings.llm_timeout_seconds,
            "max_retries": settings.llm_max_retries,
        }
        if settings.openai_api_key:
            kwargs["api_key"] = settings.openai_api_key
        _client = AsyncOpenAI(**kwargs)  # type: ignore[arg-type]
    return _client


async def close_client() -> None:
    global _client
    if _client is not None:
        await _client.close()
        _client = None


#: 추론 파라미터를 받는 모델 계열. `reasoning` 은 여기에만 붙는다.
_REASONING_MODEL_PREFIXES = ("gpt-5", "o1", "o3", "o4")


def supports_reasoning(model: str) -> bool:
    """이 모델이 `reasoning` 파라미터를 받는가.

    gpt-5 계열·o 시리즈만 받는다. `gpt-4o-mini` 같은 비추론 모델에 붙여 보내면
    **요청 자체가 400** 이라 응답을 한 줄도 못 받는다.
    """
    name = model.strip().lower()
    return name.startswith(_REASONING_MODEL_PREFIXES)


def _extra_params() -> dict:
    """모델이 받는 것만 골라 넘긴다.

    예전에는 `reasoning` 을 무조건 실었다. 그러면 `OPENAI_MODEL` 을 비추론 모델로
    바꾸는 순간 전 호출이 400 이 되고, 화면에는 "AI 판단 실패" 로만 보여 원인이
    모델 선택에 있다는 것을 알기 어렵다.

    `LLM_EFFORT` 를 무시하는 것이 아니라 **그 모델에서 뜻이 없을 때만** 뺀다.
    """
    if not supports_reasoning(settings.openai_model):
        return {}
    return {"reasoning": {"effort": settings.llm_effort}}


def _refusal_of(response: Response) -> str | None:
    """거절 사유. 거절은 예외가 아니라 출력 블록으로 온다 — 반드시 먼저 검사한다."""
    for item in response.output:
        if item.type != "message":
            continue
        for content in item.content:
            if content.type == "refusal":
                return content.refusal
    return None


def _guard(response: Response) -> None:
    refusal = _refusal_of(response)
    if refusal:
        raise LLMRefusedError(detail=refusal)

    # 추론 토큰이 max_output_tokens를 다 먹으면 status가 incomplete로 끝나고 본문이 빈다.
    # 그대로 두면 상위 계층에 "빈 응답"으로만 보여 원인을 못 찾는다.
    if response.status == "incomplete":
        reason = getattr(response.incomplete_details, "reason", None)
        logger.warning("응답이 incomplete 로 끝났습니다 (reason=%s)", reason)


async def ask_text(system_prompt: str, user_content: str) -> str:
    """자유 서술 응답 한 건. 거절되면 `LLMRefusedError`."""
    client = get_client()
    response = await client.responses.create(
        model=settings.openai_model,
        max_output_tokens=settings.llm_max_tokens,
        # Responses API 는 system 역할 대신 instructions 를 쓴다.
        instructions=system_prompt,
        input=user_content,
        **_extra_params(),
    )

    _guard(response)
    return response.output_text.strip()


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """임베딩 벡터. 입력 순서 그대로 돌려준다.

    RAG 색인·검색이 쓰는 유일한 임베딩 경로다. 이 함수도 여기 있어야 하는 이유는
    파일 상단의 원칙과 같다 — SDK를 import하는 파일을 하나로 유지한다.

    차원(`dimensions`)을 명시하는 것은 의도적이다. 테이블의 `vector(N)`이 설정값으로
    만들어지므로, 모델 기본 차원이 바뀌어도 색인과 어긋나지 않는다.
    """
    if not texts:
        return []

    client = get_client()
    response = await client.embeddings.create(
        model=settings.embedding_model,
        input=texts,
        dimensions=settings.embedding_dimensions,
    )
    # SDK가 순서를 보장하지만 index로 다시 정렬해 계약을 코드로 못박는다.
    return [item.embedding for item in sorted(response.data, key=lambda item: item.index)]


async def ask_structured[ModelT: BaseModel](
    system_prompt: str,
    user_content: str,
    output_model: type[ModelT],
) -> ModelT:
    """스키마가 검증된 구조화 응답.

    `text_format`에 Pydantic 모델을 그대로 넘기면 SDK가 JSON 스키마로 변환해
    보내고, 응답을 다시 그 모델로 파싱해 `output_parsed`에 담는다.
    """
    client = get_client()
    response = await client.responses.parse(
        model=settings.openai_model,
        max_output_tokens=settings.llm_max_tokens,
        instructions=system_prompt,
        input=user_content,
        text_format=output_model,
        **_extra_params(),
    )

    _guard(response)

    parsed = response.output_parsed
    if parsed is None:
        raise LLMRefusedError("구조화 응답을 파싱하지 못했습니다.")

    return parsed
