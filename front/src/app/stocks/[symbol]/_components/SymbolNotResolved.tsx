import Link from "next/link";
import { decimal, percent as fmtPercent, price as fmtPrice, deltaColorClass } from "@/lib/format";
import { resolveCandidates } from "@/features/search";
import { Chip } from "@/shared/ui";

/**
 * 종목 코드 정규화 실패 (와이어프레임 1d 네 번째 패널).
 *
 * notFound() 로 보내지 않는 이유: 사용자가 입력한 문자열을 화면에 남겨야
 * "이걸 못 찾았고 대신 이런 후보가 있다"를 말할 수 있는데, not-found.tsx 는
 * 그 값을 받지 못한다.
 *
 * 후보 조회는 features/search 소유라 app 계층인 여기서 두 도메인을 조합한다.
 */
export function SymbolNotResolved({ query }: { query: string }) {
  const candidates = resolveCandidates(query);

  return (
    <section className="flex flex-col gap-4 border-t border-line-20 pt-5">
      <p
        className="font-mono uppercase tracking-label text-muted-60"
        style={{ fontSize: 10.5 }}
      >
        normalize_stock_code · 실패
      </p>

      <h1
        className="font-serif-kr font-bold leading-none"
        style={{ fontSize: 34 }}
      >
        <span className="num">{query}</span>
      </h1>

      <p className="text-pretty text-muted-70" style={{ fontSize: 13.5 }}>
        6자리 코드를 찾지 못했습니다. 아래 후보 중에서 골라 주세요.
      </p>

      <ul className="flex flex-col">
        {candidates.map((item) => (
          <li key={item.symbol}>
            <Link
              href={`/stocks/${item.code}`}
              className="flex items-center gap-3.5 border-b border-dotted border-line-22 py-3 hover:bg-surface-hover"
            >
              <span className="flex flex-1 flex-col gap-[3px]">
                <span
                  className="font-serif-kr font-medium"
                  style={{ fontSize: 16.5 }}
                >
                  {item.name}
                </span>
                <span
                  className="font-mono text-muted-50"
                  style={{ fontSize: 10.5 }}
                >
                  {item.nameEn ?? item.symbol}
                </span>
              </span>
              <Chip size={10}>{item.market}</Chip>
              <span
                className="num w-[82px] text-right font-medium text-muted-75"
                style={{ fontSize: 11 }}
              >
                {item.symbol}
              </span>
              {/* 시세는 자동완성 응답에 없다 (목 데이터에서만 채워진다) */}
              {item.price !== undefined && item.changePercent !== undefined ? (
                <span className="num flex w-[88px] flex-col items-end gap-0.5">
                  <span className="font-medium" style={{ fontSize: 14 }}>
                    {item.market === "NASDAQ" || item.market === "NYSE"
                      ? decimal(item.price, 2)
                      : fmtPrice(item.price)}
                  </span>
                  <span
                    className={`font-medium ${deltaColorClass(item.changePercent)}`}
                    style={{ fontSize: 11 }}
                  >
                    {fmtPercent(item.changePercent)}
                  </span>
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>

      <p
        className="num border-t border-line-20 pt-[9px] text-muted-45"
        style={{ fontSize: 10, lineHeight: 1.6 }}
      >
        normalize_stock_code · krx_symbol_to_yfinance (.KS/.KQ)
      </p>
    </section>
  );
}
