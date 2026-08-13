import { esc } from "./util";

export type ChromeCtx = {
  brand: string;
  domain: string;
  dateShort: string;
  logoDataUrl?: string | null;
};

export function pageHeader(ctx: ChromeCtx): string {
  const mark = esc((ctx.brand[0] || "B").toUpperCase());
  const logo = ctx.logoDataUrl
    ? `<img src="${esc(ctx.logoDataUrl)}" alt="" />`
    : `<span class="mark">${mark}</span>`;
  const metaParts = [ctx.domain, ctx.dateShort].filter(Boolean);
  return `
  <div class="orbis-rp-header">
    <div class="orbis-rp-header-brand">
      ${logo}
      <span>${esc(ctx.brand)}</span>
    </div>
    <div class="orbis-rp-header-meta">${esc(metaParts.join(" ｜ "))}</div>
  </div>`;
}

export function pageFooter(): string {
  return `<div class="orbis-rp-foot">由 Orbis SEO/GEO 生成</div>`;
}

export function wrapPage(
  body: string,
  opts?: { cover?: boolean; end?: boolean },
): string {
  const extra = opts?.cover ? " cover" : opts?.end ? " end" : "";
  return `<section class="orbis-rp${extra}">${body}</section>`;
}

export function coverPage(input: {
  brand: string;
  generatedOn: string;
  logoDataUrl?: string | null;
  pills: string[];
}): string {
  const logo = input.logoDataUrl
    ? `<img class="cover-logo" src="${esc(input.logoDataUrl)}" alt="" />`
    : "";
  return wrapPage(
    `
    ${logo}
    <div class="wordmark">Orbis<em>.GEO</em></div>
    <h1>${esc(input.brand)} 品牌报告</h1>
    <p class="muted">生成于 ${esc(input.generatedOn)}</p>
    <div class="divider">报告筛选条件</div>
    <div class="pills">
      ${input.pills.map((p) => `<span class="pill">${esc(p)}</span>`).join("")}
    </div>
  `,
    { cover: true },
  );
}

export function endPage(input: {
  brand: string;
  domain: string;
}): string {
  return wrapPage(
    `
    <p class="muted">${esc(input.domain || input.brand)}</p>
    <div class="wordmark">Orbis<em>.GEO</em></div>
    <h1>${esc(input.brand)} 品牌报告</h1>
    <p class="muted" style="margin-top:12px">由 Orbis SEO/GEO 生成</p>
  `,
    { end: true },
  );
}
