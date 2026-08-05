export interface RankingSummaryProps {
  /** 실제로 그린 행 수 */
  shown: number;
  /** 현재 필터 기준 전체 건수. 백엔드가 한 페이지와 따로 준다 */
  total: number;
}

/**
 * 목록 끝에서 "이게 전부인가" 에 답한다.
 *
 * 백엔드는 필터 후 전체 건수(`total`)와 한 페이지(`RANKING_PAGE_SIZE` = 50행)를
 * 따로 준다. 예전 화면은 필터 바에 `200종목` 만 적고 50행을 그렸다 — 150종목이
 * 조용히 사라진 셈이었다. 페이지네이션이 아직 없으므로 최소한 잘렸다는 사실은
 * 밝힌다. 자리를 목록 **끝**으로 잡은 것은 그 질문이 거기서 생기기 때문이다.
 */
export function RankingSummary({ shown, total }: RankingSummaryProps) {
  const truncated = total > shown;

  return (
    <p className="num pt-1 text-muted-45" style={{ fontSize: 10 }}>
      {truncated
        ? `전체 ${total.toLocaleString("ko-KR")}종목 중 상위 ${shown.toLocaleString("ko-KR")}종목`
        : `${shown.toLocaleString("ko-KR")}종목`}
    </p>
  );
}
