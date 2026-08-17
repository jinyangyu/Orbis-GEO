/** Normalize URL for stable starring (trim, drop trailing slash except root). */
export function normalizeCitationUrl(raw: string): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  try {
    const u = new URL(s);
    u.hash = "";
    let path = u.pathname;
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    u.pathname = path || "/";
    return u.toString();
  } catch {
    return s.replace(/\s+/g, "").replace(/\/+$/, "") || s;
  }
}

/** Mark CitedUrlRow-like objects with starred flag. */
export function applyStarredFlag<T extends { url: string }>(
  rows: T[],
  starredSet: Set<string>,
): Array<T & { starred: boolean }> {
  return rows.map((r) => ({
    ...r,
    starred:
      starredSet.has(r.url) || starredSet.has(normalizeCitationUrl(r.url)),
  }));
}
