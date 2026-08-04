import { compact, marketCapKR, multiple, price, unsignedPercent, ymd } from "@/lib/format";
import { DottedRow, SectionLabel, StatRow } from "@/shared/ui";
import type { Currency } from "@/shared/types";
import type { AnnualFinancial, Fundamentals } from "../model/types";

/**
 * 재무 탭. 밸류에이션 지표 + 연간 실적.
 *
 * 값이 없는 행은 대시(—)를 그리지 않고 **행 자체를 뺀다** (ReportDigest 와 같은 규칙).
 * 무배당 종목에 "배당수익률 —"이 남으면 데이터가 있는데 못 읽은 것처럼 보인다.
 *
 * 조회 실패는 예외가 아니라 `null` 로 온다 — 재무 한 칸 때문에 상세 페이지가
 * 에러 화면이 되면 안 되기 때문이다 (services/getStockDetail.ts).
 */
export function FinancialsPanel({
  fundamentals,
  currency = "KRW",
}: {
  fundamentals: Fundamentals | null;
  currency?: Currency;
}) {
  const rows = fundamentals ? valuationRows(fundamentals, currency) : [];
  const annual = fundamentals?.annual ?? [];

  if (rows.length === 0 && annual.length === 0) {
    return (
      <p className="py-6 text-center text-muted-60" style={{ fontSize: 12.5 }}>
        재무 정보를 불러오지 못했습니다.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {rows.length > 0 ? (
        <section className="flex flex-col gap-3">
          <SectionLabel variant="rule" size={11}>
            밸류에이션
          </SectionLabel>
          <div className="grid grid-cols-1 gap-x-8 gap-y-[11px] md:grid-cols-2">
            {rows.map((row) => (
              <StatRow key={row.label} label={row.label} value={row.value} />
            ))}
          </div>
        </section>
      ) : null}

      {annual.length > 0 ? (
        <section className="flex flex-col gap-3">
          <SectionLabel variant="rule" size={11} right="최대 4개년">
            연간 실적
          </SectionLabel>
          <div className="flex flex-col">
            <AnnualHeader />
            {annual.map((row) => (
              <AnnualRow key={row.year} row={row} currency={currency} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

interface Row {
  label: string;
  value: string;
}

/** null 인 항목은 배열에 담기지 않는다 — 그게 이 함수의 전부다. */
function valuationRows(f: Fundamentals, currency: Currency): Row[] {
  const rows: Row[] = [];
  const push = (label: string, value: string | null) => {
    if (value !== null) rows.push({ label, value });
  };
  const num = (value: number | null, format: (v: number) => string) =>
    value === null ? null : format(value);

  push("PER", num(f.per, (v) => multiple(v)));
  push("PBR", num(f.pbr, (v) => multiple(v)));
  push("EPS", num(f.eps, (v) => price(v, currency)));
  push("BPS", num(f.bps, (v) => price(v, currency)));
  // ROE·배당수익률은 등락이 아니라 수준이라 부호를 붙이지 않는다 (percent() 금지).
  push("ROE", num(f.roePercent, (v) => unsignedPercent(v)));
  push("시가총액", num(f.marketCap, (v) => amount(v, currency)));
  push("배당수익률", num(f.dividendYieldPercent, (v) => unsignedPercent(v)));
  push("주당배당금", num(f.dividendPerShare, (v) => price(v, currency)));
  push("배당락일", f.exDividendDate === null ? null : ymd(f.exDividendDate));
  push("다음 실적발표", f.nextEarningsDate === null ? null : ymd(f.nextEarningsDate));

  return rows;
}

/** 원화는 조·억, 그 외는 K/M/B. 통화 판정은 심볼에서 오므로 여기서 다시 하지 않는다. */
function amount(value: number, currency: Currency): string {
  return currency === "KRW" ? marketCapKR(value) : compact(value);
}

const CELL = "num flex-1 text-right";

function AnnualHeader() {
  return (
    <DottedRow align="baseline" className="pb-[7px]">
      <span
        className="w-14 font-mono uppercase tracking-label text-muted-45"
        style={{ fontSize: 10.5 }}
      >
        FY
      </span>
      {["매출", "영업이익", "영업이익률"].map((label) => (
        <span
          key={label}
          className="flex-1 text-right text-muted-45"
          style={{ fontSize: 10.5 }}
        >
          {label}
        </span>
      ))}
    </DottedRow>
  );
}

function AnnualRow({ row, currency }: { row: AnnualFinancial; currency: Currency }) {
  // 매출이 0이면 이익률이 의미가 없다 — 나눗셈 자체를 하지 않는다.
  const margin =
    row.revenue && row.operatingIncome !== null
      ? (row.operatingIncome / row.revenue) * 100
      : null;
  const loss = row.operatingIncome !== null && row.operatingIncome < 0;

  return (
    <DottedRow align="baseline" className="py-[7px]">
      <span className="num w-14 font-medium" style={{ fontSize: 12.5 }}>
        {row.year}
      </span>
      <span className={CELL} style={{ fontSize: 12.5 }}>
        {row.revenue === null ? "—" : amount(row.revenue, currency)}
      </span>
      {/* 영업이익은 PER 과 달리 방향이 의미를 갖는 값이라 적자에 색을 준다. */}
      <span className={`${CELL} ${loss ? "text-down" : ""}`} style={{ fontSize: 12.5 }}>
        {row.operatingIncome === null ? "—" : amount(row.operatingIncome, currency)}
      </span>
      <span
        className={`${CELL} ${margin !== null && margin < 0 ? "text-down" : "text-muted-60"}`}
        style={{ fontSize: 12.5 }}
      >
        {margin === null ? "—" : unsignedPercent(margin, 1)}
      </span>
    </DottedRow>
  );
}
