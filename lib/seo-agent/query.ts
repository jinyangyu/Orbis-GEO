import type { ArticleListQuery } from "./types";

/** Build query string for Agent GET /api/orbis/articles (and Orbis BFF). */
export function buildArticleListSearchParams(query: ArticleListQuery): URLSearchParams {
  const params = new URLSearchParams();
  const set = (key: keyof ArticleListQuery, value: string | number | undefined) => {
    if (value === undefined || value === null) return;
    const s = String(value).trim();
    if (!s) return;
    params.set(key, s);
  };
  set("site", query.site);
  set("market", query.market);
  set("status", query.status);
  set("owner_id", query.owner_id);
  set("q", query.q);
  if (query.page !== undefined && query.page > 0) {
    params.set("page", String(query.page));
  }
  if (query.page_size !== undefined && query.page_size > 0) {
    params.set("page_size", String(query.page_size));
  }
  return params;
}

export function agentArticlesURL(baseURL: string, query: ArticleListQuery): string {
  const base = baseURL.replace(/\/+$/, "");
  const qs = buildArticleListSearchParams(query).toString();
  return qs ? `${base}/api/orbis/articles?${qs}` : `${base}/api/orbis/articles`;
}
