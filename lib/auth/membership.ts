import { and, eq, sql } from "drizzle-orm";
import type { AppDb } from "@/db";
import { workspaceMembers, workspaces } from "@/db/schema";
import { isDevOpenTenant } from "@/lib/auth/session";

export async function isWorkspaceMember(
  db: AppDb,
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function assertWorkspaceMember(
  db: AppDb,
  userId: string,
  workspaceId: string,
): Promise<void> {
  const ok = await isWorkspaceMember(db, userId, workspaceId);
  if (!ok) {
    throw new Error("Workspace not found or access denied");
  }
}

/** @deprecated alias — membership is the gate. */
export async function assertWorkspaceOwner(
  db: AppDb,
  userId: string,
  workspaceId: string,
): Promise<void> {
  return assertWorkspaceMember(db, userId, workspaceId);
}

export async function addWorkspaceMember(
  db: AppDb,
  workspaceId: string,
  userId: string,
  role: "owner" | "member" = "member",
): Promise<void> {
  if (await isWorkspaceMember(db, userId, workspaceId)) return;
  await db.insert(workspaceMembers).values({
    workspaceId,
    userId,
    role,
  });
}

export class DevClaimForbiddenError extends Error {
  constructor() {
    super("Workspace claim disabled (set ORBIS_DEV_OPEN_TENANT=1 for local)");
    this.name = "DevClaimForbiddenError";
  }
}

/**
 * DEV-only: claim one or all monitoring workspaces for the current user.
 */
export async function claimMonitoringWorkspaces(
  db: AppDb,
  userId: string,
  workspaceId?: string | null,
): Promise<{ claimed: string[] }> {
  if (!isDevOpenTenant()) {
    throw new DevClaimForbiddenError();
  }

  if (workspaceId) {
    const [ws] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);
    if (!ws) throw new Error("Workspace not found or access denied");
    await addWorkspaceMember(db, workspaceId, userId, "member");
    return { claimed: [workspaceId] };
  }

  const result = await db.execute(sql`
    SELECT DISTINCT w.id AS id
    FROM workspaces w
    INNER JOIN answer_observations o ON o.workspace_id = w.id
  `);
  const rowsUnknown: unknown = Array.isArray(result) ? result[0] : result;
  const raw = Array.isArray(rowsUnknown)
    ? (rowsUnknown as Array<{ id?: string }>)
    : [];
  const ids = raw.map((r) => String(r.id ?? "")).filter(Boolean);
  for (const id of ids) {
    await addWorkspaceMember(db, id, userId, "member");
  }
  return { claimed: ids };
}
