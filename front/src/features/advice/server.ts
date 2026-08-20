/**
 * AI 판단 feature 의 **서버 전용 공개 경계.**
 *
 * BFF 라우트(`app/api/stocks/advice`)만 쓴다. `index.ts` 와 가른 이유는
 * `features/watchlist/server.ts` 와 같다 — 이쪽은 목 시퀀스와 백엔드 와이어 타입을
 * 들고 있어 브라우저에 실릴 이유가 없다. 배럴이 하나면 클라이언트 컴포넌트가
 * `@/features/advice` 를 부르는 것만으로 목 데이터 전체가 번들에 딸려 온다.
 *
 * 예전에는 라우트가 이 셋을 `@/features/advice/model/...` 로 **깊게 참조**했다.
 * feature 내부 파일을 밖에서 직접 열면 이름을 바꾸는 순간 라우트가 깨진다
 * (CONVENTIONS 4: 경계는 배럴로만).
 */
export { mockAdviceEvents } from "./model/mockStream";
export { toAdviceEvent, type WireAdviceEvent } from "./model/wire";
