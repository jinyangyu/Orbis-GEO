/**
 * Read L3 daily rollups for dashboard aggregations (engine-agnostic).
 * When an engine filter is requested, callers should use L2 instead.
 */
import { sql } from "drizzle-orm";
import type { AppDb } from "@/db";
import { rowsOf } from "@/lib/db/rows";
import type { MetricsRange } from "./types";

export type L3MentionAgg = {
  brandId: string;
  mentionedObs: number;
  mentionSum: number;
  avgPosition: number | null;
  positionSum: number;
  positionN: number;
};

export async function l3TotalObs(
  db: AppDb,
  workspaceId: string,
  range: MetricsRange,
): Promise<number> {
  const result = await db.execute(sql`
    SELECT COALESCE(SUM(obs_count), 0) AS c
    FROM obs_metrics_daily
    WHERE workspace_id = ${workspaceId}
      AND observed_on BETWEEN ${range.from} AND ${range.to}
  `);
  return Number(rowsOf(result)[0]?.c ?? 0);
}

export async function l3BrandMentionAggs(
  db: AppDb,
  workspaceId: string,
  range: MetricsRange,
): Promise<{ totalObs: number; byBrand: Map<string, L3MentionAgg> }> {
  const totalObs = await l3TotalObs(db, workspaceId, range);
  const result = await db.execute(sql`
    SELECT
      brand_id AS brand_id,
      COALESCE(SUM(mentioned_obs), 0) AS mentioned_obs,
      COALESCE(SUM(mention_sum), 0) AS mention_sum,
      COALESCE(SUM(position_sum), 0) AS position_sum,
      COALESCE(SUM(position_n), 0) AS position_n
    FROM brand_metrics_daily
    WHERE workspace_id = ${workspaceId}
      AND observed_on BETWEEN ${range.from} AND ${range.to}
    GROUP BY brand_id
  `);
  const byBrand = new Map<string, L3MentionAgg>();
  for (const row of rowsOf(result)) {
    const positionN = Number(row.position_n ?? 0);
    const positionSum = Number(row.position_sum ?? 0);
    byBrand.set(String(row.brand_id), {
      brandId: String(row.brand_id),
      mentionedObs: Number(row.mentioned_obs ?? 0),
      mentionSum: Number(row.mention_sum ?? 0),
      positionSum,
      positionN,
      avgPosition:
        positionN > 0 ? Number((positionSum / positionN).toFixed(2)) : null,
    });
  }
  return { totalObs, byBrand };
}

export async function l3DomainCitationAggs(
  db: AppDb,
  workspaceId: string,
  range: MetricsRange,
) {
  const result = await db.execute(sql`
    SELECT
      domain AS domain,
      COALESCE(NULLIF(MAX(domain_category), ''), '其他') AS category,
      COALESCE(SUM(citations), 0) AS citations,
      COALESCE(SUM(prompts_hit), 0) AS prompts
    FROM domain_metrics_daily
    WHERE workspace_id = ${workspaceId}
      AND observed_on BETWEEN ${range.from} AND ${range.to}
    GROUP BY domain
    ORDER BY citations DESC
  `);
  return rowsOf(result).map((row) => ({
    domain: String(row.domain),
    category: String(row.category),
    citations: Number(row.citations ?? 0),
    prompts: Number(row.prompts ?? 0),
  }));
}

export async function l3PromptAggs(
  db: AppDb,
  workspaceId: string,
  range: MetricsRange,
) {
  const result = await db.execute(sql`
    SELECT
      prompt_id AS prompt_id,
      COALESCE(SUM(obs_count), 0) AS obs,
      COALESCE(SUM(primary_mentions), 0) AS primary_mentions,
      COALESCE(SUM(total_brand_mentions), 0) AS total_mentions,
      COALESCE(SUM(domain_cites), 0) AS primary_cites
    FROM prompt_metrics_daily
    WHERE workspace_id = ${workspaceId}
      AND observed_on BETWEEN ${range.from} AND ${range.to}
    GROUP BY prompt_id
  `);
  return new Map(
    rowsOf(result).map((row) => {
      const pid = String(row.prompt_id);
      return [
        pid,
        {
          obs: Number(row.obs ?? 0),
          primaryMentions: Number(row.primary_mentions ?? 0),
          primaryCites: Number(row.primary_cites ?? 0),
          totalMentions: Number(row.total_mentions ?? 0),
        },
      ] as const;
    }),
  );
}

/** Coverage trend + BVI from the same two L3 scans. */
export async function l3CoverageTrendAndBvi(
  db: AppDb,
  workspaceId: string,
  range: MetricsRange,
  brandIds: string[],
) {
  const obsRows = await db.execute(sql`
    SELECT observed_on AS d, obs_count AS obs
    FROM obs_metrics_daily
    WHERE workspace_id = ${workspaceId}
      AND observed_on BETWEEN ${range.from} AND ${range.to}
    ORDER BY observed_on ASC
  `);
  const brandRows = await db.execute(sql`
    SELECT
      observed_on AS d,
      brand_id AS brand_id,
      mentioned_obs AS ment,
      position_sum AS position_sum,
      position_n AS position_n
    FROM brand_metrics_daily
    WHERE workspace_id = ${workspaceId}
      AND observed_on BETWEEN ${range.from} AND ${range.to}
  `);
  const obsByDate = new Map(
    rowsOf(obsRows).map((row) => [
      String(row.d).slice(0, 10),
      Number(row.obs ?? 0),
    ]),
  );
  const mentByDateBrand = new Map<string, number>();
  const byDateBrand = new Map<string, { ment: number; avgPosition: number | null }>();
  const brandFilter = brandIds.length > 0 ? new Set(brandIds) : null;
  for (const row of rowsOf(brandRows)) {
    const brandId = String(row.brand_id);
    const date = String(row.d).slice(0, 10);
    const ment = Number(row.ment ?? 0);
    mentByDateBrand.set(`${date}|${brandId}`, ment);
    if (brandFilter && !brandFilter.has(brandId)) continue;
    const positionN = Number(row.position_n ?? 0);
    const positionSum = Number(row.position_sum ?? 0);
    byDateBrand.set(`${date}|${brandId}`, {
      ment,
      avgPosition:
        positionN > 0 ? Number((positionSum / positionN).toFixed(2)) : null,
    });
  }
  return { obsByDate, mentByDateBrand, byDateBrand, brandIds };
}

export async function l3CoverageTrend(
  db: AppDb,
  workspaceId: string,
  range: MetricsRange,
  brandIds: string[],
) {
  const { obsByDate, mentByDateBrand } = await l3CoverageTrendAndBvi(
    db,
    workspaceId,
    range,
    brandIds,
  );
  return { obsByDate, mentByDateBrand, brandIds };
}

/** Daily BVI frames: coverage (X) + likelihood-to-buy from avg position (Y). */
export async function l3BviDaily(
  db: AppDb,
  workspaceId: string,
  range: MetricsRange,
  brandIds: string[],
): Promise<{
  obsByDate: Map<string, number>;
  byDateBrand: Map<string, { ment: number; avgPosition: number | null }>;
}> {
  const { obsByDate, byDateBrand } = await l3CoverageTrendAndBvi(
    db,
    workspaceId,
    range,
    brandIds,
  );
  return { obsByDate, byDateBrand };
}

export async function l3TopUrls(
  db: AppDb,
  workspaceId: string,
  range: MetricsRange,
  limit = 80,
) {
  const result = await db.execute(sql`
    SELECT
      url AS url,
      MAX(title) AS title,
      domain AS domain,
      COALESCE(NULLIF(MAX(domain_category), ''), '其他') AS category,
      COALESCE(SUM(citations), 0) AS cited,
      COALESCE(SUM(brand_on_page_yes), 0) AS brand_yes
    FROM url_metrics_daily
    WHERE workspace_id = ${workspaceId}
      AND observed_on BETWEEN ${range.from} AND ${range.to}
    GROUP BY url, domain
    ORDER BY cited DESC
    LIMIT ${limit}
  `);
  return rowsOf(result).map((row) => ({
    url: String(row.url),
    title: String(row.title ?? ""),
    domain: String(row.domain ?? ""),
    category: String(row.category ?? "其他"),
    cited: Number(row.cited ?? 0),
    brandYes: Number(row.brand_yes ?? 0),
  }));
}

export async function l3UrlWindowMap(
  db: AppDb,
  workspaceId: string,
  range: MetricsRange,
  urls?: string[],
) {
  if (urls && urls.length === 0) return new Map<string, number>();
  const urlFilter =
    urls && urls.length > 0
      ? sql`AND url IN (${sql.join(
          urls.map((u) => sql`${u}`),
          sql`, `,
        )})`
      : sql``;
  const result = await db.execute(sql`
    SELECT url AS url, COALESCE(SUM(citations), 0) AS cited
    FROM url_metrics_daily
    WHERE workspace_id = ${workspaceId}
      AND observed_on BETWEEN ${range.from} AND ${range.to}
      ${urlFilter}
    GROUP BY url
  `);
  return new Map(
    rowsOf(result).map((row) => [String(row.url), Number(row.cited ?? 0)]),
  );
}

export async function l3HasData(
  db: AppDb,
  workspaceId: string,
  range: MetricsRange,
): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1 AS ok
    FROM obs_metrics_daily
    WHERE workspace_id = ${workspaceId}
      AND observed_on BETWEEN ${range.from} AND ${range.to}
    LIMIT 1
  `);
  return rowsOf(result).length > 0;
}

/** Previous window of equal length ending the day before `range.from`. */
export function previousMetricsRange(range: MetricsRange): MetricsRange {
  const [y, m, d] = range.from.split("-").map(Number);
  const end = new Date(y, m - 1, d);
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - (range.days - 1));
  const p = (n: number) => String(n).padStart(2, "0");
  const fmt = (dt: Date) =>
    `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
  return { from: fmt(start), to: fmt(end), days: range.days };
}

export function formatDeltaPct(current: number, previous: number): string {
  if (previous <= 0 && current <= 0) return "—";
  if (previous <= 0) return "+100%";
  const delta = ((current - previous) / previous) * 100;
  const rounded = Number(delta.toFixed(1));
  if (rounded === 0) return "0%";
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

export function formatDeltaPp(current: number, previous: number): string {
  const delta = Number((current - previous).toFixed(1));
  if (delta === 0) return "0";
  return `${delta > 0 ? "+" : ""}${delta}pp`;
}

export function formatDeltaCount(current: number, previous: number): string {
  const delta = current - previous;
  if (delta === 0) return "0";
  return `${delta > 0 ? "+" : ""}${delta}`;
}
