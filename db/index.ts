import { parseDatabaseUrl, requireDatabaseUrl } from "@/lib/database-url";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

export type AppDb = MySql2Database<typeof schema>;

function connectionOptions() {
  return {
    ...parseDatabaseUrl(requireDatabaseUrl()),
    // Required for Cloudflare Workers / Miniflare (no eval).
    disableEval: true as const,
  };
}

/**
 * Open a short-lived MySQL connection for one request.
 * Workers-compatible: disableEval + no long-lived pool across isolates.
 */
export async function withDb<T>(fn: (db: AppDb) => Promise<T>): Promise<T> {
  const connection = await mysql.createConnection(connectionOptions());
  try {
    const db = drizzle(connection, { schema, mode: "default" });
    return await fn(db);
  } finally {
    await connection.end().catch(() => undefined);
  }
}

/** @deprecated Prefer withDb() for Workers; kept for scripts. */
export function getDb(): AppDb {
  throw new Error("Use withDb() instead of getDb() in Workers API routes.");
}
