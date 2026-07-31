import { MOCK_BRIEFING, type MorningBriefing } from "../model/briefing";

/**
 * AI 아침 브리핑. 서버에서만 실행된다.
 *
 * TODO(백엔드 연결): 대응 엔드포인트가 없다.
 * 백엔드의 generate_stock_advice 는 종목 단위이고, 시장 전체를 요약하는 브리핑과
 * 관심 종목 일괄 판단은 별도 작업이 필요하다 (관심 종목 N개 × 3 에이전트는
 * 비용·지연이 크므로 배치 생성 후 캐시가 현실적이다).
 */
export async function getMorningBriefing(): Promise<MorningBriefing> {
  return MOCK_BRIEFING;
}
