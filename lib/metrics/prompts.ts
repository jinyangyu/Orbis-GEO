import { and, asc, eq, sql } from "drizzle-orm";
import type { AppDb } from "@/db";
import { prompts } from "@/db/schema";
import { rowsOf } from "@/lib/db/rows";
import { l3HasData, l3PromptAggs } from "./l3-aggs";
import {
  estimateSentimentBreakdown,
  resolveSentiment,
} from "./heuristics";
import type {
  PromptDetailMetrics,
  PromptMetricRow,
  PromptsMetrics,
} from "./types";
import {
  ENGINE_COLORS,
  canUseL3,
  dateFilterSql,
  engineMark,
  engineSql,
  inferTag,
  intentFromCoverage,
  loadWorkspaceContext,
  pct,
  resolveMetricsRange,
  rootDomain,
  statusFromCoverage,
  type MetricsQueryOpts,
} from "./shared";

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

  const useL3 =
    canUseL3(opts?.engine, opts?.market) &&
    (await l3HasData(db, workspaceId, range));
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
    const sentiment = resolveSentiment(null, coverage);
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
      sentimentBreakdown:
        sentiment != null
          ? estimateSentimentBreakdown(agg.primaryMentions, sentiment)
          : undefined,
    };
  });

  items.sort(
    (a, b) =>
      b.brandMentions - a.brandMentions || b.coverage - a.coverage,
  );
  const limit = opts?.limit ?? 100;
  return { items: items.slice(0, limit), total: items.length, markets, range };
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
  const sentiment = resolveSentiment(null, coverage);
  const tags = Array.isArray(promptRow.tags) ? promptRow.tags : [];
  const prompt: PromptMetricRow = {
    promptId: promptRow.id,
    q: promptRow.text,
    tag: tags[0] || inferTag(promptRow.text),
    market: promptRow.market || "",
    coverage,
    sentiment,
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
    sentimentBreakdown:
      sentiment != null
        ? estimateSentimentBreakdown(primaryMentions, sentiment)
        : undefined,
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
