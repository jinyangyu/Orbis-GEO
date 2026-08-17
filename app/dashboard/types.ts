export const PAGE_KEYS = [
  "overview",
  "prompts",
  "citations",
  "recommendations",
  "research",
  "reports",
  "content",
  "brand-settings",
  "billing",
] as const;

export type PageKey = (typeof PAGE_KEYS)[number];

export const LEAF_PAGES: PageKey[] = ["brand-settings", "billing"];

export function isPageKey(value: string): value is PageKey {
  return (PAGE_KEYS as readonly string[]).includes(value);
}

/** Overview is `/`; other workbench views use a hash so the browser back button works. */
export function workbenchHref(page: PageKey): string {
  return page === "overview" ? "/" : `/#${page}`;
}

export function pageFromHash(hash: string): PageKey {
  const id = hash.startsWith("#") ? hash.slice(1) : hash;
  return isPageKey(id) ? id : "overview";
}
