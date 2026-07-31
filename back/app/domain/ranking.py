"""자동완성 랭킹 (명세 6.2). 순수 함수 — I/O 없음.

원본 스코어링은 (등급, 종목명) 이라 같은 등급 안에서 가나다순으로 끊겼다.
그래서 "삼성"을 치면 삼성E&A·삼성FN리츠·삼성SDI·삼성공조·삼성물산이 먼저 나오고
삼성전자는 화면에 없었다. 등급 안의 2차 정렬을 시가총액으로 바꾼다.
"""

import re

from app.models.listed_company import ListedCompany

# 등급 — 낮을수록 먼저.
RANK_EXACT = 0  # 티커 완전 일치 또는 종목명 완전 일치
RANK_PREFIX = 1  # 접두사 일치 (심볼·이름·초성)
RANK_PARTIAL = 2  # 부분 일치
RANK_NONE = 99  # 매칭 없음 — 결과에서 제외

# 보통주가 아닌 종목. 우선주는 '삼성전자우'처럼 이름 끝에 우/우B 가 붙고,
# 리츠·스팩은 이름 자체에 포함된다. 시총 배치 전(전부 NULL)일 때 쓰는 폴백 신호다.
_PREFERRED_SUFFIX = re.compile(r"(우[BC]?|\(전환\)|\(신형\))$")
_NON_COMMON_KEYWORDS = ("리츠", "스팩", "기업인수목적")

# KRX CSV 는 시장을 한글('코스피')로, KIND·내부 목록은 영문('KOSPI')으로 준다.
# 한쪽만 적어두면 실제 DB(한글)에서 이 우선순위가 통째로 무시된다.
_MARKET_PRIORITY = {
    "KOSPI": 0,
    "코스피": 0,
    "KOSDAQ": 1,
    "코스닥": 1,
    "KONEX": 2,
    "코넥스": 2,
}
_MARKET_PRIORITY_DEFAULT = 3


def is_common_stock(name: str) -> bool:
    """보통주로 보이는가. 우선주·리츠·스팩이면 False."""
    if _PREFERRED_SUFFIX.search(name):
        return False
    return not any(keyword in name for keyword in _NON_COMMON_KEYWORDS)


def match_rank(company: ListedCompany, keyword: str, initials: str) -> int:
    """매칭 등급. 완전 일치 → 접두사 → 부분 순."""
    if keyword and (company.search_symbol == keyword or company.search_name == keyword):
        return RANK_EXACT

    if keyword and (
        company.search_symbol.startswith(keyword) or company.search_name.startswith(keyword)
    ):
        return RANK_PREFIX
    if initials and company.initial_consonants.startswith(initials):
        return RANK_PREFIX

    if keyword and keyword in company.search_name:
        return RANK_PARTIAL
    if initials and initials in company.initial_consonants:
        return RANK_PARTIAL

    return RANK_NONE


def _fallback_key(company: ListedCompany) -> tuple[int, int, int, str]:
    """시가총액이 없을 때의 대체 순서.

    보통주 우선 → KOSPI 우선 → 종목명 길이 오름차순 → 가나다순.
    이름이 짧을수록 대표 종목일 확률이 높다는 경험칙이다 ('삼성전자' < '삼성전자우').
    """
    return (
        0 if is_common_stock(company.name) else 1,
        _MARKET_PRIORITY.get(company.market or "", _MARKET_PRIORITY_DEFAULT),
        len(company.name),
        company.name,
    )


def sort_key(
    company: ListedCompany, keyword: str, initials: str
) -> tuple[int, int, int, tuple[int, int, int, str]]:
    """정렬 키. 튜플이 작을수록 위로 온다.

      1. 매칭 등급 (완전 → 접두사 → 부분)
      2. 시가총액 유무 (있는 쪽 먼저 — NULL 은 등급 안에서 항상 뒤)
      3. 시가총액 내림차순 (음수로 뒤집는다)
      4. 폴백 키 (시총이 같거나 둘 다 없을 때)
    """
    rank = match_rank(company, keyword, initials)
    cap = company.market_cap
    return (
        rank,
        0 if cap else 1,
        -(cap or 0),
        _fallback_key(company),
    )


def rank_companies(
    companies: list[ListedCompany], keyword: str, initials: str
) -> list[ListedCompany]:
    """매칭되지 않은 종목을 걸러내고 순위대로 정렬한다."""
    matched = [c for c in companies if match_rank(c, keyword, initials) != RANK_NONE]
    matched.sort(key=lambda c: sort_key(c, keyword, initials))
    return matched
