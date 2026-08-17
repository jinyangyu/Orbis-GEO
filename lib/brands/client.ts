import { apiFetch } from "@/lib/auth/fetch";
import {
  authHeaders,
  getOrCreateClientUserId,
} from "@/lib/identity";
import type { BrandRowView } from "./service";

function userHeaders(extra?: HeadersInit): HeadersInit {
  return {
    ...authHeaders(getOrCreateClientUserId()),
    ...extra,
  };
}

export async function fetchActiveBrands(workspaceId?: string) {
  const qs = workspaceId
    ? `?workspaceId=${encodeURIComponent(workspaceId)}`
    : "";
  const res = await apiFetch(`/api/brands${qs}`, {
    headers: userHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `加载品牌失败 (${res.status})`);
  }
  return (await res.json()) as {
    workspaceId: string;
    primary: BrandRowView | null;
    competitors: BrandRowView[];
  };
}

export async function fetchDetectedBrands(
  workspaceId?: string,
  page = 1,
  pageSize = 8,
) {
  const params = new URLSearchParams();
  if (workspaceId) params.set("workspaceId", workspaceId);
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  const res = await apiFetch(`/api/brands/detected?${params}`, {
    headers: userHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `加载已发现品牌失败 (${res.status})`);
  }
  return (await res.json()) as {
    items: BrandRowView[];
    total: number;
    page: number;
    pageSize: number;
  };
}

export async function acceptDetected(id: string) {
  const res = await apiFetch(`/api/brands/detected/${id}?action=accept`, {
    method: "POST",
    headers: userHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ action: "accept" }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "加入竞品失败");
  }
  return (await res.json()) as BrandRowView;
}

export async function dismissDetected(id: string) {
  const res = await apiFetch(`/api/brands/detected/${id}?action=dismiss`, {
    method: "POST",
    headers: userHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ action: "dismiss" }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "忽略失败");
  }
  return (await res.json()) as BrandRowView;
}

export async function patchBrand(
  id: string,
  patch: Partial<{
    name: string;
    domain: string;
    aliases: string[];
    domainAliases: string[];
    includeSubdomains: boolean;
    market: string;
    language: string;
    mark: string;
    color: string;
  }>,
) {
  const res = await apiFetch(`/api/brands/${id}`, {
    method: "PATCH",
    headers: userHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "保存失败");
  }
  return (await res.json()) as BrandRowView;
}

export async function createBrandCompetitor(
  workspaceId: string | undefined,
  input: { name: string; domain?: string },
) {
  const res = await apiFetch("/api/brands", {
    method: "POST",
    headers: userHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ workspaceId, ...input }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "新增竞品失败");
  }
  return (await res.json()) as BrandRowView;
}

export async function removeBrandCompetitor(id: string) {
  const res = await apiFetch(`/api/brands/${id}`, {
    method: "DELETE",
    headers: userHeaders(),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "删除失败");
  }
}
