import { eq, sql } from "drizzle-orm";
import type { AppDb } from "@/db";
import { prompts } from "@/db/schema";
import { rowsOf } from "@/lib/db/rows";
import {
  formatDeltaCount,
  formatDeltaPct,
  formatDeltaPp,
  l3CoverageTrendAndBvi,
  l3HasData,
  l3PromptAggs,
  l3TopUrls,
  previousMetricsRange,
} from "./l3-aggs";
import {
  estimateSentimentBreakdown,
  resolveSentiment,
  visibilityIndex,
} from "./heuristics";
import type {
  BrandsMetrics,
  BviMetrics,
  CompetitorSovRow,
  DomainCitationShare,
  OverviewAction,
  OverviewMetrics,
  PromptCountRow,
  PromptMetricRow,
  TrendPoint,
} from "./types";
import {
  NO_DELTA,
  brandMentionAggs,
  buildBviFrames,
  buildMatrix,
  canUseL3,
  citedObservationCount,
  dateFilterSql,
  domainCitationAggs,
  domainsMatch,
  emptyBvi,
  enginePrimaryBreakdown,
  engineSql,
  inferTag,
  intentFromCoverage,
  loadWorkspaceContext,
  pct,
  quadrantFromVisibility,
  resolveMetricsRange,
  rootDomain,
  statusFromCoverage,
  type MetricsQueryOpts,
} from "./shared";

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

  const useL3 =
    canUseL3(engineCode, opts?.market) &&
    (await l3HasData(db, workspaceId, range));

  const { totalObs, byBrand } = await brandMentionAggs(
    db,
    workspaceId,
    engineCode,
    range,
    opts?.market,
    useL3,
  );
  const primaryAgg = byBrand.get(primary.id) ?? {
    brandId: primary.id,
    mentionedObs: 0,
    mentionSum: 0,
    avgPosition: null,
    avgSentiment: null,
  };
  const totalMentions = [...byBrand.values()].reduce((s, b) => s + b.mentionSum, 0);
  const coverage = pct(primaryAgg.mentionedObs, totalObs);
  const sov = pct(primaryAgg.mentionSum, totalMentions);

  const domainRows = await domainCitationAggs(
    db,
    workspaceId,
    engineCode,
    range,
    opts?.market,
    useL3,
  );
  const primaryCites = domainRows
    .filter((d) => domainsMatch(d.domain, primary.domain))
    .reduce((s, d) => s + d.citations, 0);
  const totalCites = domainRows.reduce((s, d) => s + d.citations, 0);
  const citeShare = pct(primaryCites, totalCites);
  const visibility = visibilityIndex(coverage, sov, citeShare);

  const primaryDomains = [
    ...new Set(
      domainRows
        .filter((d) => domainsMatch(d.domain, primary.domain))
        .map((d) => d.domain)
        .filter(Boolean),
    ),
  ];
  if (primary.domain && !primaryDomains.includes(primary.domain)) {
    primaryDomains.push(primary.domain);
  }
  const domainCovCount = await citedObservationCount(
    db,
    workspaceId,
    primaryDomains,
    range,
    engineCode,
  );
  const domainCoverage = pct(domainCovCount, totalObs);

  const enginesOut = await enginePrimaryBreakdown(
    db,
    workspaceId,
    primary.id,
    range,
    engineCode,
  );

  const ranking = buildMatrix(brands, totalObs, byBrand, domainRows);

  const prevRange = previousMetricsRange(range);
  const prevL3 =
    useL3 && (await l3HasData(db, workspaceId, prevRange));
  const prevAggs = prevL3
    ? await brandMentionAggs(
        db,
        workspaceId,
        undefined,
        prevRange,
        opts?.market,
        true,
      )
    : null;
  const prevDomains = prevL3
    ? await domainCitationAggs(
        db,
        workspaceId,
        undefined,
        prevRange,
        opts?.market,
        true,
      )
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

  if (useL3) {
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
    .map((p) => {
      const sentiment = resolveSentiment(null, p.coverage);
      return {
        promptId: p.promptId,
        q: p.q,
        tag: inferTag(p.q),
        market: "",
        coverage: p.coverage,
        sentiment,
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
        sentimentBreakdown:
          sentiment != null
            ? estimateSentimentBreakdown(p.primaryMentions, sentiment)
            : undefined,
      };
    });

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

  if (useL3) {
    const trendBrands = ranking;
    const bviIds = bviBrands.map((b) => b.brandId);
    const { obsByDate, mentByDateBrand, byDateBrand } = await l3CoverageTrendAndBvi(
      db,
      workspaceId,
      range,
      [...new Set([...trendBrands.map((b) => b.brandId), ...bviIds])],
    );
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
    useL3
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
        hint: "0–100 综合指数：综合品牌覆盖率、声量份额与官网引用份额。越高表示在 AI 答卷中越显眼。",
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
        label: "声量份额",
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
