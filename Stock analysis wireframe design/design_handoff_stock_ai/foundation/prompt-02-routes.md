# Claude Code 붙여넣기용 프롬프트 — 2단계 라우트 골격

> 첨부: `02-routes.md`, `lib/types.ts`, `README.md`
> 선행: 1단계 프리미티브 검수 통과

---

이제 라우트 골격과 데이터 계약을 세워줘. **디자인은 아직 하지 마.** 구조와 데이터 흐름만.

**만들 라우트** (첨부 `02-routes.md` 트리 그대로)
```
app/page.tsx                      시장 홈        Server
app/stocks/[symbol]/page.tsx      종목 상세      Server
app/stocks/[symbol]/loading.tsx   스켈레톤
app/stocks/[symbol]/error.tsx     조회 실패 + 재시도
app/watchlist/page.tsx            관심종목       Server shell
app/api/search/route.ts
app/api/listed-companies/route.ts
app/api/ai/advice/route.ts        SSE
```

**URL 규칙**
`[symbol]`은 사람이 읽는 코드(`005930`, `AAPL`)를 쓴다. yfinance 심볼(`005930.KS`) 변환은 **서버에서만** `krx_symbol_to_yfinance`로. URL이 공유 가능해야 한다.

**데이터 레이어**
`lib/types.ts`의 타입만 화면에 넘긴다. API 원본 응답 형태를 컴포넌트에 그대로 흘리지 마.
- `lib/api/stocks.ts` — `getStockHistory`, `getQuote`, `getMetrics`, `getNews`, `getReports`
- `lib/api/search.ts` — `searchStocks`, `getListedCompaniesStatus`
- 지금은 각 함수가 **mock 데이터를 반환**하게 해줘 (`lib/api/__mock__/`). 실제 백엔드 연결은 다음 단계.
- mock은 삼성전자(005930) / SK하이닉스(000660) / 애플(AAPL) 3종목, 240봉 OHLCV, 뉴스 3건, 리포트 3건.
- 240봉은 하드코딩 배열 말고 시드 고정 생성기로 (`lib/api/__mock__/generate.ts`) — MA20/MA60/볼린저밴드/골든·데드크로스가 실제로 계산돼 나와야 한다.

**서버/클라이언트 경계** (첨부 표대로 지킬 것)
- 헤드라인·지표·뉴스·리포트 = Server Component, `revalidate: 60`
- 차트, 검색 팔레트, AI 드로어, 관심종목 표 = Client
- 탭(뉴스/리포트/재무)은 3개 패널을 서버에서 다 받아두고 전환만 클라이언트

**AI 스트리밍 계약**
`app/api/ai/advice/route.ts`는 `AiStreamEvent`(lib/types.ts)를 SSE로 이 순서대로 흘린다:
```
{stage:1} → {stage:2} → {stage:3, agent} ×3 → {stage:4, decision}
```
지금은 mock 타이밍(650 / 1250 / 1900 / 2700ms)으로 흘려줘. 클라이언트 훅 `useAiAdvice(symbol)`을 만들어서 `{stage, agents[], decision, error}`를 반환하게.
`decision.source === "fallback"`인 경로도 mock으로 재현 가능해야 한다 (쿼리 `?fallback=1`).

**첫 호출 지연**
`api/listed-companies`는 `{ready, loaded, total, source}`를 반환. mock에서 처음 3회는 `ready:false`로 카운트가 올라가다가 그 다음부터 `ready:true`.

**확인 방법**
각 라우트에 임시로 데이터를 `<pre>{JSON.stringify(...)}</pre>`로 덤프해서 값이 다 들어오는지만 보여줘. 스타일은 붙이지 마.

**끝나고 알려줄 것**
- [ ] `/stocks/005930`, `/stocks/AAPL` 둘 다 데이터가 덤프된다
- [ ] `/api/ai/advice?symbol=005930`을 curl로 받으면 5개 이벤트가 순서대로 흐른다
- [ ] `?fallback=1`이면 `source:"fallback"` decision이 온다
- [ ] `loading.tsx`가 실제로 보인다 (mock에 지연 400ms 삽입)
- [ ] `error.tsx`가 잘못된 심볼(`/stocks/999999`)에서 뜬다
- [ ] 타입 에러 0, 빌드 통과

다음 단계는 종목 상세(2a) 디자인이야. 지금은 만들지 마.
