"""텍스트 정규화 · 한글 초성 추출 순수 함수."""

import re
from datetime import datetime
from typing import Any

ZERO_WIDTH_PATTERN = re.compile(r"[​-‏⁠﻿]")
NON_SEARCH_TEXT_PATTERN = re.compile(r"[^0-9A-Za-z가-힣]")
HANGUL_INITIALS = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"

_HANGUL_START = 0xAC00
_HANGUL_END = 0xD7A3
_JONGSUNG_JUNGSUNG_COUNT = 588  # 중성 21 × 종성 28


def clean_text(value: Any) -> str:
    if value is None:
        return ""

    return ZERO_WIDTH_PATTERN.sub("", str(value)).strip()


def format_date_text(value: Any) -> str:
    if value is None:
        return ""

    if isinstance(value, datetime):
        return value.date().isoformat()

    text = clean_text(value)
    if "T" in text:
        return text.split("T", 1)[0]

    return text[:10]


def normalize_search_text(value: str) -> str:
    """검색 비교용 정규화: 공백·기호 제거 후 소문자."""
    return NON_SEARCH_TEXT_PATTERN.sub("", clean_text(value)).lower()


def get_initial_consonants(value: str) -> str:
    """한글 초성 문자열. 한글이 아닌 문자는 소문자로 그대로 통과시킨다."""
    result: list[str] = []
    for char in clean_text(value):
        code = ord(char)
        if _HANGUL_START <= code <= _HANGUL_END:
            result.append(HANGUL_INITIALS[(code - _HANGUL_START) // _JONGSUNG_JUNGSUNG_COUNT])
        elif char.strip():
            result.append(char.lower())
    return "".join(result)
