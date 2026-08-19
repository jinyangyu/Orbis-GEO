/**
 * Shared range, SQL, and aggregation helpers for metrics query modules.
 */
import { and, asc, eq, sql } from "drizzle-orm";
import type { AppDb } from "@/db";
import { workspaceBrands, workspaces } from "@/db/schema";
import { rowsOf } from "@/lib/db/rows";
import {
  l3BrandMentionAggs,
  l3DomainCitationAggs,
  l3HasData,
} from "./l3-aggs";
import {
  estimateSentimentBreakdown,
  likelihoodFromPosition,
  resolveSentiment,
  visibilityIndex,
} from "./heuristics";
import type {
  BrandMatrixRow,
  BviFrame,
  BviMetrics,
  EngineMetricRow,
  MetricsRange,
} from "./types";

export type { MetricsRange };

export const ENGINE_COLORS: Record<string, string> = {
  chatgpt: "#111827",
  gpt: "#111827",
  perplexity: "#1d8f8a",
  google: "#4285f4",
  gemini: "#7559ff",
  copilot: "#1778d4",
  deepseek: "#4d6bfe",
  doubao: "#00c2a8",
};

export const NO_DELTA = "—";
const DEFAULT_RANGE_DAYS = 30;


export type MetricsQueryOpts = {
  engine?: string;
  /** YYYY-MM-DD inclusive */
  from?: string;
  /** YYYY-MM-DD inclusive */
  to?: string;
  /** Rolling window length when from is omitted (default 30). */
  days?: number;
  market?: string;
};

export function isYmd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function todayYmd(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

/** Resolve inclusive [from, to] for metrics queries. */
export function resolveMetricsRange(opts?: MetricsQueryOpts): MetricsRange {
  const to = opts?.to && isYmd(opts.to) ? opts.to : todayYmd();
  const days =
    opts?.days && Number.isFinite(opts.days) && opts.days > 0
      ? Math.floor(opts.days)
      : DEFAULT_RANGE_DAYS;
  const from =
    opts?.from && isYmd(opts.from) ? opts.from : addDaysYmd(to, -(days - 1));
  const span =
    Math.max(
      1,
      Math.round(
        (Date.parse(`${to}T00:00:00`) - Date.parse(`${from}T00:00:00`)) /
          86_400_000,
      ) + 1,
    );
  return { from, to, days: span };
}

export function dateFilterSql(range: MetricsRange) {
  return sql`AND o.observed_on BETWEEN ${range.from} AND ${range.to}`;
}

export function rootDomain(host: string): string {
  const h = host
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .replace(/:\d+$/, "");
  const parts = h.split(".").filter(Boolean);
  if (parts.length <= 2) return h;
  const last2 = parts.slice(-2).join(".");
  if (["com.cn", "co.uk", "com.au", "co.jp", "com.mx"].includes(last2)) {
    return parts.slice(-3).join(".");
  }
  return last2;
}

export function domainsMatch(a: string, b: string): boolean {
  const ra = rootDomain(a);
  const rb = rootDomain(b);
  return Boolean(ra && rb && (ra === rb || a.endsWith(`.${rb}`) || b.endsWith(`.${ra}`)));
}

export function pct(n: number, d: number, digits = 1): number {
  if (d <= 0) return 0;
  return Number(((100 * n) / d).toFixed(digits));
}

export function buildBviFrames(
  brands: Array<{
    brandId: string;
    name: string;
    isPrimary: boolean;
  }>,
  obsByDate: Map<string, number>,
  byDateBrand: Map<string, { ment: number; avgPosition: number | null }>,
): BviFrame[] {
  const dates = [...obsByDate.keys()].sort();
  return dates.map((date) => {
    const obs = obsByDate.get(date) ?? 0;
    return {
      date,
      brands: brands.map((b) => {
        const cell = byDateBrand.get(`${date}|${b.brandId}`);
        const coverage = pct(cell?.ment ?? 0, obs, 1);
        const avgPosition = cell?.avgPosition ?? null;
        return {
          brandId: b.brandId,
          name: b.name,
          isPrimary: b.isPrimary,
          coverage,
          avgPosition,
          likelihoodToBuy: likelihoodFromPosition(avgPosition),
        };
      }),
    };
  });
}

export function emptyBvi(): BviMetrics {
  return { coverageMid: 50, likelihoodMid: 50, frames: [] };
}


export function inferTag(text: string): string {
  if (/对比|区别|vs|VS|还是/.test(text)) return "品牌对比";
  if (/推荐|最好|最佳|靠谱/.test(text)) return "服务推荐";
  if (/如何|怎么|哪里/.test(text)) return "问题解决";
  if (/what|best|how|where/i.test(text)) return "商业调研";
  return "信息查找";
}

export function statusFromCoverage(coverage: number, competitorMentions: number): string {
  if (coverage >= 60) return "增长";
  if (coverage >= 40) return "稳定";
  if (competitorMentions > 0 && coverage < 35) return "风险";
  return "机会";
}

export function intentFromCoverage(coverage: number, stored?: string | null): string {
  if (stored && stored.trim()) return stored.trim();
  if (coverage >= 60) return "高";
  if (coverage >= 40) return "中";
  return "低";
}

export function engineMark(code: string, name: string): string {
  if (code === "gemini") return "✦";
  return (name || code).slice(0, 1).toUpperCase();
}

export function quadrantFromVisibility(visibility: number): string {
  if (visibility >= 65) return "领导者";
  if (visibility >= 45) return "挑战者";
  if (visibility >= 30) return "高潜力";
  return "待观察";
}


export async function loadWorkspaceContext(db: AppDb, workspaceId: string) {
  const [ws] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  if (!ws) return null;

  const brands = await db
    .select()
    .from(workspaceBrands)
    .where(
      and(
        eq(workspaceBrands.workspaceId, workspaceId),
        eq(workspaceBrands.status, "active"),
      ),
    )
    .orderBy(asc(workspaceBrands.sortOrder));

  const primary = brands.find((b) => b.role === "primary") ?? null;
  return { ws, brands, primary };
}

export type MentionAgg = {
  brandId: string;
  mentionedObs: number;
  mentionSum: number;
  avgPosition: number | null;
  avgSentiment: number | null;
};

export function engineSql(engineCode?: string) {
  return engineCode && engineCode !== "all"
    ? sql`AND e.code = ${engineCode}`
    : sql``;
}

export function engineJoinIfFiltered(engineCode?: string) {
  return engineCode && engineCode !== "all"
    ? sql`INNER JOIN engines e ON e.id = o.engine_id`
    : sql``;
}

/** Distinct observations that cited any of `domains` in range. Starts from domain index. */
export async function citedObservationCount(
  db: AppDb,
  workspaceId: string,
  domains: string[],
  range: MetricsRange,
  engineCode?: string,
): Promise<number> {
  if (domains.length === 0) return 0;
  const result = await db.execute(sql`
    SELECT COUNT(DISTINCT ce.observation_id) AS c
    FROM citation_events ce
    INNER JOIN answer_observations o ON o.id = ce.observation_id
    ${engineJoinIfFiltered(engineCode)}
    WHERE o.workspace_id = ${workspaceId}
      AND o.observed_on BETWEEN ${range.from} AND ${range.to}
      AND ce.domain IN (${sqlInStrings(domains)})
    ${engineSql(engineCode)}
  `);
  return Number(rowsOf(result)[0]?.c ?? 0);
}

/** Per-engine obs + primary-brand mentions without scanning the full mention table. */
export async function enginePrimaryBreakdown(
  db: AppDb,
  workspaceId: string,
  primaryBrandId: string,
  range: MetricsRange,
  engineCode?: string,
): Promise<EngineMetricRow[]> {
  const dateFilter = dateFilterSql(range);
  const engineFilter = engineSql(engineCode);
  const obsRows = await db.execute(sql`
    SELECT
      e.id AS engine_id,
      e.code AS code,
      e.name AS name,
      e.sort_order AS sort_order,
      COUNT(*) AS obs
    FROM answer_observations o
    INNER JOIN engines e ON e.id = o.engine_id
    WHERE o.workspace_id = ${workspaceId}
    ${dateFilter}
    ${engineFilter}
    GROUP BY e.id, e.code, e.name, e.sort_order
  `);
  const mentionRows = await db.execute(sql`
    SELECT
      o.engine_id AS engine_id,
      COUNT(*) AS mentions
    FROM answer_observations o
    INNER JOIN answer_brand_mentions abm
      ON abm.observation_id = o.id
     AND abm.brand_id = ${primaryBrandId}
     AND abm.mentioned = 1
    ${engineJoinIfFiltered(engineCode)}
    WHERE o.workspace_id = ${workspaceId}
    ${dateFilter}
    ${engineFilter}
    GROUP BY o.engine_id
  `);
  const mentionsByEngine = new Map(
    rowsOf(mentionRows).map((row) => [
      String(row.engine_id),
      Number(row.mentions ?? 0),
    ]),
  );
  return rowsOf(obsRows)
    .sort(
      (a, b) =>
        Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0) ||
        (mentionsByEngine.get(String(b.engine_id)) ?? 0) -
          (mentionsByEngine.get(String(a.engine_id)) ?? 0),
    )
    .map((row) => {
      const obs = Number(row.obs ?? 0);
      const mentions = mentionsByEngine.get(String(row.engine_id)) ?? 0;
      const code = String(row.code);
      return {
        code,
        name: String(row.name),
        mark: engineMark(code, String(row.name)),
        coverage: pct(mentions, obs, 0),
        mentions,
        change: NO_DELTA,
        color: ENGINE_COLORS[code] ?? "#5b67f1",
      };
    });
}

export function sqlInStrings(values: string[]) {
  return sql.join(
    values.map((v) => sql`${v}`),
    sql`, `,
  );
}

export function canUseL3(engineCode: string | undefined, market?: string) {
  const engineOn = Boolean(engineCode && engineCode !== "all");
  return !engineOn && !(market ?? "").trim();
}

export function marketSql(market?: string) {
  const m = market?.trim();
  return m ? sql`AND o.market = ${m}` : sql``;
}

export async function brandMentionAggs(
  db: AppDb,
  workspaceId: string,
  engineCode: string | undefined,
  range: MetricsRange,
  market?: string,
  preferL3?: boolean,
): Promise<{ totalObs: number; byBrand: Map<string, MentionAgg> }> {
  const useL3 =
    preferL3 ??
    (canUseL3(engineCode, market) && (await l3HasData(db, workspaceId, range)));
  if (useL3 && canUseL3(engineCode, market)) {
    const l3 = await l3BrandMentionAggs(db, workspaceId, range);
    const byBrand = new Map<string, MentionAgg>();
    for (const [id, row] of l3.byBrand) {
      byBrand.set(id, {
        brandId: row.brandId,
        mentionedObs: row.mentionedObs,
        mentionSum: row.mentionSum,
        avgPosition: row.avgPosition,
        avgSentiment: null,
      });
    }
    return { totalObs: l3.totalObs, byBrand };
  }

  const engineFilter = engineSql(engineCode);
  const dateFilter = dateFilterSql(range);
  const marketFilter = marketSql(market);

  const obsRows = await db.execute(sql`
    SELECT COUNT(*) AS c
    FROM answer_observations o
    LEFT JOIN engines e ON e.id = o.engine_id
    WHERE o.workspace_id = ${workspaceId}
    ${dateFilter}
    ${engineFilter}
    ${marketFilter}
  `);
  const totalObs = Number(rowsOf(obsRows)[0]?.c ?? 0);

  const mentionRows = await db.execute(sql`
    SELECT
      abm.brand_id AS brand_id,
      SUM(CASE WHEN abm.mentioned = 1 THEN 1 ELSE 0 END) AS mentioned_obs,
      SUM(abm.mentioned) AS mention_sum,
      AVG(CASE WHEN abm.mentioned = 1 THEN abm.position END) AS avg_position,
      AVG(CASE WHEN abm.mentioned = 1 AND abm.sentiment IS NOT NULL THEN abm.sentiment END) AS avg_sentiment
    FROM answer_brand_mentions abm
    INNER JOIN answer_observations o ON o.id = abm.observation_id
    LEFT JOIN engines e ON e.id = o.engine_id
    WHERE o.workspace_id = ${workspaceId}
    ${dateFilter}
    ${engineFilter}
    ${marketFilter}
    GROUP BY abm.brand_id
  `);

  const byBrand = new Map<string, MentionAgg>();
  for (const row of rowsOf(mentionRows)) {
    byBrand.set(String(row.brand_id), {
      brandId: String(row.brand_id),
      mentionedObs: Number(row.mentioned_obs ?? 0),
      mentionSum: Number(row.mention_sum ?? 0),
      avgPosition: row.avg_position == null ? null : Number(Number(row.avg_position).toFixed(2)),
      avgSentiment:
        row.avg_sentiment == null
          ? null
          : Number(Number(row.avg_sentiment).toFixed(0)),
    });
  }
  return { totalObs, byBrand };
}

export async function domainCitationAggs(
  db: AppDb,
  workspaceId: string,
  engineCode: string | undefined,
  range: MetricsRange,
  market?: string,
  preferL3?: boolean,
) {
  const useL3 =
    preferL3 ??
    (canUseL3(engineCode, market) && (await l3HasData(db, workspaceId, range)));
  if (useL3 && canUseL3(engineCode, market)) {
    return l3DomainCitationAggs(db, workspaceId, range);
  }

  const engineFilter = engineSql(engineCode);
  const dateFilter = dateFilterSql(range);
  const marketFilter = marketSql(market);
  const result = await db.execute(sql`
    SELECT
      ce.domain AS domain,
      COALESCE(NULLIF(ce.domain_category, ''), '其他') AS category,
      SUM(ce.times_cited) AS citations,
      COUNT(DISTINCT o.prompt_id) AS prompts
    FROM citation_events ce
    INNER JOIN answer_observations o ON o.id = ce.observation_id
    LEFT JOIN engines e ON e.id = o.engine_id
    WHERE o.workspace_id = ${workspaceId}
    ${dateFilter}
    ${engineFilter}
    ${marketFilter}
    GROUP BY ce.domain, category
    ORDER BY citations DESC
  `);
  return rowsOf(result).map((row) => ({
    domain: String(row.domain),
    category: String(row.category),
    citations: Number(row.citations ?? 0),
    prompts: Number(row.prompts ?? 0),
  }));
}

export function buildMatrix(
  brands: Array<{
    id: string;
    name: string;
    domain: string;
    role: string;
    color: string;
  }>,
  totalObs: number,
  byBrand: Map<string, MentionAgg>,
  domainRows: Array<{ domain: string; citations: number }>,
): BrandMatrixRow[] {
  const totalMentions = [...byBrand.values()].reduce((s, b) => s + b.mentionSum, 0);
  const totalCites = domainRows.reduce((s, d) => s + d.citations, 0);

  const matrix: BrandMatrixRow[] = brands.map((b) => {
    const agg = byBrand.get(b.id) ?? {
      brandId: b.id,
      mentionedObs: 0,
      mentionSum: 0,
      avgPosition: null,
      avgSentiment: null,
    };
    const coverage = pct(agg.mentionedObs, totalObs);
    const sovPercent = pct(agg.mentionSum, totalMentions);
    const domainCitations = domainRows
      .filter((d) => domainsMatch(d.domain, b.domain))
      .reduce((s, d) => s + d.citations, 0);
    const citeShare = pct(domainCitations, totalCites);
    const sentiment = resolveSentiment(agg.avgSentiment, coverage);
    return {
      brandId: b.id,
      name: b.name,
      domain: b.domain || "",
      isPrimary: b.role === "primary",
      visibility: visibilityIndex(coverage, sovPercent, citeShare),
      coverage,
      sovPercent,
      sentiment,
      sentimentBreakdown:
        sentiment != null
          ? estimateSentimentBreakdown(agg.mentionSum, sentiment)
          : undefined,
      mentions: agg.mentionSum,
      domainCitations,
      avgPosition: agg.avgPosition,
      change: NO_DELTA,
      color: b.color || "#5b67f1",
    };
  });

  matrix.sort((a, b) => b.mentions - a.mentions || b.coverage - a.coverage);
  return matrix;
}
