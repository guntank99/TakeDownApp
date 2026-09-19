import "server-only";

import postgres from "postgres";
import type { SqlClient } from "./postgres";

/**
 * Opens the PostgreSQL connection from DATABASE_URL.
 *  - max: 1 connection per server instance: right for serverless, and it keeps
 *    us far below a hosted database's connection limit.
 *  - prepare: false works with transaction poolers such as Supabase's.
 *  - TLS is required unless the database is on localhost (or DATABASE_SSL=disable).
 */
export function connectPostgres(url: string): SqlClient {
  const local = /@(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(url);
  const ssl = process.env.DATABASE_SSL === "disable" || local ? false : "require";
  const sql = postgres(url, { max: 1, prepare: false, idle_timeout: 20, connect_timeout: 15, ssl });
  return {
    query: (text, params) => sql.unsafe(text, (params ?? []) as never[]) as never,
  };
}
