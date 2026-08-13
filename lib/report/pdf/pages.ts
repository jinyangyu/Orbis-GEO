import type { CitationsMetrics, OverviewMetrics } from "@/lib/metrics/types";
import {
  buildBviScatterSvg,
  buildCoverageLineSvg,
  buildCoverageSeries,
  buildDomainShareBarsHtml,
  type BviPoint,
} from "./charts";
import { coverPage, endPage, pageFooter, pageHeader, wrapPage, type ChromeCtx } from "./chrome";
import { brandColor } from "./tokens";
import {
  esc,
  fmtDateShort,
  fmtDateZh,
  localizeFilterLabel,
  quadrantZh,
  todayYmd,
} from "./util";

export type ReportPagesInput = {
  overview: OverviewMetrics;
  citations?: CitationsMetrics | null;
  rangeLabel: string;
  engineLabel: string;
  tagLabel: string;
  marketLabel: string;
  logoDataUrl?: string | null;
  brandName: string;
};

function dualList(
  title: string,
  rows: Array<{ name: string; value: string; color: string }>,
): string {
  return `
  <div>
    <h3>${esc(title)}</h3>
    ${rows
      .map(
        (r) => `
      <div class="list-row">
        <div class="list-left">
          <i class="dot" style="background:${esc(r.color)}"></i>
          <span>${esc(r.name)}</span>
        </div>
        <span class="list-val">${esc(r.value)}</span>
      </div>`,
      )
      .join("")}
  </div>`;
}

function contentPage(ctx: ChromeCtx, inner: string): string {
  return wrapPage(`${pageHeader(ctx)}${inner}${pageFooter()}`);
}

/** Build 11 Otterly-aligned report page HTML strings (no style tags). */
export function buildReportPages(input: ReportPagesInput): string[] {
  const o = input.overview;
  const brand = input.brandName || o.brandName || "品牌";
  const domain = o.brandDomain || "";
  const generatedOn = fmtDateZh(o.range?.to ?? todayYmd());
  const dateShort = fmtDateShort(o.range?.to ?? todayYmd());
  const ctx: ChromeCtx = {
    brand,
    domain,
    dateShort,
    logoDataUrl: input.logoDataUrl,
  };

  const rangeLabel = localizeFilterLabel(input.rangeLabel);
  const engineLabel = localizeFilterLabel(input.engineLabel);
  const tagLabel = localizeFilterLabel(input.tagLabel);
  const marketLabel = localizeFilterLabel(input.marketLabel);

  const { dates, series } = buildCoverageSeries(o.trend, 6);

  const ranking = o.ranking.slice(0, 10);
  const colorByName = new Map<string, string>();
  ranking.forEach((r, i) => colorByName.set(r.name, r.color || brandColor(i)));
  series.forEach((s) => colorByName.set(s.name, s.color));

  const mentionRows = ranking.map((r, i) => ({
    name: r.name,
    value: String(r.mentions),
    color: colorByName.get(r.name) || brandColor(i),
  }));
  const positionRows = ranking.map((r, i) => ({
    name: r.name,
    value: r.avgPosition == null ? "—" : String(r.avgPosition),
    color: colorByName.get(r.name) || brandColor(i),
  }));

  const bviFrame = o.bvi?.frames?.[o.bvi.frames.length - 1];
  const bviBrands: BviPoint[] = (
    bviFrame?.brands ??
    ranking.map((r) => ({
      brandId: r.brandId,
      name: r.name,
      isPrimary: r.isPrimary,
      coverage: r.coverage,
      likelihoodToBuy:
        r.avgPosition == null
          ? 0
          : Math.max(0, Math.min(100, 100 - (r.avgPosition - 1) * 12.5)),
      avgPosition: r.avgPosition,
    }))
  ).map((b, i) => ({
    name: b.name,
    coverage: b.coverage,
    likelihoodToBuy: b.likelihoodToBuy,
    isPrimary: b.isPrimary,
    color: colorByName.get(b.name) || brandColor(i),
  }));
  const midCov = o.bvi?.coverageMid ?? 50;
  const midLtb = o.bvi?.likelihoodMid ?? 50;
  const maxCov = Math.max(60, ...bviBrands.map((b) => b.coverage));

  const urlRows =
    input.citations?.urls?.slice(0, 10) ??
    o.topCitedUrls.map((u) => ({
      url: u.url,
      cited: u.cited,
      share: 0,
    }));
  const totalCite =
    input.citations?.totalCitations ??
    Math.max(
      1,
      urlRows.reduce((s, u) => s + Number(u.cited ?? 0), 0),
    );

  const domains =
    input.citations?.domainCitations?.slice(0, 10) ??
    o.domainCitationTable.slice(0, 10);
  const promptDomain =
    input.citations?.topPromptsByDomainCites ?? o.topPromptsByDomainCites;

  const domainBars = domains.slice(0, 8).map((d, i) => ({
    domain: d.domain,
    share: d.share,
    color: brandColor(i),
  }));

  const topUrls = (input.citations?.urls ?? o.topCitedUrls)
    .slice(0, 3)
    .map((u) => ({
      url: u.url,
      cited: Number(u.cited ?? 0),
    }));

  // --- Page 1: Cover ---
  const p1 = coverPage({
    brand,
    generatedOn,
    logoDataUrl: input.logoDataUrl,
    pills: [
      engineLabel,
      marketLabel,
      `${o.promptTotal} 个 Prompt`,
      rangeLabel,
      tagLabel,
    ],
  });

  // --- Page 2: Coverage over time ---
  const p2 = contentPage(
    ctx,
    `
    <h2>品牌覆盖趋势</h2>
    <p class="lead">展示各监测品牌在 AI 答卷中的覆盖率变化，便于观察品牌何时进入、爬升或跌出回答。</p>
    ${
      series.length
        ? buildCoverageLineSvg(dates, series)
        : `<p class="muted">暂无趋势数据</p>`
    }
    <div class="dual">
      ${dualList("品牌提及", mentionRows)}
      ${dualList("平均品牌位次", positionRows)}
    </div>
  `,
  );

  // --- Page 3: Brand Ranking ---
  const p3 = contentPage(
    ctx,
    `
    <h2>品牌排名</h2>
    <p class="lead">按所选时间窗内品牌提及总量排序，仅展示 Top 10。</p>
    <table class="rp-table">
      <thead>
        <tr>
          <th>#</th><th>名称</th><th>情感</th><th>提及</th><th>覆盖率</th><th>声量份额</th>
        </tr>
      </thead>
      <tbody>
        ${ranking
          .map((r, i) => {
            const color = colorByName.get(r.name) || brandColor(i);
            const sent =
              r.sentiment >= 0 ? `+${r.sentiment}` : String(r.sentiment);
            return `<tr class="${r.isPrimary ? "primary" : ""}">
              <td>${i + 1}</td>
              <td><span class="name-cell"><i class="dot" style="background:${esc(color)}"></i>${esc(r.name)}</span></td>
              <td><span class="sent-pill">${esc(sent)}</span></td>
              <td>${esc(r.mentions)}</td>
              <td>${esc(r.coverage)}%</td>
              <td>${esc(r.sovPercent)}%</td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table>
  `,
  );

  // --- Page 4: Top prompts by mentions ---
  const p4 = contentPage(
    ctx,
    `
    <h2>按品牌提及的 Top Prompts</h2>
    <p class="lead">在所选周期内，${esc(brand)} 被提及次数最高的 10 个监测问题。</p>
    <table class="rp-table">
      <thead><tr><th>排名</th><th>Prompt</th><th>本品提及</th></tr></thead>
      <tbody>
        ${o.topPromptsByMentions
          .slice(0, 10)
          .map(
            (p, i) =>
              `<tr><td>${i + 1}</td><td>${esc(p.q)}</td><td>${esc(p.count)}</td></tr>`,
          )
          .join("")}
      </tbody>
    </table>
  `,
  );

  // --- Page 5: BVI scatter ---
  const p5 = contentPage(
    ctx,
    `
    <h2>AI 搜索品牌可见度指数（BVI）</h2>
    <p class="lead">基于提及频次与答卷内平均位次，衡量各品牌在 AI 回答中的可见度与推荐优先级。</p>
    ${buildBviScatterSvg(bviBrands, midCov, midLtb, maxCov)}
  `,
  );

  // --- Page 6: BVI table ---
  const p6 = contentPage(
    ctx,
    `
    <h2>AI 搜索品牌可见度指数（BVI）</h2>
    <p class="lead">按覆盖率与购买倾向排序；每品牌归入领导者、利基、低转化或低表现象限。</p>
    <table class="rp-table">
      <thead>
        <tr><th>品牌</th><th>象限</th><th>覆盖率</th><th>购买倾向</th></tr>
      </thead>
      <tbody>
        ${[...bviBrands]
          .sort((a, b) => b.coverage - a.coverage)
          .slice(0, 12)
          .map((b) => {
            const q = quadrantZh(b.coverage, b.likelihoodToBuy, midCov, midLtb);
            return `<tr class="${b.isPrimary ? "primary" : ""}">
              <td><span class="name-cell"><i class="dot" style="background:${esc(b.color)}"></i>${esc(b.name)}</span></td>
              <td>${esc(q)}</td>
              <td>${b.coverage.toFixed(1)}%</td>
              <td>${b.likelihoodToBuy.toFixed(0)}</td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table>
  `,
  );

  // --- Page 7: Citation URLs ---
  const p7 = contentPage(
    ctx,
    `
    <h2>引用 URL</h2>
    <p class="lead">AI 回答最常引用的网页。可自建、超越或争取进入该列表——引用即排名信号。</p>
    <table class="rp-table">
      <thead><tr><th>排名</th><th>URL</th><th>份额</th><th>次数</th></tr></thead>
      <tbody>
        ${urlRows
          .map((u, i) => {
            const cited = Number(u.cited ?? 0);
            const share =
              "share" in u &&
              typeof (u as { share?: number }).share === "number" &&
              (u as { share?: number }).share! > 0
                ? Number((u as { share?: number }).share)
                : Number(((cited / totalCite) * 100).toFixed(2));
            return `<tr>
              <td>${i + 1}</td>
              <td class="url">${esc(u.url)}</td>
              <td>${share}%</td>
              <td>${cited}</td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table>
  `,
  );

  // --- Page 8: Domain coverage (bars + dual lists + top URLs) ---
  const citeList = domains.slice(0, 10).map((d, i) => ({
    name: d.domain,
    value: String(d.citations),
    color: brandColor(i),
  }));
  const shareList = domains.slice(0, 10).map((d, i) => ({
    name: d.domain,
    value: `${d.share}%`,
    color: brandColor(i),
  }));
  const p8 = contentPage(
    ctx,
    `
    <h2>域名覆盖</h2>
    <p class="lead">AI 最常引用的域名及其份额。本期以域名份额条形图呈现（暂无多域名日趋势）。</p>
    <p class="kpi-line">本品域名覆盖：<em>${esc(o.domainCoverage)}%</em></p>
    ${domainBars.length ? buildDomainShareBarsHtml(domainBars) : `<p class="muted">暂无域名数据</p>`}
    <div class="dual">
      ${dualList("域名引用", citeList)}
      ${dualList("引用份额", shareList)}
    </div>
    <div class="top-urls">
      <h3>我的 Top 3 URL</h3>
      ${topUrls
        .map(
          (u, i) => `
        <div class="list-row">
          <div class="list-left">
            <span>${i + 1}</span>
            <span class="url-pink">${esc(u.url)}</span>
          </div>
          <span class="list-val">${esc(u.cited)}</span>
        </div>`,
        )
        .join("")}
    </div>
  `,
  );

  // --- Page 9: Domain citations table ---
  const p9 = contentPage(
    ctx,
    `
    <h2>域名引用</h2>
    <p class="lead">按引用次数与份额排序的域名列表。AI 已在该品类形成信任来源——进入列表，或被其引用。</p>
    <table class="rp-table">
      <thead><tr><th>排名</th><th>域名</th><th>份额</th><th>引用次数</th></tr></thead>
      <tbody>
        ${domains
          .map(
            (d, i) =>
              `<tr>
                <td>${i + 1}</td>
                <td><span class="name-cell"><i class="dot" style="background:${esc(brandColor(i))}"></i>${esc(d.domain)}</span></td>
                <td>${esc(d.share)}%</td>
                <td>${esc(d.citations)}</td>
              </tr>`,
          )
          .join("")}
      </tbody>
    </table>
  `,
  );

  // --- Page 10: Top prompts by domain cites ---
  const p10 = contentPage(
    ctx,
    `
    <h2>按官网引用的 Top Prompts</h2>
    <p class="lead">本品域名被引用最多的 10 个监测问题。</p>
    <table class="rp-table">
      <thead><tr><th>排名</th><th>Prompt</th><th>域名引用</th></tr></thead>
      <tbody>
        ${promptDomain
          .slice(0, 10)
          .map(
            (p, i) =>
              `<tr><td>${i + 1}</td><td>${esc(p.q)}</td><td>${esc(p.count)}</td></tr>`,
          )
          .join("")}
      </tbody>
    </table>
  `,
  );

  // --- Page 11: End ---
  const p11 = endPage({ brand, domain });

  return [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11];
}
