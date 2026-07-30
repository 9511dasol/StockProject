# 레거시

`app/` 패키지로 이관이 끝난 원본 코드를 되돌아볼 수 있도록만 남겨둔 폴더다.
**애플리케이션은 이 폴더를 import하지 않으며, 여기 코드는 실행되지 않는다.**

## finance.py

1332줄짜리 원본. 존재하지 않는 `database` · `models` · `graph` 모듈을 import하므로
그 자체로는 실행되지 않는다. 이관 매핑:

| 원본 영역 | 이관 위치 |
|---|---|
| 종목 코드/이름 정규화, 초성 | `app/domain/symbols.py`, `app/utils/text.py` |
| 상수 (종목 매핑, 기간, 시장 카테고리) | `app/domain/constants.py`, `app/domain/market_catalog.py` |
| 값 정규화·포맷 유틸 | `app/utils/numbers.py`, `app/utils/text.py` |
| KRX/KIND 상장사 수집·파싱 | `app/integrations/krx/` |
| yfinance 주가·뉴스·리포트·시장 | `app/integrations/yfinance/` |
| 지표 계산 (`build_stock_metrics`) | `app/domain/metrics.py` |
| 에이전트 프롬프트·호출·폴백 | `app/agents/` |
| 스키마 (`InvestmentDecision` 등) | `app/schemas/` |
| 라우터 | `app/api/v1/endpoints/` |

내용 대조가 끝나면 이 폴더째 삭제하면 된다.
