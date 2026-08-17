import { apiFetch } from "@/lib/auth/fetch";
import {
  authHeaders,
  getOrCreateClientUserId,
} from "@/lib/identity";
import type {
  BrandSettingsPayload,
  SettingsPromptView,
} from "./service";

function userHeaders(extra?: HeadersInit): HeadersInit {
  return {
    ...authHeaders(getOrCreateClientUserId()),
    ...extra,
  };
}

export async function fetchBrandSettings(workspaceId?: string) {
  const qs = workspaceId
    ? `?workspaceId=${encodeURIComponent(workspaceId)}`
    : "";
  const res = await apiFetch(`/api/brand-settings${qs}`, {
    headers: userHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `加载品牌设置失败 (${res.status})`);
  }
  return (await res.json()) as BrandSettingsPayload;
}

export async function patchBrandSettingsClient(
  workspaceId: string | undefined,
  patch: {
    reportTitle?: string;
    brandName?: string;
    brandDomain?: string;
    aliases?: string[];
    domainAliases?: string[];
    includeSubdomains?: boolean;
    notifyNewRecommendations?: boolean;
    notifyWebhookUrl?: string;
  },
) {
  const res = await apiFetch("/api/brand-settings", {
    method: "PATCH",
    headers: userHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ workspaceId, ...patch }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "保存失败");
  }
  return (await res.json()) as BrandSettingsPayload;
}

export type SettingsPromptsPage = {
  items: SettingsPromptView[];
  total: number;
  page: number;
  pageSize: number;
  markets: string[];
  tags: string[];
};

export async function fetchSettingsPrompts(
  workspaceId: string | undefined,
  opts: {
    q?: string;
    market?: string;
    tag?: string;
    pane?: "inactive" | "active";
    page?: number;
    pageSize?: number;
  } = {},
) {
  const params = new URLSearchParams();
  if (workspaceId) params.set("workspaceId", workspaceId);
  if (opts.q) params.set("q", opts.q);
  if (opts.market) params.set("market", opts.market);
  if (opts.tag) params.set("tag", opts.tag);
  params.set("pane", opts.pane === "inactive" ? "inactive" : "active");
  if (opts.page) params.set("page", String(opts.page));
  if (opts.pageSize) params.set("pageSize", String(opts.pageSize));
  const res = await apiFetch(`/api/brand-settings/prompts?${params}`, {
    headers: userHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `加载 Prompt 失败 (${res.status})`);
  }
  return (await res.json()) as SettingsPromptsPage;
}

export async function savePromptMembership(
  workspaceId: string | undefined,
  activateIds: string[],
  deactivateIds: string[],
) {
  const res = await apiFetch("/api/brand-settings/prompts", {
    method: "PATCH",
    headers: userHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ workspaceId, activateIds, deactivateIds }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "保存监测 Prompt 失败");
  }
  return (await res.json()) as { activated: number; deactivated: number };
}
