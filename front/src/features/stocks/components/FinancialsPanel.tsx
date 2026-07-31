/**
 * 재무 탭. 디자인 핸드오프에 이 탭의 내용이 없어 빈 상태로 둔다.
 * 백엔드에도 대응 엔드포인트가 없다 — 화면 설계가 나오면 채운다.
 */
export function FinancialsPanel() {
  return (
    <div className="flex flex-col items-center gap-2 border border-dashed border-line-30 py-10">
      <p
        className="font-mono uppercase tracking-label text-muted-35"
        style={{ fontSize: 10.5 }}
      >
        financials
      </p>
      <p className="text-muted-60" style={{ fontSize: 12.5 }}>
        재무 화면은 아직 설계되지 않았습니다.
      </p>
    </div>
  );
}
