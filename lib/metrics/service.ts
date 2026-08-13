import { and, asc, eq, sql } from "drizzle-orm";
import type { AppDb } from "@/db";
import {
  prompts,
  workspaceBrands,
  workspaces,
} from "@/db/schema";
import {
  formatDeltaCount,
  formatDeltaPct,
  formatDeltaPp,
  l3BrandMentionAggs,
  l3BviDaily,
  l3CoverageTrend,
  l3DomainCitationAggs,
  l3HasData,
  l3PromptAggs,
  l3TopUrls,
  l3UrlWindowMap,
  previousMetricsRange,
} from "./l3-aggs";
import type {
  BrandMatrixRow,
  BrandsMetrics,
  BviFrame,
  BviMetrics,
  CitationDomainRow,
  CitationsMetrics,
  CitedUrlRow,
  CompetitorSovRow,
  DomainCitationShare,
  EngineMetricRow,
  MetricsRange,
  OverviewAction,
  OverviewMetrics,
  PromptCountRow,
  PromptDetailMetrics,
  PromptMetricRow,
  PromptsMetrics,
  TrendPoint,
  WorkspaceListItem,
} from "./types";

const ENGINE_COLORS: Record<string, string> = {
  chatgpt: "#111827",
  gpt: "#111827",
  perplexity: "#1d8f8a",
  google: "#4285f4",
  gemini: "#7559ff",
  copilot: "#1778d4",
  deepseek: "#4d6bfe",
  doubao: "#00c2a8",
};

const NO_DELTA = "—";
const DEFAULT_RANGE_DAYS = 30;

export type { MetricsRange };

export type MetricsQueryOpts = {
  engine?: string;
  /** YYYY-MM-DD inclusive */
  from?: string;
  /** YYYY-MM-DD inclusive */
  to?: string;
  /** Rolling window length when from is omitted (default 30). */
  days?: number;
};

function isYmd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function todayYmd(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function addDaysYmd(ymd: string, delta: number): string {
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

function dateFilterSql(range: MetricsRange) {
  return sql`AND o.observed_on BETWEEN ${range.from} AND ${range.to}`;
}

function rootDomain(host: string): string {
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

function domainsMatch(a: string, b: string): boolean {
  const ra = rootDomain(a);
  const rb = rootDomain(b);
  return Boolean(ra && rb && (ra === rb || a.endsWith(`.${rb}`) || b.endsWith(`.${ra}`)));
}

function pct(n: number, d: number, digits = 1): number {
  if (d <= 0) return 0;
  return Number(((100 * n) / d).toFixed(digits));
}

function visibilityIndex(coverage: number, sov: number, citeShare: number): number {
  return Number((0.45 * coverage + 0.35 * sov + 0.2 * citeShare).toFixed(1));
}

/** Map average mention position → 0–100 "Likelihood to buy" (Otterly Y-axis). */
function likelihoodFromPosition(avgPosition: number | null): number {
  if (avgPosition == null || avgPosition <= 0) return 0;
  return Number(
    Math.max(0, Math.min(100, 100 - (avgPosition - 1) * 12.5)).toFixed(1),
  );
}

function buildBviFrames(
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

function emptyBvi(): BviMetrics {
  return { coverageMid: 50, likelihoodMid: 50, frames: [] };
}


function inferTag(text: string): string {
  if (/对比|区别|vs|VS|还是/.test(text)) return "品牌对比";
  if (/推荐|最好|最佳|靠谱/.test(text)) return "服务推荐";
  if (/如何|怎么|哪里/.test(text)) return "问题解决";
  if (/what|best|how|where/i.test(text)) return "商业调研";
  return "信息查找";
}

function statusFromCoverage(coverage: number, competitorMentions: number): string {
  if (coverage >= 60) return "增长";
  if (coverage >= 40) return "稳定";
  if (competitorMentions > 0 && coverage < 35) return "风险";
  return "机会";
}

function sentimentFromCoverage(coverage: number): number {
  if (coverage >= 60) return 86;
  if (coverage >= 40) return 74;
  return 62;
}

/** Deterministic pos/neu/neg split from mention count + sentiment score (v1 heuristic). */
export function estimateSentimentBreakdown(
  mentions: number,
  sentimentScore: number,
): NonNullable<BrandMatrixRow["sentimentBreakdown"]> {
  const total = Math.max(1, Math.round(mentions));
  // Map score 50–100 → positive weight ~0.35–0.75
  const posW = Math.min(0.78, Math.max(0.28, (sentimentScore - 40) / 80));
  const negW = Math.min(0.35, Math.max(0.08, (95 - sentimentScore) / 120));
  const neuW = Math.max(0.1, 1 - posW - negW);
  const sumW = posW + neuW + negW;
  let positive = Math.round((posW / sumW) * total);
  let negative = Math.round((negW / sumW) * total);
  let neutral = Math.max(0, total - positive - negative);
  // Fix rounding drift
  const drift = total - (positive + neutral + negative);
  neutral = Math.max(0, neutral + drift);
  const positivePct = Math.round((positive / total) * 100);
  const negativePct = Math.round((negative / total) * 100);
  const neutralPct = Math.max(0, 100 - positivePct - negativePct);
  let label: "Positive" | "Neutral" | "Negative" | "Mixed" = "Mixed";
  if (positivePct >= 55) label = "Positive";
  else if (negativePct >= 45) label = "Negative";
  else if (neutralPct >= 50) label = "Neutral";
  return {
    positive,
    neutral,
    negative,
    positivePct,
    neutralPct,
    negativePct,
    label,
  };
}

function intentFromCoverage(coverage: number, stored?: string | null): string {
  if (stored && stored.trim()) return stored.trim();
  if (coverage >= 60) return "高";
  if (coverage >= 40) return "中";
  return "低";
}

function engineMark(code: string, name: string): string {
  if (code === "gemini") return "✦";
  return (name || code).slice(0, 1).toUpperCase();
}

function quadrantFromVisibility(visibility: number): string {
  if (visibility >= 65) return "领导者";
  if (visibility >= 45) return "挑战者";
  if (visibility >= 30) return "高潜力";
  return "待观察";
}

function rowsOf(result: unknown): Array<Record<string, unknown>> {
  if (result == null) return [];

  if (Array.isArray(result) && result.length === 2 && Array.isArray(result[0])) {
    return result[0] as Array<Record<string, unknown>>;
  }

  if (Array.isArray(result)) {
    if (result.length === 0) return [];
    if (typeof result[0] === "object" && result[0] !== null && !Array.isArray(result[0])) {
      return result as Array<Record<string, unknown>>;
    }
    if (Array.isArray(result[0])) {
      return result[0] as Array<Record<string, unknown>>;
    }
    return [];
  }

  if (typeof result === "object") {
    const withRows = result as {
      rows?: Array<Record<string, unknown>>;
      [key: string]: unknown;
    };
    if (Array.isArray(withRows.rows)) return withRows.rows;
  }

  return [];
}

export async function listMonitoringWorkspaces(
  db: AppDb,
): Promise<WorkspaceListItem[]> {
  const result = await db.execute(sql`
    SELECT
      w.id AS id,
      w.name AS name,
      w.slug AS slug,
      w.report_title AS report_title,
      pb.name AS brand_name,
      pb.domain AS brand_domain,
      COUNT(o.id) AS observation_count
    FROM workspaces w
    INNER JOIN answer_observations o ON o.workspace_id = w.id
    LEFT JOIN workspace_brands pb
      ON pb.workspace_id = w.id AND pb.role = 'primary'
    GROUP BY w.id, w.name, w.slug, w.report_title, pb.name, pb.domain
    ORDER BY observation_count DESC
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

async function loadWorkspaceContext(db: AppDb, workspaceId: string) {
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

type MentionAgg = {
  brandId: string;
  mentionedObs: number;
  mentionSum: number;
  avgPosition: number | null;
};

function engineSql(engineCode?: string) {
  return engineCode && engineCode !== "all"
    ? sql`AND e.code = ${engineCode}`
    : sql``;
}

async function brandMentionAggs(
  db: AppDb,
  workspaceId: string,
  engineCode: string | undefined,
  range: MetricsRange,
): Promise<{ totalObs: number; byBrand: Map<string, MentionAgg> }> {
  if (!engineCode && (await l3HasData(db, workspaceId, range))) {
    const l3 = await l3BrandMentionAggs(db, workspaceId, range);
    const byBrand = new Map<string, MentionAgg>();
    for (const [id, row] of l3.byBrand) {
      byBrand.set(id, {
        brandId: row.brandId,
        mentionedObs: row.mentionedObs,
        mentionSum: row.mentionSum,
        avgPosition: row.avgPosition,
      });
    }
    return { totalObs: l3.totalObs, byBrand };
  }

  const engineFilter = engineSql(engineCode);
  const dateFilter = dateFilterSql(range);

  const obsRows = await db.execute(sql`
    SELECT COUNT(*) AS c
    FROM answer_observations o
    LEFT JOIN engines e ON e.id = o.engine_id
    WHERE o.workspace_id = ${workspaceId}
    ${dateFilter}
    ${engineFilter}
  `);
  const totalObs = Number(rowsOf(obsRows)[0]?.c ?? 0);

  const mentionRows = await db.execute(sql`
    SELECT
      abm.brand_id AS brand_id,
      SUM(CASE WHEN abm.mentioned = 1 THEN 1 ELSE 0 END) AS mentioned_obs,
      SUM(abm.mentioned) AS mention_sum,
      AVG(CASE WHEN abm.mentioned = 1 THEN abm.position END) AS avg_position
    FROM answer_brand_mentions abm
    INNER JOIN answer_observations o ON o.id = abm.observation_id
    LEFT JOIN engines e ON e.id = o.engine_id
    WHERE o.workspace_id = ${workspaceId}
    ${dateFilter}
    ${engineFilter}
    GROUP BY abm.brand_id
  `);

  const byBrand = new Map<string, MentionAgg>();
  for (const row of rowsOf(mentionRows)) {
    byBrand.set(String(row.brand_id), {
      brandId: String(row.brand_id),
      mentionedObs: Number(row.mentioned_obs ?? 0),
      mentionSum: Number(row.mention_sum ?? 0),
      avgPosition: row.avg_position == null ? null : Number(Number(row.avg_position).toFixed(2)),
    });
  }
  return { totalObs, byBrand };
}

async function domainCitationAggs(
  db: AppDb,
  workspaceId: string,
  engineCode: string | undefined,
  range: MetricsRange,
) {
  if (!engineCode && (await l3HasData(db, workspaceId, range))) {
    return l3DomainCitationAggs(db, workspaceId, range);
  }

  const engineFilter = engineSql(engineCode);
  const dateFilter = dateFilterSql(range);
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

function buildMatrix(
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
    };
    const coverage = pct(agg.mentionedObs, totalObs);
    const sovPercent = pct(agg.mentionSum, totalMentions);
    const domainCitations = domainRows
      .filter((d) => domainsMatch(d.domain, b.domain))
      .reduce((s, d) => s + d.citations, 0);
    const citeShare = pct(domainCitations, totalCites);
    const sentiment = sentimentFromCoverage(coverage);
    return {
      brandId: b.id,
      name: b.name,
      isPrimary: b.role === "primary",
      visibility: visibilityIndex(coverage, sovPercent, citeShare),
      coverage,
      sovPercent,
      sentiment,
      sentimentBreakdown: estimateSentimentBreakdown(agg.mentionSum, sentiment),
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

export async function getPromptsMetrics(
  db: AppDb,
  workspaceId: string,
  opts?: MetricsQueryOpts & { q?: string; limit?: number; market?: string },
): Promise<PromptsMetrics> {
  const ctx = await loadWorkspaceContext(db, workspaceId);
  if (!ctx?.primary) return { items: [], total: 0, markets: [], range: resolveMetricsRange(opts) };
  const { primary } = ctx;
  const range = resolveMetricsRange(opts);

  const promptList = await db
    .select()
    .from(prompts)
    .where(and(eq(prompts.workspaceId, workspaceId), eq(prompts.isActive, 1)))
    .orderBy(asc(prompts.sortOrder));

  const markets = [...new Set(promptList.map((p) => p.market).filter(Boolean))];
  const query = (opts?.q ?? "").trim().toLowerCase();
  const marketFilter = (opts?.market ?? "").trim();
  let filtered = promptList;
  if (query) {
    filtered = filtered.filter((p) => p.text.toLowerCase().includes(query));
  }
  if (marketFilter) {
    filtered = filtered.filter((p) => p.market === marketFilter);
  }

  const useL3 = !opts?.engine && (await l3HasData(db, workspaceId, range));
  let byPrompt: Map<
    string,
    {
      obs: number;
      primaryMentions: number;
      primaryCites: number;
      totalMentions: number;
      totalDomainCites: number;
    }
  >;

  if (useL3) {
    const l3 = await l3PromptAggs(db, workspaceId, range);
    byPrompt = new Map(
      [...l3.entries()].map(([pid, v]) => [
        pid,
        { ...v, totalDomainCites: v.primaryCites },
      ]),
    );
  } else {
    const engineFilter = engineSql(opts?.engine);
    const dateFilter = dateFilterSql(range);

    const aggRows = await db.execute(sql`
      SELECT
        o.prompt_id AS prompt_id,
        COUNT(DISTINCT o.id) AS obs,
        COUNT(DISTINCT CASE WHEN abm.mentioned = 1 THEN o.id END) AS primary_mentions
      FROM answer_observations o
      LEFT JOIN answer_brand_mentions abm
        ON abm.observation_id = o.id AND abm.brand_id = ${primary.id}
      LEFT JOIN engines e ON e.id = o.engine_id
      WHERE o.workspace_id = ${workspaceId}
      ${dateFilter}
      ${engineFilter}
      GROUP BY o.prompt_id
    `);

    const citeRows = await db.execute(sql`
      SELECT
        o.prompt_id AS prompt_id,
        SUM(ce.times_cited) AS primary_cites
      FROM answer_observations o
      INNER JOIN citation_events ce ON ce.observation_id = o.id
      LEFT JOIN engines e ON e.id = o.engine_id
      WHERE o.workspace_id = ${workspaceId}
      ${dateFilter}
      ${engineFilter}
        AND (
          ce.domain = ${primary.domain}
          OR ce.domain LIKE ${`%.${rootDomain(primary.domain)}`}
        )
      GROUP BY o.prompt_id
    `);

    const allCiteRows = await db.execute(sql`
      SELECT
        o.prompt_id AS prompt_id,
        SUM(ce.times_cited) AS total_cites
      FROM answer_observations o
      INNER JOIN citation_events ce ON ce.observation_id = o.id
      LEFT JOIN engines e ON e.id = o.engine_id
      WHERE o.workspace_id = ${workspaceId}
      ${dateFilter}
      ${engineFilter}
      GROUP BY o.prompt_id
    `);

    const totalMentionRows = await db.execute(sql`
      SELECT
        o.prompt_id AS prompt_id,
        SUM(abm.mentioned) AS total_mentions
      FROM answer_observations o
      INNER JOIN answer_brand_mentions abm ON abm.observation_id = o.id
      LEFT JOIN engines e ON e.id = o.engine_id
      WHERE o.workspace_id = ${workspaceId}
      ${dateFilter}
      ${engineFilter}
        AND abm.mentioned = 1
      GROUP BY o.prompt_id
    `);

    const citesByPrompt = new Map(
      rowsOf(citeRows).map((row) => [
        String(row.prompt_id),
        Number(row.primary_cites ?? 0),
      ]),
    );
    const allCitesByPrompt = new Map(
      rowsOf(allCiteRows).map((row) => [
        String(row.prompt_id),
        Number(row.total_cites ?? 0),
      ]),
    );
    const totalByPrompt = new Map(
      rowsOf(totalMentionRows).map((row) => [
        String(row.prompt_id),
        Number(row.total_mentions ?? 0),
      ]),
    );

    byPrompt = new Map(
      rowsOf(aggRows).map((row) => {
        const pid = String(row.prompt_id);
        return [
          pid,
          {
            obs: Number(row.obs ?? 0),
            primaryMentions: Number(row.primary_mentions ?? 0),
            primaryCites: citesByPrompt.get(pid) ?? 0,
            totalMentions: totalByPrompt.get(pid) ?? 0,
            totalDomainCites: allCitesByPrompt.get(pid) ?? 0,
          },
        ] as const;
      }),
    );
  }

  const compsByPrompt = new Map<string, string[]>();
  if (!useL3) {
    const engineFilter = engineSql(opts?.engine);
    const dateFilter = dateFilterSql(range);
    const compRows = await db.execute(sql`
      SELECT
        o.prompt_id AS prompt_id,
        wb.name AS name,
        SUM(abm.mentioned) AS mentions
      FROM answer_observations o
      INNER JOIN answer_brand_mentions abm ON abm.observation_id = o.id
      INNER JOIN workspace_brands wb ON wb.id = abm.brand_id
      LEFT JOIN engines e ON e.id = o.engine_id
      WHERE o.workspace_id = ${workspaceId}
      ${dateFilter}
      ${engineFilter}
        AND wb.role = 'competitor'
        AND abm.mentioned = 1
      GROUP BY o.prompt_id, wb.id, wb.name
      ORDER BY mentions DESC
    `);
    for (const row of rowsOf(compRows)) {
      const pid = String(row.prompt_id);
      const list = compsByPrompt.get(pid) ?? [];
      if (list.length < 3) list.push(String(row.name));
      compsByPrompt.set(pid, list);
    }
  }

  const items: PromptMetricRow[] = filtered.map((p) => {
    const agg = byPrompt.get(p.id) ?? {
      obs: 0,
      primaryMentions: 0,
      primaryCites: 0,
      totalMentions: 0,
      totalDomainCites: 0,
    };
    const coverage = pct(agg.primaryMentions, agg.obs, 0);
    const comps = compsByPrompt.get(p.id) ?? [];
    const tags = Array.isArray(p.tags) ? p.tags : [];
    const tag = tags[0] || inferTag(p.text);
    const sentiment = sentimentFromCoverage(coverage);
    return {
      promptId: p.id,
      q: p.text,
      tag,
      market: p.market || "",
      coverage,
      sentiment,
      mentions: agg.primaryMentions,
      citations: agg.primaryCites,
      competitor: comps.join(", ") || "—",
      competitors: comps,
      status: statusFromCoverage(coverage, comps.length),
      brandMentions: agg.primaryMentions,
      totalBrandMentions: agg.totalMentions,
      domainMentions: agg.primaryCites,
      totalDomainCitations: agg.totalDomainCites,
      intentVolume: intentFromCoverage(coverage, p.intentVolume),
      sentimentBreakdown: estimateSentimentBreakdown(
        agg.primaryMentions,
        sentiment,
      ),
    };
  });

  items.sort(
    (a, b) =>
      b.brandMentions - a.brandMentions || b.coverage - a.coverage,
  );
  const limit = opts?.limit ?? 100;
  return { items: items.slice(0, limit), total: items.length, markets, range };
}

export async function getBrandsMetrics(
  db: AppDb,
  workspaceId: string,
  opts?: MetricsQueryOpts,
): Promise<BrandsMetrics | null> {
  const ctx = await loadWorkspaceContext(db, workspaceId);
  if (!ctx?.primary) return null;
  const { brands, primary } = ctx;
  const range = resolveMetricsRange(opts);
  const { totalObs, byBrand } = await brandMentionAggs(
    db,
    workspaceId,
    opts?.engine,
    range,
  );
  const domainRows = await domainCitationAggs(
    db,
    workspaceId,
    opts?.engine,
    range,
  );
  const matrix = buildMatrix(brands, totalObs, byBrand, domainRows);
  const primaryRow = matrix.find((m) => m.isPrimary);
  const rank = primaryRow
    ? matrix.findIndex((m) => m.brandId === primaryRow.brandId) + 1
    : matrix.length;
  const visibility = primaryRow?.visibility ?? 0;

  return {
    primaryName: primary.name,
    visibility,
    rank,
    quadrantLabel: quadrantFromVisibility(visibility),
    matrix,
    range,
  };
}

export async function getOverviewMetrics(
  db: AppDb,
  workspaceId: string,
  opts?: MetricsQueryOpts,
): Promise<OverviewMetrics | null> {
  const ctx = await loadWorkspaceContext(db, workspaceId);
  if (!ctx?.primary) return null;
  const { ws, brands, primary } = ctx;
  const range = resolveMetricsRange(opts);
  const engineCode = opts?.engine;
  const engineFilter = engineSql(engineCode);
  const dateFilter = dateFilterSql(range);

  const { totalObs, byBrand } = await brandMentionAggs(
    db,
    workspaceId,
    engineCode,
    range,
  );
  const primaryAgg = byBrand.get(primary.id) ?? {
    brandId: primary.id,
    mentionedObs: 0,
    mentionSum: 0,
    avgPosition: null,
  };
  const totalMentions = [...byBrand.values()].reduce((s, b) => s + b.mentionSum, 0);
  const coverage = pct(primaryAgg.mentionedObs, totalObs);
  const sov = pct(primaryAgg.mentionSum, totalMentions);

  const domainRows = await domainCitationAggs(
    db,
    workspaceId,
    engineCode,
    range,
  );
  const primaryCites = domainRows
    .filter((d) => domainsMatch(d.domain, primary.domain))
    .reduce((s, d) => s + d.citations, 0);
  const totalCites = domainRows.reduce((s, d) => s + d.citations, 0);
  const citeShare = pct(primaryCites, totalCites);
  const visibility = visibilityIndex(coverage, sov, citeShare);

  const obsWithPrimaryDomain = await db.execute(sql`
    SELECT COUNT(DISTINCT o.id) AS c
    FROM answer_observations o
    INNER JOIN citation_events ce ON ce.observation_id = o.id
    LEFT JOIN engines e ON e.id = o.engine_id
    WHERE o.workspace_id = ${workspaceId}
    ${dateFilter}
    ${engineFilter}
      AND (
        ce.domain = ${primary.domain}
        OR ce.domain LIKE ${`%.${rootDomain(primary.domain)}`}
      )
  `);
  const domainCoverage = pct(
    Number(rowsOf(obsWithPrimaryDomain)[0]?.c ?? 0),
    totalObs,
  );

  const engineRows = await db.execute(sql`
    SELECT
      e.code AS code,
      e.name AS name,
      COUNT(o.id) AS obs,
      SUM(CASE WHEN abm.mentioned = 1 THEN 1 ELSE 0 END) AS mentions
    FROM answer_observations o
    INNER JOIN engines e ON e.id = o.engine_id
    LEFT JOIN answer_brand_mentions abm
      ON abm.observation_id = o.id AND abm.brand_id = ${primary.id}
    WHERE o.workspace_id = ${workspaceId}
    ${dateFilter}
    ${engineFilter}
    GROUP BY e.id, e.code, e.name, e.sort_order
    ORDER BY e.sort_order ASC, mentions DESC
  `);

  const enginesOut: EngineMetricRow[] = rowsOf(engineRows).map((row) => {
    const obs = Number(row.obs ?? 0);
    const mentions = Number(row.mentions ?? 0);
    const cov = pct(mentions, obs, 0);
    const code = String(row.code);
    return {
      code,
      name: String(row.name),
      mark: engineMark(code, String(row.name)),
      coverage: cov,
      mentions,
      change: NO_DELTA,
      color: ENGINE_COLORS[code] ?? "#5b67f1",
    };
  });

  const ranking = buildMatrix(brands, totalObs, byBrand, domainRows);

  const prevRange = previousMetricsRange(range);
  const prevAggs =
    !engineCode && (await l3HasData(db, workspaceId, prevRange))
      ? await brandMentionAggs(db, workspaceId, undefined, prevRange)
      : null;
  const prevDomains =
    !engineCode && prevAggs
      ? await domainCitationAggs(db, workspaceId, undefined, prevRange)
      : null;
  const prevPrimary = prevAggs?.byBrand.get(primary.id);
  const prevTotalMentions = prevAggs
    ? [...prevAggs.byBrand.values()].reduce((s, b) => s + b.mentionSum, 0)
    : 0;
  const prevCoverage = prevAggs
    ? pct(prevPrimary?.mentionedObs ?? 0, prevAggs.totalObs)
    : null;
  const prevSov = prevAggs
    ? pct(prevPrimary?.mentionSum ?? 0, prevTotalMentions)
    : null;
  const prevPrimaryCites = prevDomains
    ? prevDomains
        .filter((d) => domainsMatch(d.domain, primary.domain))
        .reduce((s, d) => s + d.citations, 0)
    : null;
  const prevCiteShare =
    prevDomains && prevPrimaryCites != null
      ? pct(
          prevPrimaryCites,
          prevDomains.reduce((s, d) => s + d.citations, 0),
        )
      : null;
  const prevVisibility =
    prevCoverage != null && prevSov != null && prevCiteShare != null
      ? visibilityIndex(prevCoverage, prevSov, prevCiteShare)
      : null;

  const competitors: CompetitorSovRow[] = ranking.slice(0, 8).map((row) => {
    const prev = prevAggs?.byBrand.get(row.brandId);
    const prevSovBrand = prevAggs
      ? pct(prev?.mentionSum ?? 0, prevTotalMentions)
      : null;
    return {
      brandId: row.brandId,
      name: row.name,
      sovPercent: row.sovPercent,
      color: row.color,
      delta:
        prevSovBrand == null
          ? NO_DELTA
          : formatDeltaPp(row.sovPercent, prevSovBrand),
      mentions: row.mentions,
      coverage: row.coverage,
      avgPosition: row.avgPosition,
      sentiment: row.sentiment,
    };
  });

  // Lightweight prompt aggregates
  let promptStats: Array<{
    promptId: string;
    q: string;
    obs: number;
    primaryMentions: number;
    domainMentions: number;
    coverage: number;
  }> = [];

  if (!engineCode && (await l3HasData(db, workspaceId, range))) {
    const byPrompt = await l3PromptAggs(db, workspaceId, range);
    const promptRows = await db
      .select({ id: prompts.id, text: prompts.text })
      .from(prompts)
      .where(eq(prompts.workspaceId, workspaceId));
    const textById = new Map(promptRows.map((p) => [p.id, p.text]));
    promptStats = [...byPrompt.entries()].map(([promptId, agg]) => ({
      promptId,
      q: textById.get(promptId) ?? "",
      obs: agg.obs,
      primaryMentions: agg.primaryMentions,
      domainMentions: agg.primaryCites,
      coverage: pct(agg.primaryMentions, agg.obs, 0),
    }));
  } else {
    const promptAggRows = await db.execute(sql`
      SELECT
        o.prompt_id AS prompt_id,
        p.text AS text,
        COUNT(DISTINCT o.id) AS obs,
        COUNT(DISTINCT CASE WHEN abm.mentioned = 1 THEN o.id END) AS primary_mentions
      FROM answer_observations o
      INNER JOIN prompts p ON p.id = o.prompt_id
      LEFT JOIN answer_brand_mentions abm
        ON abm.observation_id = o.id AND abm.brand_id = ${primary.id}
      LEFT JOIN engines e ON e.id = o.engine_id
      WHERE o.workspace_id = ${workspaceId}
      ${dateFilter}
      ${engineFilter}
      GROUP BY o.prompt_id, p.text
    `);
    const promptCiteRows = await db.execute(sql`
      SELECT
        o.prompt_id AS prompt_id,
        SUM(ce.times_cited) AS primary_cites
      FROM answer_observations o
      INNER JOIN citation_events ce ON ce.observation_id = o.id
      LEFT JOIN engines e ON e.id = o.engine_id
      WHERE o.workspace_id = ${workspaceId}
      ${dateFilter}
      ${engineFilter}
        AND (
          ce.domain = ${primary.domain}
          OR ce.domain LIKE ${`%.${rootDomain(primary.domain)}`}
        )
      GROUP BY o.prompt_id
    `);
    const citesByPrompt = new Map(
      rowsOf(promptCiteRows).map((row) => [
        String(row.prompt_id),
        Number(row.primary_cites ?? 0),
      ]),
    );
    promptStats = rowsOf(promptAggRows).map((row) => {
      const promptId = String(row.prompt_id);
      const obs = Number(row.obs ?? 0);
      const primaryMentions = Number(row.primary_mentions ?? 0);
      const domainMentions = citesByPrompt.get(promptId) ?? 0;
      return {
        promptId,
        q: String(row.text ?? ""),
        obs,
        primaryMentions,
        domainMentions,
        coverage: pct(primaryMentions, obs, 0),
      };
    });
  }
  const attentionPrompts: PromptMetricRow[] = [...promptStats]
    .filter((p) => p.coverage < 40)
    .sort((a, b) => a.coverage - b.coverage)
    .slice(0, 4)
    .map((p) => ({
      promptId: p.promptId,
      q: p.q,
      tag: inferTag(p.q),
      market: "",
      coverage: p.coverage,
      sentiment: sentimentFromCoverage(p.coverage),
      mentions: p.primaryMentions,
      citations: p.domainMentions,
      competitor: "—",
      competitors: [] as string[],
      status: statusFromCoverage(p.coverage, 0),
      brandMentions: p.primaryMentions,
      totalBrandMentions: p.primaryMentions,
      domainMentions: p.domainMentions,
      totalDomainCitations: p.domainMentions,
      intentVolume: intentFromCoverage(p.coverage),
      sentimentBreakdown: estimateSentimentBreakdown(
        p.primaryMentions,
        sentimentFromCoverage(p.coverage),
      ),
    }));

  const topPromptsByMentions: PromptCountRow[] = [...promptStats]
    .sort((a, b) => b.primaryMentions - a.primaryMentions)
    .slice(0, 10)
    .map((p) => ({ promptId: p.promptId, q: p.q, count: p.primaryMentions }));

  const topPromptsByDomainCites: PromptCountRow[] = [...promptStats]
    .sort((a, b) => b.domainMentions - a.domainMentions)
    .slice(0, 10)
    .map((p) => ({ promptId: p.promptId, q: p.q, count: p.domainMentions }));

  const topEngine = enginesOut[0];
  const notice = {
    title: `当前品牌覆盖率 ${coverage}%`,
    body: topEngine
      ? `${topEngine.name} 提及 ${topEngine.mentions} 次；${range.from}～${range.to} 共 ${totalObs} 条答卷，本品 SOV ${sov}%。`
      : `${range.from}～${range.to} 共 ${totalObs} 条答卷。`,
  };

  const weakPrompt = attentionPrompts[0];
  const thirdParty = domainRows.find(
    (d) =>
      !domainsMatch(d.domain, primary.domain) &&
      d.category !== "竞品官网" &&
      d.category !== "自有官网",
  );
  const actions: OverviewAction[] = [];
  if (weakPrompt && weakPrompt.coverage < 35) {
    actions.push({
      priority: "高",
      title: `补充「${weakPrompt.q.slice(0, 22)}」对比内容`,
      description: `${primary.name} 覆盖率 ${weakPrompt.coverage}%，竞品 ${weakPrompt.competitor || "领先"} 已出现。`,
      category: "内容",
    });
  }
  if (citeShare < 20) {
    actions.push({
      priority: "高",
      title: "提升官网被引用占比",
      description: `${primary.name} 域名引用 ${primaryCites} 次，份额仅 ${citeShare}%。`,
      category: "内容",
    });
  }
  if (thirdParty) {
    actions.push({
      priority: "中",
      title: `布局 ${thirdParty.domain} 等第三方来源`,
      description: `该来源被引用 ${thirdParty.citations} 次，品牌尚未充分覆盖。`,
      category: "PR",
    });
  }
  if (actions.length === 0) {
    actions.push({
      priority: "中",
      title: "持续扩充监测 Prompt",
      description: "增加高意图问题以提升样本代表性",
      category: "监控",
    });
  }

  let trend: TrendPoint[] = [];
  let bvi: BviMetrics = emptyBvi();
  const bviBrands = ranking.slice(0, 10).map((b) => ({
    brandId: b.brandId,
    name: b.name,
    isPrimary: b.isPrimary,
  }));

  if (!engineCode && (await l3HasData(db, workspaceId, range))) {
    const trendBrands = ranking;
    const { obsByDate, mentByDateBrand } = await l3CoverageTrend(
      db,
      workspaceId,
      range,
      trendBrands.map((b) => b.brandId),
    );
    trend = [...obsByDate.entries()].map(([date, obs]) => ({
      date,
      series: trendBrands.map((b) => ({
        brandId: b.brandId,
        name: b.name,
        coverage: pct(mentByDateBrand.get(`${date}|${b.brandId}`) ?? 0, obs, 0),
      })),
    }));

    const { obsByDate: bviObs, byDateBrand } = await l3BviDaily(
      db,
      workspaceId,
      range,
      bviBrands.map((b) => b.brandId),
    );
    const frames = buildBviFrames(bviBrands, bviObs, byDateBrand);
    bvi = { coverageMid: 50, likelihoodMid: 50, frames };
  } else {
    const dateObs = await db.execute(sql`
      SELECT o.observed_on AS d, COUNT(*) AS obs
      FROM answer_observations o
      LEFT JOIN engines e ON e.id = o.engine_id
      WHERE o.workspace_id = ${workspaceId}
      ${dateFilter}
      ${engineFilter}
      GROUP BY o.observed_on
      ORDER BY o.observed_on ASC
    `);
    const dateMentions = await db.execute(sql`
      SELECT
        o.observed_on AS d,
        abm.brand_id AS brand_id,
        SUM(CASE WHEN abm.mentioned = 1 THEN 1 ELSE 0 END) AS ment,
        AVG(CASE WHEN abm.mentioned = 1 THEN abm.position END) AS avg_position
      FROM answer_observations o
      INNER JOIN answer_brand_mentions abm ON abm.observation_id = o.id
      LEFT JOIN engines e ON e.id = o.engine_id
      WHERE o.workspace_id = ${workspaceId}
      ${dateFilter}
      ${engineFilter}
      GROUP BY o.observed_on, abm.brand_id
    `);
    const obsByDate = new Map(
      rowsOf(dateObs).map((row) => [
        String(row.d).slice(0, 10),
        Number(row.obs ?? 0),
      ]),
    );
    const mentByDateBrand = new Map<string, number>();
    const byDateBrand = new Map<
      string,
      { ment: number; avgPosition: number | null }
    >();
    for (const row of rowsOf(dateMentions)) {
      const date = String(row.d).slice(0, 10);
      const brandId = String(row.brand_id);
      const ment = Number(row.ment ?? 0);
      mentByDateBrand.set(`${date}|${brandId}`, ment);
      byDateBrand.set(`${date}|${brandId}`, {
        ment,
        avgPosition:
          row.avg_position == null
            ? null
            : Number(Number(row.avg_position).toFixed(2)),
      });
    }
    const trendBrands = ranking;
    trend = [...obsByDate.entries()].map(([date, obs]) => ({
      date,
      series: trendBrands.map((b) => ({
        brandId: b.brandId,
        name: b.name,
        coverage: pct(mentByDateBrand.get(`${date}|${b.brandId}`) ?? 0, obs, 0),
      })),
    }));
    bvi = {
      coverageMid: 50,
      likelihoodMid: 50,
      frames: buildBviFrames(bviBrands, obsByDate, byDateBrand),
    };
  }

  const urlRows =
    !engineCode && (await l3HasData(db, workspaceId, range))
      ? (
          await l3TopUrls(db, workspaceId, range, 20)
        )
          .filter((u) => domainsMatch(u.domain, primary.domain))
          .slice(0, 3)
          .map((u) => ({ url: u.url, title: u.title, cited: u.cited }))
      : rowsOf(
          await db.execute(sql`
            SELECT
              ce.url AS url,
              MAX(ce.title) AS title,
              SUM(ce.times_cited) AS cited
            FROM citation_events ce
            INNER JOIN answer_observations o ON o.id = ce.observation_id
            LEFT JOIN engines e ON e.id = o.engine_id
            WHERE o.workspace_id = ${workspaceId}
            ${dateFilter}
            ${engineFilter}
              AND (
                ce.domain = ${primary.domain}
                OR ce.domain LIKE ${`%.${rootDomain(primary.domain)}`}
              )
            GROUP BY ce.url
            ORDER BY cited DESC
            LIMIT 3
          `),
        ).map((row) => ({
          url: String(row.url),
          title: String(row.title ?? ""),
          cited: Number(row.cited ?? 0),
        }));

  const primaryRow = ranking.find((m) => m.isPrimary);
  const rank = primaryRow
    ? ranking.findIndex((m) => m.brandId === primaryRow.brandId) + 1
    : ranking.length;

  const competitorMentions = ranking
    .filter((r) => !r.isPrimary)
    .slice(0, 3)
    .map((r) => ({ name: r.name, value: r.mentions, color: r.color }));
  const competitorPositions = ranking
    .filter((r) => !r.isPrimary && r.avgPosition != null)
    .sort((a, b) => (a.avgPosition ?? 99) - (b.avgPosition ?? 99))
    .slice(0, 3)
    .map((r) => ({ name: r.name, value: r.avgPosition ?? 0, color: r.color }));
  const competitorDomainCites = ranking
    .filter((r) => !r.isPrimary)
    .sort((a, b) => b.domainCitations - a.domainCitations)
    .slice(0, 3)
    .map((r) => ({ name: r.name, value: r.domainCitations, color: r.color }));

  const domainCitationTable: DomainCitationShare[] = domainRows.slice(0, 10).map((row) => ({
    domain: row.domain,
    citations: row.citations,
    share: pct(row.citations, totalCites),
    type: row.category,
  }));

  return {
    workspaceId: ws.id,
    workspaceName: ws.name,
    brandName: primary.name,
    brandDomain: primary.domain,
    observationCount: totalObs,
    range,
    metrics: [
      {
        label: "AI 可见度",
        value: String(visibility),
        suffix: "/100",
        delta:
          prevVisibility == null
            ? NO_DELTA
            : formatDeltaPct(visibility, prevVisibility),
        tone: "mint",
        hint: "0–100 综合指数：综合品牌覆盖率、Share of Voice 与官网引用份额。越高表示在 AI 答卷中越显眼。",
      },
      {
        label: "品牌覆盖率",
        value: `${coverage}%`,
        delta:
          prevCoverage == null
            ? NO_DELTA
            : formatDeltaPp(coverage, prevCoverage),
        tone: "blue",
        hint: `本品至少被提及一次的答卷占比。当前 ${primaryAgg.mentionedObs}/${totalObs} 次回答中出现本品。`,
      },
      {
        label: "Share of Voice",
        value: `${sov}%`,
        delta: prevSov == null ? NO_DELTA : formatDeltaPp(sov, prevSov),
        tone: "violet",
        hint: "本品提及次数 ÷ 所有监测品牌提及总次数。反映相对声量，而非单纯是否出现。",
      },
      {
        label: "官网引用",
        value: String(primaryCites),
        delta:
          prevPrimaryCites == null
            ? NO_DELTA
            : formatDeltaCount(primaryCites, prevPrimaryCites),
        tone: "amber",
        hint: "AI 答卷引用列表中命中本品官网域名的次数。提及品牌但未引用官网时，该项会偏低。",
      },
    ],
    notice,
    engines: enginesOut,
    competitors,
    ranking,
    quadrantLabel: quadrantFromVisibility(visibility),
    visibility,
    rank,
    attentionPrompts,
    topPromptsByMentions,
    topPromptsByDomainCites,
    actions,
    trend,
    bvi,
    promptTotal: promptStats.length,
    primaryMentions: primaryAgg.mentionSum,
    avgPosition: primaryAgg.avgPosition,
    domainCoverage,
    domainCitations: primaryCites,
    citationShare: citeShare,
    competitorMentions,
    competitorPositions,
    competitorDomainCites,
    topCitedUrls: urlRows,
    domainCitationTable,
  };
}

export async function getCitationsMetrics(
  db: AppDb,
  workspaceId: string,
  opts?: MetricsQueryOpts,
): Promise<CitationsMetrics | null> {
  const ctx = await loadWorkspaceContext(db, workspaceId);
  if (!ctx?.primary) return null;
  const { primary, brands } = ctx;
  const range = resolveMetricsRange(opts);
  const engineFilter = engineSql(opts?.engine);
  const dateFilter = dateFilterSql(range);
  const competitorRoots = new Set(
    brands.filter((b) => b.role === "competitor").map((b) => rootDomain(b.domain)),
  );
  const brandById = new Map(brands.map((b) => [b.id, b]));

  const domainRows = await domainCitationAggs(
    db,
    workspaceId,
    opts?.engine,
    range,
  );
  const totalCitations = domainRows.reduce((s, d) => s + d.citations, 0);

  const bucket = new Map<string, number>();
  for (const row of domainRows) {
    const label = row.category || "其他";
    bucket.set(label, (bucket.get(label) ?? 0) + row.citations);
  }
  const structureColors: Record<string, string> = {
    自有官网: "#4f67ef",
    第三方媒体: "#38b98a",
    测评与社区: "#8a6fe8",
    社区讨论: "#8a6fe8",
    测评平台: "#8a6fe8",
    竞品官网: "#e4a63e",
    政府机构: "#94a3b8",
    行业媒体: "#38b98a",
    其他: "#cbd5e1",
  };
  const structure = [...bucket.entries()]
    .map(([label, count]) => ({
      label,
      percent: pct(count, totalCitations, 0),
      color: structureColors[label] ?? "#94a3b8",
    }))
    .sort((a, b) => b.percent - a.percent);

  const opportunities = domainRows
    .filter((d) => {
      const root = rootDomain(d.domain);
      if (domainsMatch(d.domain, primary.domain)) return false;
      if (competitorRoots.has(root)) return true;
      return d.category === "测评平台" || d.category === "社区讨论" || d.category === "行业媒体";
    })
    .slice(0, 8)
    .map((d) => ({
      domain: d.domain,
      description: competitorRoots.has(rootDomain(d.domain))
        ? `竞品相关引用 ${d.citations} 次`
        : `主题内容被引用 ${d.citations} 次`,
      level: d.citations >= 40 ? "高机会" : d.citations >= 15 ? "中机会" : "低机会",
    }));

  const useL3 = !opts?.engine && (await l3HasData(db, workspaceId, range));

  const topUrlRows = useL3
    ? await l3TopUrls(db, workspaceId, range, 80)
    : rowsOf(
        await db.execute(sql`
          SELECT
            ce.url AS url,
            MAX(ce.title) AS title,
            ce.domain AS domain,
            COALESCE(NULLIF(MAX(ce.domain_category), ''), '其他') AS category,
            SUM(ce.times_cited) AS cited
          FROM citation_events ce
          INNER JOIN answer_observations o ON o.id = ce.observation_id
          LEFT JOIN engines e ON e.id = o.engine_id
          WHERE o.workspace_id = ${workspaceId}
          ${dateFilter}
          ${engineFilter}
          GROUP BY ce.url, ce.domain
          ORDER BY cited DESC
          LIMIT 80
        `),
      ).map((row) => ({
        url: String(row.url),
        title: String(row.title ?? ""),
        domain: String(row.domain ?? ""),
        category: String(row.category ?? "其他"),
        cited: Number(row.cited ?? 0),
        brandYes: 0,
      }));

  const topUrls = topUrlRows.map((row) => row.url);
  const compsMap = new Map<
    string,
    Array<{ brandId: string; name: string; mark: string; color: string }>
  >();
  if (topUrls.length && !useL3) {
    const urlList = sql.join(
      topUrls.map((u) => sql`${u}`),
      sql`, `,
    );
    const compByUrl = await db.execute(sql`
      SELECT
        ce.url AS url,
        wb.id AS brand_id,
        wb.name AS name,
        wb.mark AS mark,
        wb.color AS color
      FROM citation_events ce
      INNER JOIN answer_observations o ON o.id = ce.observation_id
      INNER JOIN citation_competitors cc ON cc.event_id = ce.id
      INNER JOIN workspace_brands wb ON wb.id = cc.brand_id
      LEFT JOIN engines e ON e.id = o.engine_id
      WHERE o.workspace_id = ${workspaceId}
      ${dateFilter}
      ${engineFilter}
        AND ce.url IN (${urlList})
    `);
    for (const row of rowsOf(compByUrl)) {
      const url = String(row.url);
      const list = compsMap.get(url) ?? [];
      const brandId = String(row.brand_id);
      if (!list.some((c) => c.brandId === brandId)) {
        const brand = brandById.get(brandId);
        list.push({
          brandId,
          name: String(row.name),
          mark: String(row.mark || brand?.name.slice(0, 1) || "?"),
          color: String(row.color || brand?.color || "#9368ee"),
        });
      }
      compsMap.set(url, list);
    }
  }

  const prevRange = previousMetricsRange(range);
  const prevUrlMap =
    useL3 && (await l3HasData(db, workspaceId, prevRange))
      ? await l3UrlWindowMap(db, workspaceId, prevRange)
      : null;
  const currUrlMap = useL3
    ? await l3UrlWindowMap(db, workspaceId, range)
    : new Map(topUrlRows.map((r) => [r.url, r.cited]));

  const urls: CitedUrlRow[] = topUrlRows.map((row) => {
    const domain = row.domain;
    const own = domainsMatch(domain, primary.domain);
    return {
      url: row.url,
      title: row.title,
      cited: row.cited,
      brandMentioned: own || row.brandYes > 0 ? "yes" : "no",
      domain,
      category: row.category,
      competitors: (compsMap.get(row.url) ?? []).slice(0, 5),
    };
  });

  const domainCitations: DomainCitationShare[] = domainRows.slice(0, 15).map((row) => ({
    domain: row.domain,
    citations: row.citations,
    share: pct(row.citations, totalCitations),
    type: row.category,
  }));

  let topPromptsByDomainCites: PromptCountRow[] = [];
  if (useL3) {
    const byPrompt = await l3PromptAggs(db, workspaceId, range);
    const promptRows = await db
      .select({ id: prompts.id, text: prompts.text })
      .from(prompts)
      .where(eq(prompts.workspaceId, workspaceId));
    const textById = new Map(promptRows.map((p) => [p.id, p.text]));
    topPromptsByDomainCites = [...byPrompt.entries()]
      .map(([promptId, agg]) => ({
        promptId,
        q: textById.get(promptId) ?? "",
        count: agg.primaryCites,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  } else {
    const topPromptCiteRows = await db.execute(sql`
      SELECT
        o.prompt_id AS prompt_id,
        p.text AS text,
        SUM(ce.times_cited) AS primary_cites
      FROM answer_observations o
      INNER JOIN prompts p ON p.id = o.prompt_id
      INNER JOIN citation_events ce ON ce.observation_id = o.id
      LEFT JOIN engines e ON e.id = o.engine_id
      WHERE o.workspace_id = ${workspaceId}
      ${dateFilter}
      ${engineFilter}
        AND (
          ce.domain = ${primary.domain}
          OR ce.domain LIKE ${`%.${rootDomain(primary.domain)}`}
        )
      GROUP BY o.prompt_id, p.text
      ORDER BY primary_cites DESC
      LIMIT 10
    `);
    topPromptsByDomainCites = rowsOf(topPromptCiteRows).map((row) => ({
      promptId: String(row.prompt_id),
      q: String(row.text ?? ""),
      count: Number(row.primary_cites ?? 0),
    }));
  }

  const metaByUrl = new Map(
    topUrlRows.map((row) => [row.url, row] as const),
  );
  let prevTopRows: Array<{
    url: string;
    title: string;
    domain: string;
    category: string;
    cited: number;
  }> = [];
  if (useL3 && prevUrlMap) {
    prevTopRows = (await l3TopUrls(db, workspaceId, prevRange, 80)).map((row) => ({
      url: row.url,
      title: row.title,
      domain: row.domain,
      category: row.category,
      cited: row.cited,
    }));
    for (const row of prevTopRows) {
      if (!metaByUrl.has(row.url)) metaByUrl.set(row.url, { ...row, brandYes: 0 });
    }
  }

  const candidateUrls = new Set<string>([
    ...topUrlRows.map((r) => r.url),
    ...prevTopRows.map((r) => r.url),
  ]);
  const moved = prevUrlMap
    ? [...candidateUrls]
        .map((url) => {
          const curr = currUrlMap.get(url) ?? 0;
          const prev = prevUrlMap.get(url) ?? 0;
          const meta = metaByUrl.get(url);
          return {
            url,
            title: meta?.title ?? url,
            domain: meta?.domain ?? "",
            category: meta?.category ?? "其他",
            cited: curr,
            delta: curr - prev,
            prev,
          };
        })
        .filter((row) => row.delta !== 0)
    : [];
  const winners: CitedUrlRow[] = moved
    .filter((r) => r.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 5)
    .map((row) => ({
      url: row.url,
      title: row.title,
      cited: row.cited,
      delta: row.delta,
      brandMentioned: domainsMatch(row.domain, primary.domain) ? "yes" : "no",
      domain: row.domain,
      category: row.category,
      competitors: [],
    }));
  const losers: CitedUrlRow[] = moved
    .filter((r) => r.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 5)
    .map((row) => ({
      url: row.url,
      title: row.title,
      cited: row.cited,
      delta: row.delta,
      brandMentioned: domainsMatch(row.domain, primary.domain) ? "yes" : "no",
      domain: row.domain,
      category: row.category,
      competitors: [],
    }));

  // Domain growth vs previous window
  const prevDomainRows =
    useL3 && prevUrlMap
      ? await domainCitationAggs(db, workspaceId, undefined, prevRange)
      : [];
  const prevDomainMap = new Map(prevDomainRows.map((d) => [d.domain, d.citations]));
  const domainsWithGrowth: CitationDomainRow[] = domainRows.slice(0, 40).map((row) => {
    const prev = prevDomainMap.get(row.domain);
    return {
      domain: row.domain,
      type: row.category,
      citations: row.citations,
      prompts: row.prompts,
      growth:
        prev == null ? NO_DELTA : formatDeltaCount(row.citations, prev),
      authority: Math.min(95, 55 + Math.round(Math.log10(row.citations + 1) * 18)),
    };
  });

  return {
    totalCitations,
    range,
    structure,
    opportunities,
    domains: domainsWithGrowth,
    urls,
    domainCitations,
    topPromptsByDomainCites,
    winners,
    losers,
  };
}

export async function getPromptDetailMetrics(
  db: AppDb,
  workspaceId: string,
  promptId: string,
  opts?: MetricsQueryOpts,
): Promise<PromptDetailMetrics | null> {
  const ctx = await loadWorkspaceContext(db, workspaceId);
  if (!ctx?.primary) return null;
  const range = resolveMetricsRange(opts);
  const dateFilter = dateFilterSql(range);

  const [promptRow] = await db
    .select()
    .from(prompts)
    .where(and(eq(prompts.workspaceId, workspaceId), eq(prompts.id, promptId)))
    .limit(1);
  if (!promptRow) return null;

  const aggRows = await db.execute(sql`
    SELECT
      COUNT(DISTINCT o.id) AS obs,
      COUNT(DISTINCT CASE WHEN abm.mentioned = 1 THEN o.id END) AS primary_mentions
    FROM answer_observations o
    LEFT JOIN answer_brand_mentions abm
      ON abm.observation_id = o.id AND abm.brand_id = ${ctx.primary.id}
    WHERE o.workspace_id = ${workspaceId} AND o.prompt_id = ${promptId}
    ${dateFilter}
  `);
  const agg = rowsOf(aggRows)[0] ?? {};
  const obsCount = Number(agg.obs ?? 0);
  const primaryMentions = Number(agg.primary_mentions ?? 0);
  const coverage = pct(primaryMentions, obsCount, 0);
  const tags = Array.isArray(promptRow.tags) ? promptRow.tags : [];
  const prompt: PromptMetricRow = {
    promptId: promptRow.id,
    q: promptRow.text,
    tag: tags[0] || inferTag(promptRow.text),
    market: promptRow.market || "",
    coverage,
    sentiment: sentimentFromCoverage(coverage),
    mentions: primaryMentions,
    citations: 0,
    competitor: "—",
    competitors: [],
    status: statusFromCoverage(coverage, 0),
    brandMentions: primaryMentions,
    totalBrandMentions: primaryMentions,
    domainMentions: 0,
    totalDomainCitations: 0,
    intentVolume: intentFromCoverage(coverage, promptRow.intentVolume),
    sentimentBreakdown: estimateSentimentBreakdown(
      primaryMentions,
      sentimentFromCoverage(coverage),
    ),
  };

  const obs = await db.execute(sql`
    SELECT
      o.id AS id,
      o.observed_on AS observed_on,
      o.market AS market,
      o.answer_text AS answer_text,
      e.name AS engine_name,
      e.code AS engine_code,
      COALESCE(abm.mentioned, 0) AS mentioned
    FROM answer_observations o
    INNER JOIN engines e ON e.id = o.engine_id
    LEFT JOIN answer_brand_mentions abm
      ON abm.observation_id = o.id AND abm.brand_id = ${ctx.primary.id}
    WHERE o.workspace_id = ${workspaceId} AND o.prompt_id = ${promptId}
    ${dateFilter}
    ORDER BY o.observed_on DESC, e.sort_order ASC
    LIMIT 24
  `);

  const obsRows = rowsOf(obs);
  const obsIds = obsRows.map((row) => String(row.id));
  const citesByObs = new Map<
    string,
    Array<{ url: string; title: string; position: number; domain: string }>
  >();
  if (obsIds.length) {
    const idList = sql.join(
      obsIds.map((id) => sql`${id}`),
      sql`, `,
    );
    const citeRows = await db.execute(sql`
      SELECT observation_id, url, title, position, domain
      FROM citation_events
      WHERE observation_id IN (${idList})
      ORDER BY position ASC
    `);
    for (const row of rowsOf(citeRows)) {
      const oid = String(row.observation_id);
      const list = citesByObs.get(oid) ?? [];
      list.push({
        url: String(row.url),
        title: String(row.title ?? ""),
        position: Number(row.position ?? 0),
        domain: String(row.domain ?? ""),
      });
      citesByObs.set(oid, list);
    }
  }

  const observations = obsRows.map((row) => {
    const id = String(row.id);
    const code = String(row.engine_code);
    return {
      id,
      engine: String(row.engine_name),
      engineMark: engineMark(code, String(row.engine_name)),
      engineColor: ENGINE_COLORS[code] ?? "#111827",
      observedOn: String(row.observed_on).slice(0, 10),
      market: String(row.market ?? ""),
      mentioned: Number(row.mentioned) === 1,
      answerText: String(row.answer_text ?? ""),
      citations: citesByObs.get(id) ?? [],
    };
  });

  return { prompt, observations };
}

export async function resolveWorkspaceId(
  db: AppDb,
  opts: { workspaceId?: string | null; slug?: string | null },
): Promise<string | null> {
  if (opts.workspaceId) {
    const [row] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.id, opts.workspaceId))
      .limit(1);
    if (row) return row.id;
  }
  if (opts.slug) {
    const [row] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.slug, opts.slug))
      .limit(1);
    if (row) return row.id;
  }
  const list = await listMonitoringWorkspaces(db);
  return list[0]?.id ?? null;
}
