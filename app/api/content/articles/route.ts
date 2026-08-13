import { agentArticlesURL } from "../../../../lib/seo-agent/query";
import type { ArticleListQuery, ArticleListResponse } from "../../../../lib/seo-agent/types";

function readQuery(request: Request): ArticleListQuery {
  const url = new URL(request.url);
  const num = (key: string) => {
    const raw = url.searchParams.get(key);
    if (!raw) return undefined;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    site: url.searchParams.get("site") ?? undefined,
    market: url.searchParams.get("market") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    owner_id: url.searchParams.get("owner_id") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    page: num("page"),
    page_size: num("page_size"),
  };
}

export async function GET(request: Request) {
  const base = (process.env.SEO_AGENT_BASE_URL ?? "").trim();
  if (!base) {
    return Response.json(
      { error: "SEO_AGENT_BASE_URL is not configured" },
      { status: 503 },
    );
  }

  const query = readQuery(request);
  const upstream = agentArticlesURL(base, query);

  try {
    const res = await fetch(upstream, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const text = await res.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      return Response.json(
        { error: `seo-generator-agent returned non-JSON (${res.status})` },
        { status: 502 },
      );
    }
    if (!res.ok) {
      const errMsg =
        typeof body === "object" && body && "error" in body
          ? String((body as { error: unknown }).error)
          : `seo-generator-agent error (${res.status})`;
      return Response.json({ error: errMsg }, { status: res.status >= 500 ? 502 : res.status });
    }
    return Response.json(body as ArticleListResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "upstream fetch failed";
    return Response.json({ error: message }, { status: 502 });
  }
}
