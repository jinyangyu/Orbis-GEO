import { and, asc, count, desc, eq, max } from "drizzle-orm";
import type { AppDb } from "@/db";
import { workspaceBrands } from "@/db/schema";
import { assertWorkspaceMember } from "@/lib/auth/membership";
import { newUserId } from "@/lib/identity";

export type BrandStatus = "active" | "detected" | "dismissed";

export type BrandRowView = {
  id: string;
  workspaceId: string;
  name: string;
  domain: string;
  role: "primary" | "competitor";
  status: BrandStatus;
  detectedFrom: string;
  aliases: string[];
  domainAliases: string[];
  includeSubdomains: boolean;
  market: string;
  language: string;
  mark: string;
  color: string;
  sortOrder: number;
};

const COLORS = [
  "#5b68ef",
  "#FF8A22",
  "#7CB342",
  "#8D6E32",
  "#D27B7E",
  "#4A90A4",
  "#C4782A",
  "#6B5B95",
];

function normalizeDomain(raw: string): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .slice(0, 255);
}

function mapBrand(row: typeof workspaceBrands.$inferSelect): BrandRowView {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    domain: row.domain,
    role: row.role,
    status: row.status,
    detectedFrom: row.detectedFrom,
    aliases: Array.isArray(row.aliases) ? row.aliases : [],
    domainAliases: Array.isArray(row.domainAliases) ? row.domainAliases : [],
    includeSubdomains: row.includeSubdomains === 1,
    market: row.market,
    language: row.language,
    mark: row.mark,
    color: row.color,
    sortOrder: row.sortOrder,
  };
}

export async function assertWorkspaceOwner(
  db: AppDb,
  userId: string,
  workspaceId: string,
): Promise<void> {
  await assertWorkspaceMember(db, userId, workspaceId);
}

export async function listActiveBrands(
  db: AppDb,
  userId: string,
  workspaceId: string,
): Promise<{ primary: BrandRowView | null; competitors: BrandRowView[] }> {
  await assertWorkspaceOwner(db, userId, workspaceId);
  const rows = await db
    .select()
    .from(workspaceBrands)
    .where(
      and(
        eq(workspaceBrands.workspaceId, workspaceId),
        eq(workspaceBrands.status, "active"),
      ),
    )
    .orderBy(asc(workspaceBrands.sortOrder));
  const mapped = rows.map(mapBrand);
  return {
    primary: mapped.find((b) => b.role === "primary") ?? null,
    competitors: mapped.filter((b) => b.role === "competitor"),
  };
}

export async function listDetectedBrands(
  db: AppDb,
  userId: string,
  workspaceId: string,
  page = 1,
  pageSize = 8,
): Promise<{ items: BrandRowView[]; total: number; page: number; pageSize: number }> {
  await assertWorkspaceOwner(db, userId, workspaceId);
  const safePage = Math.max(1, page);
  const safeSize = Math.min(50, Math.max(1, pageSize));
  const offset = (safePage - 1) * safeSize;

  const [totalRow] = await db
    .select({ c: count() })
    .from(workspaceBrands)
    .where(
      and(
        eq(workspaceBrands.workspaceId, workspaceId),
        eq(workspaceBrands.status, "detected"),
      ),
    );
  const total = Number(totalRow?.c ?? 0);

  const rows = await db
    .select()
    .from(workspaceBrands)
    .where(
      and(
        eq(workspaceBrands.workspaceId, workspaceId),
        eq(workspaceBrands.status, "detected"),
      ),
    )
    .orderBy(desc(workspaceBrands.createdAt))
    .limit(safeSize)
    .offset(offset);

  return {
    items: rows.map(mapBrand),
    total,
    page: safePage,
    pageSize: safeSize,
  };
}

export async function acceptDetectedBrand(
  db: AppDb,
  userId: string,
  brandId: string,
): Promise<BrandRowView> {
  const [row] = await db
    .select()
    .from(workspaceBrands)
    .where(eq(workspaceBrands.id, brandId))
    .limit(1);
  if (!row) throw new Error("Brand not found");
  await assertWorkspaceOwner(db, userId, row.workspaceId);
  if (row.status !== "detected") throw new Error("Brand is not in detected queue");

  await db
    .update(workspaceBrands)
    .set({ status: "active", role: "competitor" })
    .where(eq(workspaceBrands.id, brandId));

  const [updated] = await db
    .select()
    .from(workspaceBrands)
    .where(eq(workspaceBrands.id, brandId))
    .limit(1);
  return mapBrand(updated!);
}

export async function dismissDetectedBrand(
  db: AppDb,
  userId: string,
  brandId: string,
): Promise<BrandRowView> {
  const [row] = await db
    .select()
    .from(workspaceBrands)
    .where(eq(workspaceBrands.id, brandId))
    .limit(1);
  if (!row) throw new Error("Brand not found");
  await assertWorkspaceOwner(db, userId, row.workspaceId);

  await db
    .update(workspaceBrands)
    .set({ status: "dismissed" })
    .where(eq(workspaceBrands.id, brandId));

  const [updated] = await db
    .select()
    .from(workspaceBrands)
    .where(eq(workspaceBrands.id, brandId))
    .limit(1);
  return mapBrand(updated!);
}

export async function updateBrand(
  db: AppDb,
  userId: string,
  brandId: string,
  patch: {
    name?: string;
    domain?: string;
    aliases?: string[];
    domainAliases?: string[];
    includeSubdomains?: boolean;
    market?: string;
    language?: string;
    mark?: string;
    color?: string;
  },
): Promise<BrandRowView> {
  const [row] = await db
    .select()
    .from(workspaceBrands)
    .where(eq(workspaceBrands.id, brandId))
    .limit(1);
  if (!row) throw new Error("Brand not found");
  await assertWorkspaceOwner(db, userId, row.workspaceId);

  const next: Partial<typeof workspaceBrands.$inferInsert> = {};
  if (patch.name !== undefined) next.name = patch.name.trim().slice(0, 200);
  if (patch.domain !== undefined) next.domain = normalizeDomain(patch.domain);
  if (patch.aliases !== undefined) {
    next.aliases = patch.aliases
      .map((a) => String(a).trim())
      .filter(Boolean)
      .slice(0, 20);
  }
  if (patch.domainAliases !== undefined) {
    next.domainAliases = patch.domainAliases
      .map((a) => normalizeDomain(a))
      .filter(Boolean)
      .slice(0, 20);
  }
  if (patch.includeSubdomains !== undefined) {
    next.includeSubdomains = patch.includeSubdomains ? 1 : 0;
  }
  if (patch.market !== undefined) next.market = patch.market.trim().slice(0, 64);
  if (patch.language !== undefined) next.language = patch.language.trim().slice(0, 64);
  if (patch.mark !== undefined) next.mark = patch.mark.trim().slice(0, 8);
  if (patch.color !== undefined) next.color = patch.color.trim().slice(0, 16);

  if (Object.keys(next).length) {
    await db.update(workspaceBrands).set(next).where(eq(workspaceBrands.id, brandId));
  }

  const [updated] = await db
    .select()
    .from(workspaceBrands)
    .where(eq(workspaceBrands.id, brandId))
    .limit(1);
  return mapBrand(updated!);
}

export async function createCompetitor(
  db: AppDb,
  userId: string,
  workspaceId: string,
  input: { name: string; domain?: string; mark?: string; color?: string },
): Promise<BrandRowView> {
  await assertWorkspaceOwner(db, userId, workspaceId);
  const name = input.name.trim();
  if (!name) throw new Error("品牌名称必填");
  const domain = normalizeDomain(input.domain || name);
  if (!domain) throw new Error("域名无效");

  const [maxSort] = await db
    .select({ m: max(workspaceBrands.sortOrder) })
    .from(workspaceBrands)
    .where(eq(workspaceBrands.workspaceId, workspaceId));
  const sortOrder = (maxSort?.m ?? 0) + 1;
  const id = newUserId();
  const color = input.color || COLORS[sortOrder % COLORS.length];
  const mark = (input.mark || name.slice(0, 1) || "?").slice(0, 8).toUpperCase();

  await db.insert(workspaceBrands).values({
    id,
    workspaceId,
    name: name.slice(0, 200),
    domain,
    role: "competitor",
    status: "active",
    detectedFrom: "manual",
    aliases: [],
    market: "",
    language: "",
    mark,
    color,
    sortOrder,
  });

  const [row] = await db
    .select()
    .from(workspaceBrands)
    .where(eq(workspaceBrands.id, id))
    .limit(1);
  return mapBrand(row!);
}

export async function deleteCompetitor(
  db: AppDb,
  userId: string,
  brandId: string,
): Promise<void> {
  const [row] = await db
    .select()
    .from(workspaceBrands)
    .where(eq(workspaceBrands.id, brandId))
    .limit(1);
  if (!row) throw new Error("Brand not found");
  await assertWorkspaceOwner(db, userId, row.workspaceId);
  if (row.role === "primary") throw new Error("不能删除主品牌");
  await db.delete(workspaceBrands).where(eq(workspaceBrands.id, brandId));
}

/** Seed demo detected brands only when ORBIS_DEMO_DETECTED=1. */
export async function ensureDemoDetectedBrands(
  db: AppDb,
  workspaceId: string,
): Promise<void> {
  if (process.env.ORBIS_DEMO_DETECTED !== "1") return;
  const [totalRow] = await db
    .select({ c: count() })
    .from(workspaceBrands)
    .where(
      and(
        eq(workspaceBrands.workspaceId, workspaceId),
        eq(workspaceBrands.status, "detected"),
      ),
    );
  if (Number(totalRow?.c ?? 0) > 0) return;

  const existing = await db
    .select({ domain: workspaceBrands.domain })
    .from(workspaceBrands)
    .where(eq(workspaceBrands.workspaceId, workspaceId));
  const have = new Set(existing.map((e) => e.domain.toLowerCase()));

  const seeds = [
    { name: "Nextdoor", domain: "nextdoor.com" },
    { name: "Vinted", domain: "vinted.com" },
    { name: "Craigslist", domain: "craigslist.org" },
    { name: "Depop", domain: "depop.com" },
    { name: "Reddit", domain: "reddit.com" },
    { name: "Carwow", domain: "carwow.co.uk" },
  ];

  const [maxSort] = await db
    .select({ m: max(workspaceBrands.sortOrder) })
    .from(workspaceBrands)
    .where(eq(workspaceBrands.workspaceId, workspaceId));
  let sort = (maxSort?.m ?? 0) + 1;

  for (const s of seeds) {
    if (have.has(s.domain)) continue;
    await db.insert(workspaceBrands).values({
      id: newUserId(),
      workspaceId,
      name: s.name,
      domain: s.domain,
      role: "competitor",
      status: "detected",
      detectedFrom: "citation",
      aliases: [],
      market: "",
      language: "",
      mark: s.name.slice(0, 1).toUpperCase(),
      color: COLORS[sort % COLORS.length],
      sortOrder: sort++,
    });
    have.add(s.domain);
  }
}
