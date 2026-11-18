import "server-only";
import pg from "pg";

const { Pool } = pg;

declare global {
  var __pgPool: pg.Pool | undefined;
}

function getPool(): pg.Pool {
  if (global.__pgPool) {
    return global.__pgPool;
  }

  const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://postgres.ougxttjcgonjgstksham:wsxtgbqazB5%236914@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres";

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  if (process.env.NODE_ENV !== "production") {
    global.__pgPool = pool;
  }

  return pool;
}

export const db = {
  query: async <T extends pg.QueryResultRow = any>(
    text: string,
    params?: unknown[]
  ): Promise<pg.QueryResult<T>> => {
    const pool = getPool();
    return pool.query<T>(text, params);
  },
};
