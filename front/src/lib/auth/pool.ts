import { Pool } from "pg";

/**
 * NextAuth 어댑터가 쓰는 Postgres 커넥션 풀.
 *
 * **프런트가 DB 에 직접 붙는 유일한 지점이다.** 나머지는 전부 FastAPI 를 거친다
 * (CONVENTIONS). 여기만 예외인 이유는 어댑터가 커넥션을 요구하기 때문이고, 그
 * 대가로 이 파일이 만지는 테이블은 NextAuth 의 넷(users·accounts·sessions·
 * verification_token)뿐이다 — 종목·관심종목 같은 도메인 데이터는 여기서 안 읽는다.
 *
 * ## 접속 문자열
 *
 * 백엔드의 `DATABASE_URL` 과 **같은 Supabase** 를 본다. 다만 형태가 다르다.
 *
 *   백엔드  postgresql+asyncpg://...   ← SQLAlchemy 방언 접두가 붙는다
 *   여기    postgresql://...           ← node-postgres 는 그걸 모른다
 *
 * 그래서 `+asyncpg` 를 떼고, libpq 파라미터(`sslmode`)는 **남긴다** — node-postgres 는
 * libpq 규약을 따르므로 백엔드에서 떼어냈던 것이 여기서는 오히려 필요하다
 * (`back/app/core/db_url.py` 의 `to_sync_url` 과 같은 이유).
 */

let pool: Pool | null = null;

/** SQLAlchemy 방언 접두를 떼고 node-postgres 가 이해하는 형태로. */
export function toNodePostgresUrl(raw: string): string {
  return raw.replace(/^postgresql\+\w+:\/\//, "postgresql://");
}

export function authPool(): Pool {
  if (pool) return pool;

  const raw = process.env.AUTH_DATABASE_URL || process.env.DATABASE_URL || "";
  if (!raw) {
    // 여기까지 왔다는 것은 프로바이더가 설정됐다는 뜻인데 DB 주소가 없다.
    // 조용히 넘어가면 첫 로그인 시도에서야 알게 된다.
    throw new Error(
      "로그인이 켜져 있는데 DATABASE_URL 이 없습니다. " +
        "back/.env 의 Supabase 주소를 front/.env.local 에도 넣어 주세요.",
    );
  }

  pool = new Pool({
    connectionString: toNodePostgresUrl(raw),
    // Supabase 풀러는 자체 서명 CA 를 쓴다. libpq 의 `sslmode=require` 와 같은 뜻으로,
    // 암호화는 하되 CA 검증은 하지 않는다 (10회차에 백엔드에서 겪은 것과 같은 함정).
    ssl: { rejectUnauthorized: false },
    // 세션·토큰 조회는 짧고 드물다. 서버리스에서 유휴 커넥션이 쌓이지 않게 작게 둔다.
    max: 3,
    idleTimeoutMillis: 10_000,
  });
  return pool;
}
