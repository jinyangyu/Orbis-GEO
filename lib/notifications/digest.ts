type DigestAction = {
  priority?: string;
  category?: string;
  title?: string;
  description?: string;
};

/** Stable digest of recommendation set (order-independent). */
export function buildRecommendationsDigest(
  actions: DigestAction[],
): string {
  const parts = actions
    .map((a) =>
      [a.priority, a.category, a.title, a.description]
        .map((x) => String(x ?? "").trim())
        .join("|"),
    )
    .sort();
  const raw = `recs_v1:${parts.join("\n")}`;
  return simpleHash(raw);
}

function simpleHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `r1_${(h >>> 0).toString(16).padStart(8, "0")}`;
}

/** Empty is ok (webhook disabled); otherwise must be http(s). */
export function isValidWebhookUrl(raw: string): boolean {
  const url = raw.trim();
  if (!url) return true;
  return url.startsWith("http://") || url.startsWith("https://");
}
