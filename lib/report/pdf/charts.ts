import { brandColor, PDF_COLORS } from "./tokens";
import { esc, fmtDateShort } from "./util";

function coverageAxisMax(values: number[]): number {
  const peak = Math.max(0, ...values);
  if (peak <= 0) return 20;
  const padded = peak * 1.12;
  const step = padded <= 25 ? 5 : padded <= 60 ? 10 : 20;
  return Math.min(100, Math.max(step * 2, Math.ceil(padded / step) * step));
}

/** Smooth Catmull-Rom spline → cubic Bezier (Otterly-style). */
function seriesSmoothPath(
  values: number[],
  maxY: number,
  width: number,
  height: number,
  padTop: number,
  padBottom: number,
): string {
  if (!values.length) return "";
  const max = Math.max(maxY, 1);
  const plotH = height - padTop - padBottom;
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const pts = values.map((v, i) => ({
    x: i * step,
    y: padTop + plotH - (v / max) * plotH,
  }));
  if (pts.length === 1) return `M${pts[0].x} ${pts[0].y}`;
  if (pts.length === 2) {
    return `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} L${pts[1].x.toFixed(1)} ${pts[1].y.toFixed(1)}`;
  }
  let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export type CoverageSeries = {
  brandId: string;
  name: string;
  values: number[];
  color: string;
};

export function buildCoverageSeries(
  trend: Array<{ date: string; series: Array<{ brandId: string; name: string; coverage: number }> }>,
  limit = 6,
): { dates: string[]; series: CoverageSeries[] } {
  if (!trend.length) return { dates: [], series: [] };
  const first = trend[0]?.series ?? [];
  const ids = first.slice(0, limit).map((s) => s.brandId);
  const series: CoverageSeries[] = ids.map((id, i) => {
    const name =
      trend.map((t) => t.series.find((x) => x.brandId === id)?.name).find(Boolean) ||
      id;
    return {
      brandId: id,
      name,
      color: brandColor(i),
      values: trend.map(
        (t) => t.series.find((x) => x.brandId === id)?.coverage ?? 0,
      ),
    };
  });
  return {
    dates: trend.map((t) => t.date),
    series,
  };
}

export function buildCoverageLineSvg(
  dates: string[],
  series: CoverageSeries[],
): string {
  const W = 700;
  const H = 220;
  const padL = 36;
  const padR = 8;
  const padT = 16;
  const padB = 28;
  const plotW = W - padL - padR;
  const allVals = series.flatMap((s) => s.values);
  const maxY = coverageAxisMax(allVals);
  const ticks = 5;
  const grid: string[] = [];
  for (let i = 0; i <= ticks; i++) {
    const y = padT + ((H - padT - padB) * i) / ticks;
    const label = Math.round(maxY - (maxY * i) / ticks);
    grid.push(
      `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="#eef0f3" stroke-width="1"/>`,
    );
    grid.push(
      `<text x="${padL - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end" fill="#9aa3af" font-size="9">${label}</text>`,
    );
  }

  const xTicks: string[] = [];
  if (dates.length) {
    const idxs = [
      0,
      Math.floor((dates.length - 1) / 2),
      dates.length - 1,
    ].filter((v, i, a) => a.indexOf(v) === i);
    for (const idx of idxs) {
      const x =
        padL +
        (dates.length > 1 ? (idx / (dates.length - 1)) * plotW : plotW / 2);
      xTicks.push(
        `<text x="${x.toFixed(1)}" y="${H - 8}" text-anchor="middle" fill="#9aa3af" font-size="9">${esc(fmtDateShort(dates[idx]))}</text>`,
      );
    }
  }

  const paths = series
    .map((s) => {
      const d = seriesSmoothPath(s.values, maxY, plotW, H, padT, padB);
      if (!d) return "";
      // shift path by padL — rewrite: seriesSmoothPath uses 0..plotW, need translate
      return `<path transform="translate(${padL},0)" d="${d}" fill="none" stroke="${esc(s.color)}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join("");

  const legend = series
    .map(
      (s) =>
        `<span class="legend-item"><i class="legend-dot" style="background:${esc(s.color)}"></i>${esc(s.name)}</span>`,
    )
    .join("");

  return `
  <div class="chart-card">
    <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <text x="4" y="12" fill="#9aa3af" font-size="9">Brand Coverage %</text>
      ${grid.join("")}
      ${paths}
      ${xTicks.join("")}
      <text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="#f3f4f6" font-size="28" font-weight="700" opacity="0.7">Orbis.GEO</text>
    </svg>
    <div class="legend">${legend}</div>
  </div>`;
}

export type BviPoint = {
  name: string;
  coverage: number;
  likelihoodToBuy: number;
  isPrimary?: boolean;
  color: string;
};

export function buildBviScatterSvg(
  brands: BviPoint[],
  coverageMid: number,
  likelihoodMid: number,
  maxCoverage = 100,
): string {
  const W = 700;
  const H = 420;
  const padL = 48;
  const padR = 24;
  const padT = 28;
  const padB = 36;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const xMax = Math.max(
    20,
    Math.ceil((Math.max(maxCoverage, ...brands.map((b) => b.coverage), coverageMid) * 1.1) / 10) * 10,
  );
  const midX = padL + (coverageMid / xMax) * plotW;
  const midY = padT + plotH - (likelihoodMid / 100) * plotH;

  const qLabels = `
    <text x="${padL + 10}" y="${padT + 16}" fill="${PDF_COLORS.niche}" font-size="12" font-weight="600">利基</text>
    <text x="${W - padR - 10}" y="${padT + 16}" text-anchor="end" fill="${PDF_COLORS.leaders}" font-size="12" font-weight="600">领导者</text>
    <text x="${padL + 10}" y="${H - padB - 10}" fill="${PDF_COLORS.lowPerf}" font-size="12" font-weight="600">低表现</text>
    <text x="${W - padR - 10}" y="${H - padB - 10}" text-anchor="end" fill="${PDF_COLORS.lowConv}" font-size="12" font-weight="600">低转化</text>
  `;

  const points = brands
    .map((b) => {
      const x = padL + (Math.min(b.coverage, xMax) / xMax) * plotW;
      const y = padT + plotH - (b.likelihoodToBuy / 100) * plotH;
      const r = b.isPrimary ? 5.5 : 4.5;
      return `
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${esc(b.color)}" stroke="#fff" stroke-width="1.5"/>
        <text x="${(x + 8).toFixed(1)}" y="${(y + 3.5).toFixed(1)}" fill="#374151" font-size="${b.isPrimary ? 11 : 10}" font-weight="${b.isPrimary ? 700 : 400}">${esc(b.name)}</text>
      `;
    })
    .join("");

  const xAxisLabels = [0, Math.round(xMax / 2), xMax]
    .map((v, i) => {
      const x = padL + (v / xMax) * plotW;
      const anchor = i === 0 ? "start" : i === 2 ? "end" : "middle";
      return `<text x="${x.toFixed(1)}" y="${H - 10}" text-anchor="${anchor}" fill="#9aa3af" font-size="9">${v}</text>`;
    })
    .join("");

  return `
  <div class="chart-card">
    <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <text transform="translate(14,${H / 2}) rotate(-90)" text-anchor="middle" fill="#9aa3af" font-size="10">Likelihood to buy (%)</text>
      <line x1="${midX.toFixed(1)}" y1="${padT}" x2="${midX.toFixed(1)}" y2="${H - padB}" stroke="#d7dbe2" stroke-width="1" stroke-dasharray="4 4"/>
      <line x1="${padL}" y1="${midY.toFixed(1)}" x2="${W - padR}" y2="${midY.toFixed(1)}" stroke="#d7dbe2" stroke-width="1" stroke-dasharray="4 4"/>
      <rect x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" fill="none" stroke="#eef0f3"/>
      ${qLabels}
      <text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="#f3f4f6" font-size="36" font-weight="700" opacity="0.65">Orbis.GEO</text>
      ${points}
      ${xAxisLabels}
      <text x="${W / 2}" y="${H - 2}" text-anchor="middle" fill="#9aa3af" font-size="10">Brand Coverage (%)</text>
      <text x="${padL - 6}" y="${padT + 4}" text-anchor="end" fill="#9aa3af" font-size="9">100</text>
      <text x="${padL - 6}" y="${H - padB}" text-anchor="end" fill="#9aa3af" font-size="9">0</text>
    </svg>
  </div>`;
}

export function buildDomainShareBarsHtml(
  rows: Array<{ domain: string; share: number; color: string }>,
): string {
  const max = Math.max(1, ...rows.map((r) => r.share));
  return `
  <div class="chart-card">
    ${rows
      .map((r) => {
        const pct = Math.max(2, (r.share / max) * 100);
        return `
        <div class="bar-row">
          <span class="bar-label">${esc(r.domain)}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${pct.toFixed(1)}%;background:${esc(r.color)}"></div></div>
          <span class="bar-val">${esc(r.share)}%</span>
        </div>`;
      })
      .join("")}
  </div>`;
}

export function legendHtml(series: Array<{ name: string; color: string }>): string {
  return `<div class="legend">${series
    .map(
      (s) =>
        `<span class="legend-item"><i class="legend-dot" style="background:${esc(s.color)}"></i>${esc(s.name)}</span>`,
    )
    .join("")}</div>`;
}
