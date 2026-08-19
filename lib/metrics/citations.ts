import { eq, sql } from "drizzle-orm";
import type { AppDb } from "@/db";
import { prompts } from "@/db/schema";
import { rowsOf } from "@/lib/db/rows";
import {
  formatDeltaCount,
  l3HasData,
  l3PromptAggs,
  l3TopUrls,
  l3UrlWindowMap,
  previousMetricsRange,
} from "./l3-aggs";
import type {
  CitationDomainRow,
  CitationsMetrics,
  CitedUrlRow,
  DomainCitationShare,
  PromptCountRow,
} from "./types";
import {
  NO_DELTA,
  canUseL3,
  dateFilterSql,
  domainCitationAggs,
  domainsMatch,
  engineSql,
  loadWorkspaceContext,
  pct,
  resolveMetricsRange,
  rootDomain,
  type MetricsQueryOpts,
} from "./shared";

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

  const useL3 =
    canUseL3(opts?.engine) && (await l3HasData(db, workspaceId, range));
  const domainRows = await domainCitationAggs(
    db,
    workspaceId,
    opts?.engine,
    range,
    undefined,
    useL3,
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
    Array<{ brandId: string; name: string; domain: string; mark: string; color: string }>
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
        wb.domain AS domain,
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
          domain: String(row.domain || brand?.domain || ""),
          mark: String(row.mark || brand?.name.slice(0, 1) || "?"),
          color: String(row.color || brand?.color || "#9368ee"),
        });
      }
      compsMap.set(url, list);
    }
  }

  const prevRange = previousMetricsRange(range);
  const prevL3 =
    useL3 && (await l3HasData(db, workspaceId, prevRange));
  const prevTopRows = prevL3
    ? (await l3TopUrls(db, workspaceId, prevRange, 80)).map((row) => ({
        url: row.url,
        title: row.title,
        domain: row.domain,
        category: row.category,
        cited: row.cited,
      }))
    : [];
  const candidateUrlList = [
    ...new Set([
      ...topUrlRows.map((r) => r.url),
      ...prevTopRows.map((r) => r.url),
    ]),
  ];
  const prevUrlMap = prevL3
    ? await l3UrlWindowMap(db, workspaceId, prevRange, candidateUrlList)
    : null;
  const currUrlMap = useL3
    ? await l3UrlWindowMap(db, workspaceId, range, candidateUrlList)
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
  for (const row of prevTopRows) {
    if (!metaByUrl.has(row.url)) metaByUrl.set(row.url, { ...row, brandYes: 0 });
  }

  const candidateUrls = new Set(candidateUrlList);
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
    prevL3
      ? await domainCitationAggs(db, workspaceId, undefined, prevRange, undefined, true)
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
