export interface ResultSummaryProps {
  /** 실제로 그린 행 수 */
  shown: number;
  /** 현재 필터·조건 기준 전체 건수. 백엔드가 한 페이지와 따로 준다 */
  total: number;
}

/**
 * 목록 끝에서 "이게 전부인가" 에 답한다.
 *
 * 백엔드는 필터 후 전체 건수(`total`)와 한 페이지(50행)를 따로 준다. 예전 화면은
 * 필터 바에 `200종목` 만 적고 50행을 그렸다 — 150종목이 조용히 사라진 셈이었다.
 * 페이지네이션이 아직 없으므로 최소한 잘렸다는 사실은 밝힌다. 자리를 목록 **끝**으로
 * 잡은 것은 그 질문이 거기서 생기기 때문이다.
 *
 * 랭킹 표와 조건 검색 표가 같이 쓴다 — 열 구성은 달라도 "몇 건 중 몇 건" 이라는 답은
 * 같아야 한다. 이름에 `Ranking` 이 남아 있던 동안 조건 검색이 그것을 폴더 밖에서
 * 깊은 경로로 집어가고 있었다.
 */
export function ResultSummary({ shown, total }: ResultSummaryProps) {
  const truncated = total > shown;

  return (
    <p className="num pt-1 text-muted-45" style={{ fontSize: 10 }}>
      {truncated
        ? `전체 ${total.toLocaleString("ko-KR")}종목 중 상위 ${shown.toLocaleString("ko-KR")}종목`
        : `${shown.toLocaleString("ko-KR")}종목`}
    </p>
  );
}
