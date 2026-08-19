import { eq, sql } from "drizzle-orm";
import type { AppDb } from "@/db";
import { workspaces } from "@/db/schema";
import { assertWorkspaceMember } from "@/lib/auth/membership";
import { rowsOf } from "@/lib/db/rows";
import type { WorkspaceListItem } from "./types";

export async function listMonitoringWorkspaces(
  db: AppDb,
  userId: string,
): Promise<WorkspaceListItem[]> {
  const result = await db.execute(sql`
    SELECT
      w.id AS id,
      w.name AS name,
      w.slug AS slug,
      w.report_title AS report_title,
      pb.name AS brand_name,
      pb.domain AS brand_domain,
      d.observation_count AS observation_count
    FROM workspaces w
    INNER JOIN workspace_members m
      ON m.workspace_id = w.id AND m.user_id = ${userId}
    INNER JOIN (
      SELECT workspace_id, SUM(obs_count) AS observation_count
      FROM obs_metrics_daily
      GROUP BY workspace_id
    ) d ON d.workspace_id = w.id
    LEFT JOIN workspace_brands pb
      ON pb.workspace_id = w.id AND pb.role = 'primary'
    ORDER BY d.observation_count DESC
  `);

  return rowsOf(result)
    .filter((row) => row.id != null && String(row.id) !== "undefined")
    .map((row) => ({
      id: String(row.id),
      name: String(row.name ?? ""),
      slug: String(row.slug ?? ""),
      reportTitle: row.report_title ? String(row.report_title) : null,
      brandName: row.brand_name ? String(row.brand_name) : null,
      brandDomain: row.brand_domain ? String(row.brand_domain) : null,
      observationCount: Number(row.observation_count ?? 0),
    }));
}

export async function resolveWorkspaceId(
  db: AppDb,
  opts: {
    userId: string;
    workspaceId?: string | null;
    slug?: string | null;
  },
): Promise<string | null> {
  if (opts.workspaceId) {
    const [row] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.id, opts.workspaceId))
      .limit(1);
    if (row) {
      await assertWorkspaceMember(db, opts.userId, row.id);
      return row.id;
    }
    return null;
  }
  if (opts.slug) {
    const [row] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.slug, opts.slug))
      .limit(1);
    if (row) {
      await assertWorkspaceMember(db, opts.userId, row.id);
      return row.id;
    }
    return null;
  }
  const list = await listMonitoringWorkspaces(db, opts.userId);
  return list[0]?.id ?? null;
}
