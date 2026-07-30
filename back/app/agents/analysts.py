"""하위 분석 에이전트 3인 (명세 6.4).

원본은 세 에이전트를 순차 호출했다 — 각 호출이 수십 초 걸릴 수 있으므로 지연이 3배로
누적됐다. 서로 독립적인 호출이므로 `asyncio.gather`로 병렬 실행한다.
"""

import asyncio
import json
import logging

from app.agents.prompts import ANALYST_PROFILES, AgentProfile
from app.integrations.llm import ask_text
from app.schemas.advice import AgentOpinion
from app.schemas.stock import StockHistory, StockMetrics
from app.utils.numbers import format_compact_number, format_percent
from app.utils.text import clean_text

logger = logging.getLogger(__name__)

_CONTEXT_NEWS_LIMIT = 3
_CONTEXT_REPORT_LIMIT = 3


def build_context(stock_data: StockHistory, metrics: StockMetrics) -> str:
    """에이전트에게 넘길 JSON 컨텍스트. 봉 데이터는 제외하고 요약만 담는다."""
    return json.dumps(
        {
            "stock": {
                "name": stock_data.name,
                "symbol": stock_data.symbol,
                "query": stock_data.query,
            },
            "metrics": metrics.model_dump(),
            "news": [
                {
                    "title": item.title,
                    "publisher": item.publisher,
                    "published_at": item.published_at,
                    "summary": item.summary,
                }
                for item in stock_data.news[:_CONTEXT_NEWS_LIMIT]
            ],
            "analyst_reports": [
                {
                    "title": item.title,
                    "publisher": item.publisher,
                    "published_at": item.published_at,
                    "summary": item.summary,
                }
                for item in stock_data.reports[:_CONTEXT_REPORT_LIMIT]
            ],
        },
        ensure_ascii=False,
        indent=2,
    )


def make_fallback_opinion(agent_name: str, metrics: StockMetrics) -> str:
    """LLM 없이 지표만으로 작성하는 대체 의견."""
    if agent_name == "AI 애널리스트":
        return (
            f"최근 종가 {format_compact_number(metrics.latest_close)}, "
            f"일간 변동률 {format_percent(metrics.day_change_pct)}, "
            f"20거래일 수익률 {format_percent(metrics.return_20d_pct)}, "
            f"추세는 {metrics.trend}입니다."
        )
    if agent_name == "AI 경제학자":
        return (
            "시장 환경은 가격 추세와 거래량을 기준으로 보수적으로 해석했습니다. "
            f"20일 거래량 대비 배율은 {format_compact_number(metrics.volume_ratio_20d)}입니다."
        )
    return "뉴스와 리포트는 수집 가능한 제목과 요약 중심으로 점검했습니다."


async def _invoke(profile: AgentProfile, context: str, metrics: StockMetrics) -> AgentOpinion:
    try:
        summary = clean_text(await ask_text(profile.full_prompt(), context))
    except Exception as exc:
        logger.warning("%s 호출 실패 (%s) → 규칙 기반 의견으로 대체", profile.name, exc)
        return AgentOpinion(
            agent=profile.name,
            status="fallback",
            summary=make_fallback_opinion(profile.name, metrics),
            error=clean_text(exc),
        )

    if not summary:
        logger.warning("%s 응답이 비어 있습니다 → 규칙 기반 의견으로 대체", profile.name)
        return AgentOpinion(
            agent=profile.name,
            status="fallback",
            summary=make_fallback_opinion(profile.name, metrics),
            error="빈 응답",
        )

    return AgentOpinion(agent=profile.name, status="done", summary=summary)


async def collect_opinions(context: str, metrics: StockMetrics) -> list[AgentOpinion]:
    """에이전트 3인을 병렬 실행한다. 개별 실패는 폴백 의견으로 흡수된다."""
    return list(
        await asyncio.gather(*(_invoke(profile, context, metrics) for profile in ANALYST_PROFILES))
    )
