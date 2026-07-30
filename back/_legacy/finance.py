"""주식 / 시장 데이터 관련 로직 모음.

- 종목 코드 정규화 및 한글 종목명 매핑
- KRX 상장사 목록 수집 및 종목 검색
- yfinance 기반 주가 히스토리 / 시장 개요 조회
- 뉴스, 애널리스트 리포트 수집
- 멀티 에이전트 투자 판단 생성
- /stocks, /markets 라우터
"""

import csv
import io
import json
import math
import re
from datetime import date, datetime, timedelta
from html import unescape
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from database import get_db
from models import ListedCompany
import graph as graph_module


# --- 상수 ---

COMMON_STOCK_SYMBOLS = {
    "삼성": "005930.KS",
    "삼성전자": "005930.KS",
    "sk하이닉스": "000660.KS",
    "에스케이하이닉스": "000660.KS",
    "현대차": "005380.KS",
    "현대자동차": "005380.KS",
    "기아": "000270.KS",
    "네이버": "035420.KS",
    "naver": "035420.KS",
    "카카오": "035720.KS",
    "lg에너지솔루션": "373220.KS",
    "셀트리온": "068270.KS",
}

COMMON_STOCK_NAMES = {
    "삼성": "삼성전자",
    "삼성전자": "삼성전자",
    "sk하이닉스": "SK하이닉스",
    "에스케이하이닉스": "SK하이닉스",
    "현대차": "현대차",
    "현대자동차": "현대차",
    "기아": "기아",
    "네이버": "NAVER",
    "naver": "NAVER",
    "카카오": "카카오",
    "lg에너지솔루션": "LG에너지솔루션",
    "셀트리온": "셀트리온",
}

KOREAN_STOCK_NAMES_BY_SYMBOL = {
    "000270": "기아",
    "000660": "SK하이닉스",
    "003490": "대한항공",
    "005380": "현대차",
    "005930": "삼성전자",
    "035420": "NAVER",
    "035720": "카카오",
    "068270": "셀트리온",
    "322310": "오로스테크놀로지",
    "373220": "LG에너지솔루션",
}

KOREAN_STOCK_MARKETS_BY_SYMBOL = {
    "035720": "KOSDAQ",
    "068270": "KOSDAQ",
    "322310": "KOSDAQ",
}

STOCK_PERIODS = {"5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "ytd", "max"}
STOCK_TIMEFRAMES = {
    "day": {"interval": "1d", "period": "2y"},
    "week": {"interval": "1wk", "period": "5y"},
    "month": {"interval": "1mo", "period": "max"},
}
MARKET_OVERVIEW_CATEGORIES = {
    "forex": {
        "label": "외환",
        "symbols": [
            {"name": "달러/원", "symbol": "KRW=X"},
            {"name": "유로/달러", "symbol": "EURUSD=X"},
            {"name": "브라질 헤알/원", "symbol": "BRLKRW=X"},
            {"name": "엔/원", "symbol": "JPYKRW=X"},
            {"name": "파운드/달러", "symbol": "GBPUSD=X"},
            {"name": "태국 바트/원", "symbol": "THBKRW=X"},
            {"name": "달러/엔", "symbol": "JPY=X"},
        ],
    },
    "index": {
        "label": "지수",
        "symbols": [
            {"name": "코스피지수", "symbol": "^KS11"},
            {"name": "코스피200", "symbol": "^KS200"},
            {"name": "US 500", "symbol": "^GSPC"},
            {"name": "US Tech 100", "symbol": "^NDX"},
            {"name": "DAX", "symbol": "^GDAXI"},
            {"name": "닛케이", "symbol": "^N225"},
            {"name": "미국 달러 지수", "symbol": "DX-Y.NYB"},
            {"name": "필라델피아 반도체 지수", "symbol": "^SOX"},
        ],
    },
    "commodity": {
        "label": "원자재",
        "symbols": [
            {"name": "금", "symbol": "GC=F"},
            {"name": "은", "symbol": "SI=F"},
            {"name": "브렌트유", "symbol": "BZ=F"},
            {"name": "WTI유", "symbol": "CL=F"},
            {"name": "천연가스", "symbol": "NG=F"},
            {"name": "구리", "symbol": "HG=F"},
            {"name": "미국 옥수수", "symbol": "ZC=F"},
        ],
    },
    "stock": {
        "label": "주식",
        "symbols": [
            {"name": "AAPL", "symbol": "AAPL"},
            {"name": "BABA", "symbol": "BABA"},
            {"name": "TSLA", "symbol": "TSLA"},
            {"name": "AA", "symbol": "AA"},
            {"name": "BAC", "symbol": "BAC"},
            {"name": "KO", "symbol": "KO"},
            {"name": "XOM", "symbol": "XOM"},
        ],
    },
}

ZERO_WIDTH_PATTERN = re.compile(r"[\u200b-\u200f\u2060\ufeff]")
NON_SEARCH_TEXT_PATTERN = re.compile(r"[^0-9A-Za-z가-힣]")
HANGUL_INITIALS = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"

KOREAN_TRANSLATION_RULE = """
Write the main answer in Korean whenever possible.
If you include a meaningful sentence or paragraph in another language, put its Korean translation immediately after that paragraph.
Use this format:

[foreign-language paragraph]
*한국어 번역:* [Korean translation]

Do not wait until the end of the answer to translate.
Do not add translation lines for stock tickers, product names, URLs, API names, or short proper nouns by themselves.
"""


# --- 스키마 ---


class StockAdviceRequest(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=80)


class InvestmentDecision(BaseModel):
    verdict: Literal["BUY", "WATCH", "AVOID"] = Field(
        description="BUY=매수 가능, WATCH=관망, AVOID=매수 보류"
    )
    decision_label: str = Field(description="사용자에게 보여줄 짧은 투자 판단")
    confidence: int = Field(ge=0, le=100, description="판단 신뢰도")
    answer: str = Field(description="첫 문장에 사도 되는지 여부가 드러나는 최종 답변")
    buy_conditions: list[str] = Field(default_factory=list)
    risk_notes: list[str] = Field(default_factory=list)


# --- 값 정규화 유틸 ---


def number_or_none(value, digits: int = 2):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None

    if math.isnan(number):
        return None

    return round(number, digits)


def int_or_none(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None

    if math.isnan(number):
        return None

    return int(number)


def is_number(value) -> bool:
    return value is not None and isinstance(value, (int, float)) and not math.isnan(value)


def clean_text(value) -> str:
    if value is None:
        return ""

    return ZERO_WIDTH_PATTERN.sub("", str(value)).strip()


def format_date_text(value) -> str:
    if value is None:
        return ""

    if isinstance(value, datetime):
        return value.date().isoformat()

    text = clean_text(value)
    if "T" in text:
        return text.split("T", 1)[0]

    return text[:10]


def format_compact_number(value) -> str:
    number = number_or_none(value)
    if number is None:
        return "-"

    return f"{number:,.2f}".rstrip("0").rstrip(".")


def percent_change(start_value, end_value) -> float | None:
    if not is_number(start_value) or not is_number(end_value) or start_value == 0:
        return None

    return round(((end_value - start_value) / start_value) * 100, 2)


def format_percent(value) -> str:
    if not is_number(value):
        return "-"

    return f"{value:+.2f}%"


# --- 종목 코드 / 이름 ---


def normalize_stock_candidates(symbol: str) -> list[str]:
    raw_symbol = symbol.strip()
    key = raw_symbol.replace(" ", "").lower()

    if key in COMMON_STOCK_SYMBOLS:
        return [COMMON_STOCK_SYMBOLS[key]]

    if raw_symbol.isdigit() and len(raw_symbol) == 6:
        return [f"{raw_symbol}.KS", f"{raw_symbol}.KQ", raw_symbol]

    return [raw_symbol.upper()]


def get_common_stock_name(symbol: str) -> str | None:
    key = symbol.strip().replace(" ", "").lower()
    return COMMON_STOCK_NAMES.get(key)


def normalize_stock_code(symbol: str) -> str:
    return re.sub(r"\D", "", symbol.split(".", 1)[0])[:6]


def get_korean_stock_name(symbol: str) -> str | None:
    code = normalize_stock_code(symbol)
    return KOREAN_STOCK_NAMES_BY_SYMBOL.get(code)


def normalize_search_text(value: str) -> str:
    return NON_SEARCH_TEXT_PATTERN.sub("", clean_text(value)).lower()


def get_initial_consonants(value: str) -> str:
    result = []
    for char in clean_text(value):
        code = ord(char)
        if 0xAC00 <= code <= 0xD7A3:
            result.append(HANGUL_INITIALS[(code - 0xAC00) // 588])
        elif char.strip():
            result.append(char.lower())
    return "".join(result)


def krx_symbol_to_yfinance(symbol: str, market: str | None) -> str:
    code = clean_text(symbol).split(".", 1)[0]
    if not re.fullmatch(r"\d{6}", code):
        return code or symbol
    market_text = clean_text(market).upper()
    suffix = (
        ".KQ"
        if (
            "KOSDAQ" in market_text
            or "KONEX" in market_text
            or "코스닥" in market_text
            or "코넥스" in market_text
        )
        else ".KS"
    )
    return f"{code}{suffix}"


# --- 상장사 목록 ---


def parse_krx_companies(csv_text: str) -> list[dict]:
    reader = csv.DictReader(io.StringIO(csv_text))
    companies = []
    for row in reader:
        symbol = clean_text(
            row.get("단축코드")
            or row.get("종목코드")
            or row.get("isuSrtCd")
            or row.get("ISU_SRT_CD")
        )
        name = clean_text(
            row.get("한글 종목명")
            or row.get("종목명")
            or row.get("isuKorNm")
            or row.get("ISU_KOR_NM")
        )
        market = clean_text(
            row.get("시장구분")
            or row.get("시장구분명")
            or row.get("mktNm")
            or row.get("MKT_NM")
        )
        code = normalize_stock_code(symbol)
        if not code or not name:
            continue
        companies.append(
            {
                "symbol": krx_symbol_to_yfinance(code, market),
                "name": name,
                "market": market or None,
                "initial_consonants": get_initial_consonants(name),
            }
        )
    return companies


def fetch_krx_listed_companies() -> list[dict]:
    import urllib.parse
    import urllib.request

    params = {
        "locale": "ko_KR",
        "mktId": "ALL",
        "share": "1",
        "csvxls_isNo": "false",
        "name": "fileDown",
        "url": "dbms/MDC/STAT/standard/MDCSTAT01901",
    }
    otp_request = urllib.request.Request(
        "https://data.krx.co.kr/comm/fileDn/GenerateOTP/generate.cmd",
        data=urllib.parse.urlencode(params).encode("utf-8"),
        headers={
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Referer": "https://data.krx.co.kr/contents/MDC/MDI/mdiLoader",
            "User-Agent": "Mozilla/5.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(otp_request, timeout=15) as response:
        otp = response.read().decode("utf-8").strip()

    csv_request = urllib.request.Request(
        "https://data.krx.co.kr/comm/fileDn/download_csv/download.cmd",
        data=urllib.parse.urlencode({"code": otp}).encode("utf-8"),
        headers={
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Referer": "https://data.krx.co.kr/contents/MDC/MDI/mdiLoader",
            "User-Agent": "Mozilla/5.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(csv_request, timeout=20) as response:
        raw = response.read()

    csv_text = raw.decode("euc-kr", errors="replace")
    return parse_krx_companies(csv_text)


def fetch_kind_listed_companies() -> list[dict]:
    import urllib.request

    request = urllib.request.Request(
        "https://kind.krx.co.kr/corpgeneral/corpList.do?method=download&searchType=13",
        headers={
            "Referer": "https://kind.krx.co.kr/corpgeneral/corpList.do?method=loadInitPage",
            "User-Agent": "Mozilla/5.0",
        },
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        html = response.read().decode("euc-kr", errors="replace")

    rows = re.findall(r"<tr[^>]*>(.*?)</tr>", html, re.S | re.I)
    companies = []
    for row in rows[1:]:
        cells = [
            unescape(re.sub(r"<.*?>", "", cell)).strip()
            for cell in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.S | re.I)
        ]
        if len(cells) < 3:
            continue
        name, market, code = cells[0], cells[1], cells[2]
        if not name or not code:
            continue
        companies.append(
            {
                "symbol": krx_symbol_to_yfinance(code, market),
                "name": name,
                "market": market or None,
                "initial_consonants": get_initial_consonants(name),
            }
        )
    return companies


def fallback_listed_companies() -> list[dict]:
    companies = []
    for code, name in KOREAN_STOCK_NAMES_BY_SYMBOL.items():
        market = KOREAN_STOCK_MARKETS_BY_SYMBOL.get(code, "KOSPI")
        companies.append(
            {
                "symbol": krx_symbol_to_yfinance(code, market),
                "name": name,
                "market": market,
                "initial_consonants": get_initial_consonants(name),
            }
        )
    return companies


async def ensure_listed_companies(db: AsyncSession) -> None:
    count_result = await db.execute(select(func.count()).select_from(ListedCompany))
    existing_count = count_result.scalar_one()
    if existing_count >= 100:
        return

    try:
        companies = await run_in_threadpool(fetch_krx_listed_companies)
    except Exception:
        companies = []
    if not companies:
        try:
            companies = await run_in_threadpool(fetch_kind_listed_companies)
        except Exception:
            companies = []
    if not companies:
        companies = fallback_listed_companies()

    existing_result = await db.execute(select(ListedCompany))
    existing_by_symbol = {
        company.symbol: company for company in existing_result.scalars().all()
    }
    seen = set()
    for company in companies:
        symbol = company["symbol"]
        if symbol in seen:
            continue
        seen.add(symbol)
        existing_company = existing_by_symbol.get(symbol)
        if existing_company:
            existing_company.name = company["name"]
            existing_company.market = company["market"]
            existing_company.initial_consonants = company["initial_consonants"]
        else:
            db.add(ListedCompany(**company))
    await db.commit()


def serialize_company(company: ListedCompany) -> dict:
    return {
        "symbol": company.symbol,
        "name": company.name,
        "market": company.market,
        "initial_consonants": company.initial_consonants,
    }


# --- 뉴스 / 애널리스트 리포트 ---


def get_stock_name(ticker, fallback: str) -> str:
    try:
        info = ticker.info
    except Exception:
        return fallback

    return info.get("shortName") or info.get("longName") or fallback


def get_nested_url(value) -> str:
    if isinstance(value, dict):
        return clean_text(value.get("url"))

    return clean_text(value)


def get_news_thumbnail(content: dict) -> str:
    thumbnail = content.get("thumbnail")
    if not isinstance(thumbnail, dict):
        return ""

    resolutions = thumbnail.get("resolutions")
    if isinstance(resolutions, list) and resolutions:
        preferred = next(
            (
                item
                for item in resolutions
                if isinstance(item, dict) and item.get("tag") == "170x128"
            ),
            resolutions[-1],
        )
        return clean_text(preferred.get("url"))

    return clean_text(thumbnail.get("originalUrl"))


def fetch_stock_news(ticker, limit: int = 3) -> list[dict]:
    try:
        raw_news = ticker.get_news(count=limit)
    except Exception:
        try:
            raw_news = ticker.news[:limit]
        except Exception:
            return []

    items = []
    for item in raw_news[:limit]:
        content = item.get("content", item) if isinstance(item, dict) else {}
        provider = content.get("provider") if isinstance(content, dict) else {}
        provider_name = (
            provider.get("displayName")
            if isinstance(provider, dict)
            else clean_text(provider)
        )
        url = get_nested_url(content.get("clickThroughUrl")) or get_nested_url(
            content.get("canonicalUrl")
        )

        items.append(
            {
                "title": clean_text(content.get("title")),
                "publisher": clean_text(provider_name),
                "published_at": format_date_text(
                    content.get("pubDate") or content.get("displayTime")
                ),
                "summary": clean_text(
                    content.get("summary") or content.get("description")
                ),
                "url": url,
                "thumbnail": get_news_thumbnail(content),
            }
        )

    return [item for item in items if item["title"]]


def build_recommendation_summary(row) -> str:
    return (
        f"Strong Buy {int_or_none(row.get('strongBuy')) or 0}, "
        f"Buy {int_or_none(row.get('buy')) or 0}, "
        f"Hold {int_or_none(row.get('hold')) or 0}, "
        f"Sell {int_or_none(row.get('sell')) or 0}, "
        f"Strong Sell {int_or_none(row.get('strongSell')) or 0}"
    )


def fetch_analyst_reports(ticker, symbol: str, limit: int = 3) -> list[dict]:
    reports = []
    analysis_url = f"https://finance.yahoo.com/quote/{symbol}/analysis/"

    try:
        upgrades = ticker.get_upgrades_downgrades()
    except Exception:
        upgrades = None

    if upgrades is not None and not getattr(upgrades, "empty", True):
        for date_value, row in upgrades.head(limit).iterrows():
            firm = clean_text(row.get("Firm"))
            to_grade = clean_text(row.get("ToGrade"))
            from_grade = clean_text(row.get("FromGrade"))
            target = format_compact_number(row.get("currentPriceTarget"))
            prior_target = format_compact_number(row.get("priorPriceTarget"))
            title = f"{firm} 애널리스트 의견"
            if to_grade:
                title += f": {to_grade}"

            summary_parts = []
            if from_grade and to_grade and from_grade != to_grade:
                summary_parts.append(f"투자의견 {from_grade}에서 {to_grade}로 변경")
            elif to_grade:
                summary_parts.append(f"투자의견 {to_grade} 유지")
            if target != "-":
                summary_parts.append(f"목표가 {target}")
            if prior_target != "-" and prior_target != target:
                summary_parts.append(f"이전 목표가 {prior_target}")

            reports.append(
                {
                    "title": title,
                    "publisher": firm,
                    "published_at": format_date_text(date_value),
                    "summary": " · ".join(summary_parts),
                    "url": analysis_url,
                }
            )

            if len(reports) >= limit:
                return reports

    try:
        price_targets = ticker.get_analyst_price_targets()
    except Exception:
        price_targets = {}

    if isinstance(price_targets, dict) and price_targets and len(reports) < limit:
        reports.append(
            {
                "title": "애널리스트 목표가 컨센서스",
                "publisher": "Yahoo Finance",
                "published_at": "",
                "summary": (
                    f"평균 목표가 {format_compact_number(price_targets.get('mean'))}, "
                    f"최고 {format_compact_number(price_targets.get('high'))}, "
                    f"최저 {format_compact_number(price_targets.get('low'))}, "
                    f"현재가 {format_compact_number(price_targets.get('current'))}"
                ),
                "url": analysis_url,
            }
        )

    try:
        recommendations = ticker.get_recommendations_summary()
    except Exception:
        try:
            recommendations = ticker.get_recommendations()
        except Exception:
            recommendations = None

    if recommendations is not None and not getattr(recommendations, "empty", True):
        period_labels = {
            "0m": "현재",
            "-1m": "1개월 전",
            "-2m": "2개월 전",
            "-3m": "3개월 전",
        }
        for _, row in recommendations.iterrows():
            period = clean_text(row.get("period"))
            reports.append(
                {
                    "title": f"애널리스트 투자의견 요약 ({period_labels.get(period, period)})",
                    "publisher": "Yahoo Finance",
                    "published_at": "",
                    "summary": build_recommendation_summary(row),
                    "url": analysis_url,
                }
            )

            if len(reports) >= limit:
                return reports[:limit]

    return reports[:limit]


# --- 주가 / 시장 데이터 ---


def fetch_stock_history_from_yfinance(
    symbol: str,
    timeframe: str,
    period: str | None,
    limit: int,
    start_date: date | None = None,
    end_date: date | None = None,
):
    try:
        import yfinance as yf
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail="yfinance 패키지가 설치되어 있지 않습니다.",
        ) from exc

    if timeframe not in STOCK_TIMEFRAMES:
        raise HTTPException(status_code=400, detail="지원하지 않는 조회 단위입니다.")

    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="시작일은 종료일보다 늦을 수 없습니다.",
        )

    has_date_range = bool(start_date or end_date)
    selected_period = None if has_date_range else period or STOCK_TIMEFRAMES[timeframe]["period"]
    interval = STOCK_TIMEFRAMES[timeframe]["interval"]

    if selected_period is not None and selected_period not in STOCK_PERIODS:
        raise HTTPException(status_code=400, detail="지원하지 않는 조회 기간입니다.")

    requested_stock_name = get_common_stock_name(symbol)

    for candidate in normalize_stock_candidates(symbol):
        ticker = yf.Ticker(candidate)
        try:
            history_kwargs = {
                "interval": interval,
                "auto_adjust": False,
            }
            if has_date_range:
                if start_date:
                    history_kwargs["start"] = start_date.isoformat()
                if end_date:
                    history_kwargs["end"] = (end_date + timedelta(days=1)).isoformat()
            else:
                history_kwargs["period"] = selected_period

            history = ticker.history(**history_kwargs)
        except Exception:
            continue

        if history.empty:
            continue

        history = history.copy()
        history["SMA5"] = history["Close"].rolling(5).mean()
        history["SMA20"] = history["Close"].rolling(20).mean()
        std20 = history["Close"].rolling(20).std()
        history["BB_upper"] = history["SMA20"] + 2 * std20
        history["BB_lower"] = history["SMA20"] - 2 * std20
        ma_signal = (history["SMA5"] > history["SMA20"]).astype(int)
        ma_cross = ma_signal.diff()
        history["CrossSignal"] = None
        history.loc[ma_cross == 1, "CrossSignal"] = "golden"
        history.loc[ma_cross == -1, "CrossSignal"] = "dead"

        stock_name = (
            requested_stock_name
            or get_korean_stock_name(candidate)
            or get_stock_name(ticker, candidate)
        )
        rows = []

        for date_value, row in history.tail(limit).iterrows():
            if hasattr(date_value, "date"):
                date_text = date_value.date().isoformat()
            else:
                date_text = str(date_value)[:10]

            rows.append(
                {
                    "name": stock_name,
                    "symbol": candidate,
                    "date": date_text,
                    "open": number_or_none(row.get("Open")),
                    "close": number_or_none(row.get("Close")),
                    "high": number_or_none(row.get("High")),
                    "low": number_or_none(row.get("Low")),
                    "volume": int_or_none(row.get("Volume")),
                    "sma5": number_or_none(row.get("SMA5")),
                    "sma20": number_or_none(row.get("SMA20")),
                    "bb_upper": number_or_none(row.get("BB_upper")),
                    "bb_lower": number_or_none(row.get("BB_lower")),
                    "cross_signal": row.get("CrossSignal"),
                }
            )

        return {
            "name": stock_name,
            "symbol": candidate,
            "query": symbol,
            "timeframe": timeframe,
            "period": selected_period or "custom",
            "interval": interval,
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": end_date.isoformat() if end_date else None,
            "rows": rows,
            "news": fetch_stock_news(ticker, 3),
            "reports": fetch_analyst_reports(ticker, candidate, 3),
        }

    raise HTTPException(
        status_code=404,
        detail="주가 데이터를 찾을 수 없습니다. 예: AAPL, MSFT, 005930.KS",
    )


def format_market_chart_label(value) -> str:
    try:
        timestamp = value.to_pydatetime() if hasattr(value, "to_pydatetime") else value
    except Exception:
        timestamp = value

    if isinstance(timestamp, datetime):
        if timestamp.hour or timestamp.minute:
            return timestamp.strftime("%H:%M")
        return timestamp.strftime("%m/%d")

    text = clean_text(value)
    return text[:5] if text else ""


def fetch_market_overview_from_yfinance(category: str = "index"):
    try:
        import yfinance as yf
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail="yfinance 패키지가 설치되어 있지 않습니다.",
        ) from exc

    category_config = MARKET_OVERVIEW_CATEGORIES.get(category)
    if category_config is None:
        raise HTTPException(status_code=400, detail="지원하지 않는 시장 구분입니다.")

    rows = []
    chart_points = []
    chart_labels = []

    for item in category_config["symbols"]:
        ticker = yf.Ticker(item["symbol"])
        history = None

        for period, interval in [("1d", "5m"), ("5d", "1d")]:
            try:
                history = ticker.history(
                    period=period,
                    interval=interval,
                    auto_adjust=False,
                )
            except Exception:
                history = None

            if history is not None and not history.empty:
                break

        if history is None or history.empty:
            continue

        history = history.dropna(subset=["Close"])
        if history.empty:
            continue

        latest_close = number_or_none(history["Close"].iloc[-1])
        if latest_close is None:
            continue

        previous_close = None
        try:
            fast_info = ticker.fast_info
            previous_close = number_or_none(fast_info.get("previous_close"))
        except Exception:
            previous_close = None

        if previous_close in (None, 0):
            try:
                info = ticker.info
                previous_close = number_or_none(info.get("previousClose"))
            except Exception:
                previous_close = None

        if previous_close in (None, 0):
            close_values = [number_or_none(value) for value in history["Close"].tail(2)]
            close_values = [value for value in close_values if value is not None]
            previous_close = close_values[0] if len(close_values) > 1 else latest_close

        change = number_or_none(latest_close - previous_close)
        change_percent = (
            number_or_none((change / previous_close) * 100)
            if previous_close
            else None
        )
        is_highlight = len(rows) == 0
        recent_history = history.tail(24)
        item_chart_points = [
            value
            for value in (number_or_none(value) for value in recent_history["Close"])
            if value is not None
        ]
        item_chart_labels = [
            format_market_chart_label(index_value)
            for index_value, value in zip(
                recent_history.index,
                recent_history["Close"],
            )
            if number_or_none(value) is not None
        ]

        row = {
            "name": item["name"],
            "symbol": item["symbol"],
            "value": latest_close,
            "change": change,
            "change_percent": change_percent,
            "tone": "up" if (change or 0) >= 0 else "down",
            "highlight": is_highlight,
            "chart_points": item_chart_points,
            "chart_labels": item_chart_labels,
        }
        rows.append(row)

        if is_highlight:
            chart_points = item_chart_points
            chart_labels = item_chart_labels

    if not rows:
        raise HTTPException(status_code=503, detail="시장 데이터를 불러오지 못했습니다.")

    if not chart_points:
        chart_points = [row["value"] for row in rows if row.get("value") is not None]
        chart_labels = [row["name"] for row in rows if row.get("value") is not None]

    return {
        "category": category,
        "label": category_config["label"],
        "rows": rows,
        "chart_points": chart_points,
        "chart_labels": chart_labels,
        "updated_at": datetime.now().isoformat(timespec="seconds"),
    }


# --- 지표 계산 ---


def get_latest_valid_rows(rows: list[dict]) -> list[dict]:
    return [
        row
        for row in sorted(rows, key=lambda item: item.get("date") or "")
        if is_number(row.get("close"))
    ]


def build_stock_metrics(stock_data: dict) -> dict:
    rows = get_latest_valid_rows(stock_data.get("rows", []))
    if not rows:
        return {}

    latest = rows[-1]
    previous = rows[-2] if len(rows) >= 2 else None
    latest_close = latest.get("close")
    previous_close = previous.get("close") if previous else None
    volume_rows = [
        row.get("volume")
        for row in rows[-20:]
        if is_number(row.get("volume")) and row.get("volume") > 0
    ]
    avg_volume_20 = sum(volume_rows) / len(volume_rows) if volume_rows else None
    volume_ratio = (
        round(latest.get("volume") / avg_volume_20, 2)
        if is_number(latest.get("volume")) and avg_volume_20
        else None
    )
    recent_cross = next(
        (
            row
            for row in reversed(rows[-45:])
            if row.get("cross_signal") in {"golden", "dead"}
        ),
        None,
    )
    return_20 = (
        percent_change(rows[-21].get("close"), latest_close)
        if len(rows) >= 21
        else None
    )
    return_60 = (
        percent_change(rows[-61].get("close"), latest_close)
        if len(rows) >= 61
        else None
    )
    sma5 = latest.get("sma5")
    sma20 = latest.get("sma20")
    bb_upper = latest.get("bb_upper")
    bb_lower = latest.get("bb_lower")
    bb_position = "중립"
    if is_number(latest_close) and is_number(bb_upper) and latest_close > bb_upper:
        bb_position = "상단 돌파"
    elif is_number(latest_close) and is_number(bb_lower) and latest_close < bb_lower:
        bb_position = "하단 이탈"

    return {
        "latest_date": latest.get("date"),
        "latest_close": latest_close,
        "day_change": (
            round(latest_close - previous_close, 2)
            if is_number(latest_close) and is_number(previous_close)
            else None
        ),
        "day_change_pct": percent_change(previous_close, latest_close),
        "return_20d_pct": return_20,
        "return_60d_pct": return_60,
        "sma5": sma5,
        "sma20": sma20,
        "trend": "상승 우위" if is_number(sma5) and is_number(sma20) and sma5 > sma20 else "중립/약세",
        "bollinger_position": bb_position,
        "volume_ratio_20d": volume_ratio,
        "recent_cross_signal": recent_cross.get("cross_signal") if recent_cross else None,
        "recent_cross_date": recent_cross.get("date") if recent_cross else None,
    }


# --- 투자 판단 에이전트 ---


def build_stock_advice_context(stock_data: dict, metrics: dict) -> str:
    news = stock_data.get("news", [])[:3]
    reports = stock_data.get("reports", [])[:3]
    return json.dumps(
        {
            "stock": {
                "name": stock_data.get("name"),
                "symbol": stock_data.get("symbol"),
                "query": stock_data.get("query"),
            },
            "metrics": metrics,
            "news": [
                {
                    "title": item.get("title"),
                    "publisher": item.get("publisher"),
                    "published_at": item.get("published_at"),
                    "summary": item.get("summary"),
                }
                for item in news
            ],
            "analyst_reports": [
                {
                    "title": item.get("title"),
                    "publisher": item.get("publisher"),
                    "published_at": item.get("published_at"),
                    "summary": item.get("summary"),
                }
                for item in reports
            ],
        },
        ensure_ascii=False,
        indent=2,
    )


def make_fallback_opinion(agent: str, metrics: dict) -> str:
    day_pct = format_percent(metrics.get("day_change_pct"))
    return_20 = format_percent(metrics.get("return_20d_pct"))
    trend = metrics.get("trend", "중립")
    if agent == "AI 애널리스트":
        return (
            f"최근 종가 {format_compact_number(metrics.get('latest_close'))}, "
            f"일간 변동률 {day_pct}, 20거래일 수익률 {return_20}, 추세는 {trend}입니다."
        )
    if agent == "AI 경제학자":
        return (
            "시장 환경은 가격 추세와 거래량을 기준으로 보수적으로 해석했습니다. "
            f"20일 거래량 대비 배율은 {format_compact_number(metrics.get('volume_ratio_20d'))}입니다."
        )
    return "뉴스와 리포트는 수집 가능한 제목과 요약 중심으로 점검했습니다."


def invoke_stock_agent(agent: str, system_prompt: str, context: str, metrics: dict) -> dict:
    try:
        response = graph_module.llm.invoke(
            [
                SystemMessage(content=f"{system_prompt}\n\n{KOREAN_TRANSLATION_RULE}"),
                HumanMessage(content=context),
            ]
        )
        summary = clean_text(response.content)
    except Exception as exc:
        summary = make_fallback_opinion(agent, metrics)
        return {
            "agent": agent,
            "status": "fallback",
            "summary": summary,
            "error": clean_text(exc),
        }

    return {
        "agent": agent,
        "status": "done",
        "summary": summary,
    }


def fallback_decision(metrics: dict) -> InvestmentDecision:
    score = 0
    if is_number(metrics.get("return_20d_pct")):
        score += 1 if metrics["return_20d_pct"] > 0 else -1
    if is_number(metrics.get("return_60d_pct")):
        score += 1 if metrics["return_60d_pct"] > 0 else -1
    if metrics.get("trend") == "상승 우위":
        score += 1
    if metrics.get("recent_cross_signal") == "golden":
        score += 1
    if metrics.get("recent_cross_signal") == "dead":
        score -= 1
    if metrics.get("bollinger_position") == "상단 돌파":
        score -= 1
    if metrics.get("bollinger_position") == "하단 이탈":
        score -= 1
    if is_number(metrics.get("day_change_pct")) and metrics["day_change_pct"] < -3:
        score -= 1

    if score >= 2:
        verdict = "BUY"
        label = "매수 가능"
        first = "현재 데이터 기준으로는 분할 매수 검토가 가능합니다."
    elif score <= -1:
        verdict = "AVOID"
        label = "매수 보류"
        first = "현재 데이터 기준으로는 바로 사기보다 매수를 보류하는 편이 낫습니다."
    else:
        verdict = "WATCH"
        label = "관망"
        first = "현재 데이터 기준으로는 바로 사기보다 관망이 적절합니다."

    return InvestmentDecision(
        verdict=verdict,
        decision_label=label,
        confidence=min(82, 52 + abs(score) * 8),
        answer=(
            f"{first} 추세는 {metrics.get('trend', '중립')}이고, "
            f"20거래일 수익률은 {format_percent(metrics.get('return_20d_pct'))}, "
            f"최근 교차 신호는 {metrics.get('recent_cross_signal') or '없음'}입니다. "
            "이 판단은 실시간 데이터와 모델 분석을 바탕으로 한 참고 의견이며 투자 손익을 보장하지 않습니다."
        ),
        buy_conditions=[
            "종가가 단기 이동평균 위에서 유지되는지 확인",
            "거래량 증가가 하락 압력이 아니라 상승 확인으로 이어지는지 확인",
        ],
        risk_notes=[
            "뉴스 이벤트, 실적 발표, 환율 및 금리 변화에 따라 판단이 빠르게 바뀔 수 있습니다.",
            "개인 투자 성향과 보유 비중을 반영한 맞춤 자문은 아닙니다.",
        ],
    )


def invoke_decision_agent(stock_data: dict, metrics: dict, opinions: list[dict]) -> InvestmentDecision:
    context = json.dumps(
        {
            "stock": {
                "name": stock_data.get("name"),
                "symbol": stock_data.get("symbol"),
            },
            "metrics": metrics,
            "agent_opinions": opinions,
        },
        ensure_ascii=False,
        indent=2,
    )
    system_prompt = (
        "[역할] 너는 투자 여부를 최종 판단하는 AI 의사 결정자다. "
        "[목표] 하위 에이전트들의 의견을 종합하여 사용자가 해당 주식을 지금 매수해도 되는지 냉정하게 판단해라. "
        "[입력] AI 저널리스트, AI 경제학자, AI 애널리스트의 분석 의견 및 데이터 "
        "[출력] 첫 문장에 BUY, WATCH, AVOID 중 하나의 포지션을 명확히 명시하고, 그에 따른 판단 근거를 3문장 이내로 작성하고, '본 의견은 투자 손익을 보장하지 않는 참고용'이라는 문구를 짧게 포함해라. "
        "[제약] 시장 상황을 과장하지 말고 객관적 사실에만 기반하며, 투자 손익에 대한 보장성 발언은 절대 금지한다. "
        "[검증] 최종 출력물의 첫 번째 문장에 지정된 3가지 키워드(BUY, WATCH, AVOID) 중 하나가 반드시 포함되어 있는지 스스로 확인해라."
    )

    try:
        decision = graph_module.llm.with_structured_output(InvestmentDecision).invoke(
            [
                SystemMessage(content=f"{system_prompt}\n\n{KOREAN_TRANSLATION_RULE}"),
                HumanMessage(content=context),
            ]
        )
    except Exception:
        return fallback_decision(metrics)

    return decision


def get_decision_label(verdict: str, fallback_label: str) -> str:
    labels = {
        "BUY": "매수 가능",
        "WATCH": "관망",
        "AVOID": "매수 보류",
    }
    return labels.get(verdict, fallback_label or "관망")


def generate_stock_advice(symbol: str) -> dict:
    stock_data = fetch_stock_history_from_yfinance(symbol, "day", None, 504)
    metrics = build_stock_metrics(stock_data)
    context = build_stock_advice_context(stock_data, metrics)
    opinions = [
        invoke_stock_agent(
            "AI 저널리스트",
            (
                "[역할] 너는 주식 전문 AI 저널리스트다. "
                "[목표] 뉴스, 공시성 이슈, 리포트 제목을 분석하여 투자 판단에 영향을 줄 수 있는 긍정/부정 이벤트를 평가해라. "
                "[입력] 뉴스 헤드라인, 공시 데이터, context 문맥 데이터 "
                "[출력] 시장 심리에 영향이 큰 사건 중심으로 핵심 내용을 3문장 이내로 정리해라. "
                "[제약] 수익률에 대한 구체적인 수치 언급은 절대 금지한다. "
                "[검증] 작성 후 최종 출력물이 정확히 3문장 이내인지, 감성(긍정/부정)이 명확히 분리되었는지 스스로 검증해라."
            ),
            context,
            metrics,
        ),
        invoke_stock_agent(
            "AI 경제학자",
            (
                "[역할] 너는 거시경제 및 시장 트렌드를 분석하는 AI 경제학자다. "
                "[목표] 시장 흐름, 거래량, 가격 추세, 거시 리스크 관점에서 해당 종목의 현재 위치를 평가해라. "
                "[입력] 거래량 추이, 가격 트렌드 지표, metrics 데이터 "
                "[출력] 거시적 관점의 위험도와 흐름 평가를 3문장 이내로 작성해라. "
                "[제약] 단기적인 주가 예측이나 맹목적인 낙관론은 배제해라. "
                "[검증] 출력물에 거래량과 가격 추세에 대한 경제학적 근거가 포함되었는지 확인해라."
            ),
            context,
            metrics,
        ),
        invoke_stock_agent(
            "AI 애널리스트",
            (
                "[역할] 너는 기술적 분석 중심의 AI 애널리스트다. "
                "[목표] 이동평균선(SMA5, SMA20), 볼린저 밴드 등의 보조지표를 바탕으로 이상 신호와 매수 타이밍을 평가해라. "
                "[입력] SMA5, SMA20, 볼린저 밴드 상하한선 값, 최근 골든/데드크로스 교차 신호 "
                "[출력] 보조지표 기반의 이상 신호 및 추천 매수/매도 타이밍을 3문장 이내로 도출해라. "
                "[제약] 후행성 지표의 한계를 인지하고 오버피팅(과적합)된 확정적 어조는 금지한다. "
                "[검증] 언급한 기술적 지표(SMA, 볼린저 밴드)의 수치적 교차 신호가 논리적으로 맞는지 최종 검증해라."
            ),
            context,
            metrics,
        ),
    ]
    decision = invoke_decision_agent(stock_data, metrics, opinions)

    return {
        "stock": {
            "name": stock_data.get("name"),
            "symbol": stock_data.get("symbol"),
            "query": stock_data.get("query"),
        },
        "stock_data": stock_data,
        "metrics": metrics,
        "agents": opinions,
        "verdict": decision.verdict,
        "decision_label": get_decision_label(decision.verdict, decision.decision_label),
        "confidence": decision.confidence,
        "answer": decision.answer,
        "buy_conditions": decision.buy_conditions,
        "risk_notes": decision.risk_notes,
        "updated_at": datetime.now().isoformat(timespec="seconds"),
    }


# --- 라우터 ---

router = APIRouter()


@router.get("/stocks/history")
async def stock_history(
    symbol: str = Query(..., min_length=1),
    timeframe: str = Query("day"),
    period: str | None = Query(None),
    limit: int = Query(504, ge=1, le=5000),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
):
    return await run_in_threadpool(
        fetch_stock_history_from_yfinance,
        symbol,
        timeframe,
        period,
        limit,
        start_date,
        end_date,
    )


@router.get("/markets/overview")
async def market_overview(category: str = Query("index")):
    return await run_in_threadpool(fetch_market_overview_from_yfinance, category)


@router.get("/stocks/suggestions")
async def stock_suggestions(
    query: str = Query(..., min_length=1),
    limit: int = Query(5, ge=1, le=10),
    db: AsyncSession = Depends(get_db),
):
    await ensure_listed_companies(db)

    keyword = normalize_search_text(query)
    initials = get_initial_consonants(query)
    if not keyword and not initials:
        return []

    result = await db.execute(select(ListedCompany))
    companies = result.scalars().all()

    def score(company: ListedCompany) -> tuple[int, str]:
        name = normalize_search_text(company.name)
        symbol = normalize_search_text(company.symbol)
        company_initials = company.initial_consonants
        if keyword and symbol.startswith(keyword):
            return (0, company.name)
        if keyword and name.startswith(keyword):
            return (1, company.name)
        if initials and company_initials.startswith(initials):
            return (2, company.name)
        if keyword and keyword in name:
            return (3, company.name)
        if initials and initials in company_initials:
            return (4, company.name)
        return (99, company.name)

    matches = [
        company
        for company in companies
        if score(company)[0] < 99
    ]
    matches.sort(key=score)
    return [serialize_company(company) for company in matches[:limit]]


@router.post("/stocks/advice")
async def stock_advice(req: StockAdviceRequest):
    return await run_in_threadpool(generate_stock_advice, req.symbol)
