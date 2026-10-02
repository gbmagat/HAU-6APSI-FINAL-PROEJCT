import "server-only";

import { Pool } from "pg";

let pool: Pool | undefined;

export function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
    // An idle connection that drops is discarded by the pool; the next query opens a fresh one.
    pool.on("error", (error) => console.error("PostgreSQL idle connection error:", error.message));
  }
  return pool;
}
