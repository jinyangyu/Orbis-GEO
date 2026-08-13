import { and, asc, eq, like, sql } from "drizzle-orm";
import type { AppDb } from "@/db";
import {
  prompts,
  workspaceBrands,
  workspaceSettings,
  workspaces,
} from "@/db/schema";
import {
  assertWorkspaceOwner,
  listActiveBrands,
  updateBrand,
  type BrandRowView,
} from "@/lib/brands/service";

export type SettingsPromptView = {
  id: string;
  text: string;
  isActive: boolean;
  market: string;
  tags: string[];
  sortOrder: number;
};

export type BrandSettingsPayload = {
  workspaceId: string;
  reportTitle: string;
  primary: BrandRowView | null;
  competitors: BrandRowView[];
  notifications: {
    notifyNewRecommendations: boolean;
  };
  promptStats: {
    total: number;
    active: number;
  };
};

function normalizeDomainList(list: string[]): string[] {
  return list
    .map((raw) =>
      String(raw || "")
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .split("/")[0]
        .slice(0, 255),
    )
    .filter(Boolean)
    .slice(0, 20);
}

async function ensureSettings(db: AppDb, workspaceId: string) {
  const [row] = await db
    .select()
    .from(workspaceSettings)
    .where(eq(workspaceSettings.workspaceId, workspaceId))
    .limit(1);
  if (row) return row;
  await db.insert(workspaceSettings).values({
    workspaceId,
    notifyNewRecommendations: 1,
  });
  const [created] = await db
    .select()
    .from(workspaceSettings)
    .where(eq(workspaceSettings.workspaceId, workspaceId))
    .limit(1);
  return created!;
}

export async function getBrandSettings(
  db: AppDb,
  userId: string,
  workspaceId: string,
): Promise<BrandSettingsPayload> {
  await assertWorkspaceOwner(db, userId, workspaceId);

  const [ws] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  if (!ws) throw new Error("Workspace not found");

  const brands = await listActiveBrands(db, userId, workspaceId);
  const settings = await ensureSettings(db, workspaceId);

  const [stats] = await db
    .select({
      total: sql<number>`count(*)`,
      active: sql<number>`sum(case when ${prompts.isActive} = 1 then 1 else 0 end)`,
    })
    .from(prompts)
    .where(eq(prompts.workspaceId, workspaceId));

  const reportTitle =
    (ws.reportTitle || "").trim() ||
    brands.primary?.name ||
    ws.name ||
    "";

  return {
    workspaceId,
    reportTitle,
    primary: brands.primary,
    competitors: brands.competitors,
    notifications: {
      notifyNewRecommendations: settings.notifyNewRecommendations === 1,
    },
    promptStats: {
      total: Number(stats?.total ?? 0),
      active: Number(stats?.active ?? 0),
    },
  };
}

export async function patchBrandSettings(
  db: AppDb,
  userId: string,
  workspaceId: string,
  patch: {
    reportTitle?: string;
    brandName?: string;
    brandDomain?: string;
    aliases?: string[];
    domainAliases?: string[];
    includeSubdomains?: boolean;
    notifyNewRecommendations?: boolean;
  },
): Promise<BrandSettingsPayload> {
  await assertWorkspaceOwner(db, userId, workspaceId);

  if (patch.reportTitle !== undefined) {
    await db
      .update(workspaces)
      .set({ reportTitle: patch.reportTitle.trim().slice(0, 200) })
      .where(eq(workspaces.id, workspaceId));
  }

  const [primary] = await db
    .select()
    .from(workspaceBrands)
    .where(
      and(
        eq(workspaceBrands.workspaceId, workspaceId),
        eq(workspaceBrands.role, "primary"),
      ),
    )
    .limit(1);

  if (primary) {
    const brandPatch: Parameters<typeof updateBrand>[3] = {};
    if (patch.brandName !== undefined) brandPatch.name = patch.brandName;
    if (patch.brandDomain !== undefined) brandPatch.domain = patch.brandDomain;
    if (patch.aliases !== undefined) brandPatch.aliases = patch.aliases;
    if (patch.domainAliases !== undefined) {
      brandPatch.domainAliases = normalizeDomainList(patch.domainAliases);
    }
    if (patch.includeSubdomains !== undefined) {
      brandPatch.includeSubdomains = patch.includeSubdomains;
    }
    if (Object.keys(brandPatch).length) {
      await updateBrand(db, userId, primary.id, brandPatch);
    }
  }

  if (patch.notifyNewRecommendations !== undefined) {
    await ensureSettings(db, workspaceId);
    await db
      .update(workspaceSettings)
      .set({
        notifyNewRecommendations: patch.notifyNewRecommendations ? 1 : 0,
      })
      .where(eq(workspaceSettings.workspaceId, workspaceId));
  }

  return getBrandSettings(db, userId, workspaceId);
}

export async function listSettingsPrompts(
  db: AppDb,
  userId: string,
  workspaceId: string,
  opts: {
    q?: string;
    market?: string;
    tag?: string;
    pane?: "inactive" | "active";
    page?: number;
    pageSize?: number;
  } = {},
): Promise<{
  items: SettingsPromptView[];
  total: number;
  page: number;
  pageSize: number;
  markets: string[];
  tags: string[];
}> {
  await assertWorkspaceOwner(db, userId, workspaceId);

  const pane = opts.pane === "inactive" ? "inactive" : "active";
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 50));
  const offset = (page - 1) * pageSize;

  const conditions = [
    eq(prompts.workspaceId, workspaceId),
    eq(prompts.isActive, pane === "active" ? 1 : 0),
  ];
  if (opts.market && opts.market !== "all") {
    conditions.push(eq(prompts.market, opts.market));
  }
  const q = (opts.q || "").trim();
  if (q) {
    conditions.push(like(prompts.text, `%${q}%`));
  }
  const tag = (opts.tag || "").trim();
  if (tag && tag !== "all") {
    conditions.push(
      sql`JSON_CONTAINS(${prompts.tags}, ${JSON.stringify(tag)}, '$')`,
    );
  }

  const [countRow] = await db
    .select({ c: sql<number>`count(*)` })
    .from(prompts)
    .where(and(...conditions));
  const total = Number(countRow?.c ?? 0);

  const rows = await db
    .select()
    .from(prompts)
    .where(and(...conditions))
    .orderBy(asc(prompts.sortOrder), asc(prompts.createdAt))
    .limit(pageSize)
    .offset(offset);

  const metaRows = await db
    .select({ market: prompts.market, tags: prompts.tags })
    .from(prompts)
    .where(eq(prompts.workspaceId, workspaceId));

  const markets = [
    ...new Set(metaRows.map((r) => r.market).filter(Boolean)),
  ].sort();
  const tags = [
    ...new Set(
      metaRows.flatMap((r) => (Array.isArray(r.tags) ? r.tags : [])),
    ),
  ].sort();

  return {
    items: rows.map((row) => ({
      id: row.id,
      text: row.text,
      isActive: row.isActive === 1,
      market: row.market || "",
      tags: Array.isArray(row.tags) ? row.tags : [],
      sortOrder: row.sortOrder,
    })),
    total,
    page,
    pageSize,
    markets,
    tags,
  };
}

export async function bulkSetPromptMembership(
  db: AppDb,
  userId: string,
  workspaceId: string,
  activateIds: string[],
  deactivateIds: string[],
): Promise<{ activated: number; deactivated: number }> {
  const activated = (
    await bulkSetPromptsActive(db, userId, workspaceId, activateIds, true)
  ).updated;
  const deactivated = (
    await bulkSetPromptsActive(db, userId, workspaceId, deactivateIds, false)
  ).updated;
  return { activated, deactivated };
}

export async function setPromptActive(
  db: AppDb,
  userId: string,
  promptId: string,
  isActive: boolean,
): Promise<SettingsPromptView> {
  const [row] = await db
    .select()
    .from(prompts)
    .where(eq(prompts.id, promptId))
    .limit(1);
  if (!row) throw new Error("Prompt not found");
  await assertWorkspaceOwner(db, userId, row.workspaceId);

  await db
    .update(prompts)
    .set({ isActive: isActive ? 1 : 0 })
    .where(eq(prompts.id, promptId));

  const [updated] = await db
    .select()
    .from(prompts)
    .where(eq(prompts.id, promptId))
    .limit(1);
  return {
    id: updated!.id,
    text: updated!.text,
    isActive: updated!.isActive === 1,
    market: updated!.market || "",
    tags: Array.isArray(updated!.tags) ? updated!.tags : [],
    sortOrder: updated!.sortOrder,
  };
}

export async function bulkSetPromptsActive(
  db: AppDb,
  userId: string,
  workspaceId: string,
  promptIds: string[],
  isActive: boolean,
): Promise<{ updated: number }> {
  await assertWorkspaceOwner(db, userId, workspaceId);
  const ids = [...new Set(promptIds.map((id) => id.trim()).filter(Boolean))];
  if (!ids.length) return { updated: 0 };

  let updated = 0;
  for (const id of ids) {
    const [row] = await db
      .select({ id: prompts.id, workspaceId: prompts.workspaceId })
      .from(prompts)
      .where(eq(prompts.id, id))
      .limit(1);
    if (!row || row.workspaceId !== workspaceId) continue;
    await db
      .update(prompts)
      .set({ isActive: isActive ? 1 : 0 })
      .where(eq(prompts.id, id));
    updated += 1;
  }
  return { updated };
}
