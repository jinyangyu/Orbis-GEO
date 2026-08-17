import { withDb } from "@/db";
import { sql } from "drizzle-orm";
import { reportError } from "@/lib/observability/report-error";

type CheckStatus = "ok" | "fail" | "skipped";

/**
 * Liveness + optional readiness.
 * - Always returns process liveness.
 * - DB check runs by default; pass `?ready=0` to skip DB for pure liveness probes.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const skipDb = url.searchParams.get("ready") === "0";
  const started = Date.now();

  const checks: { db: CheckStatus; dbMs?: number; dbError?: string } = {
    db: "skipped",
  };

  if (!skipDb) {
    try {
      const t0 = Date.now();
      await withDb(async (db) => {
        await db.execute(sql`SELECT 1`);
      });
      checks.db = "ok";
      checks.dbMs = Date.now() - t0;
    } catch (error) {
      checks.db = "fail";
      checks.dbError =
        error instanceof Error ? error.message.slice(0, 200) : "db error";
      reportError(error, { source: "api.health", check: "db" });
    }
  }

  const ready = skipDb || checks.db === "ok";
  const body = {
    ok: ready,
    status: ready ? "ok" : "degraded",
    service: "orbis-seo-geo-platform",
    version: process.env.npm_package_version ?? "0.1.0",
    uptimeMs: Math.round(process.uptime() * 1000),
    durationMs: Date.now() - started,
    checks,
    time: new Date().toISOString(),
  };

  return Response.json(body, { status: ready ? 200 : 503 });
}
