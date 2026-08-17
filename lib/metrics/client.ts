import { apiFetch } from "@/lib/auth/fetch";
import {
  authHeaders,
  getOrCreateClientUserId,
} from "@/lib/identity";
import type {
  BrandsMetrics,
  CitationsMetrics,
  OverviewMetrics,
  PromptDetailMetrics,
  PromptsMetrics,
  WorkspaceListItem,
} from "@/lib/metrics/types";
import type { WorkspacePayload } from "@/lib/onboarding/types";

const WS_KEY = "orbis_workspace_id";

function userHeaders(extra?: HeadersInit): HeadersInit {
  return {
    ...authHeaders(getOrCreateClientUserId()),
    ...extra,
  };
}

export function getStoredWorkspaceId(): string | null {
  try {
    return window.localStorage.getItem(WS_KEY);
  } catch {
    return null;
  }
}

export function setStoredWorkspaceId(id: string) {
  try {
    window.localStorage.setItem(WS_KEY, id);
  } catch {
    /* ignore */
  }
}

function qs(params: Record<string, string | number | null | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "" && v !== "undefined" && v !== "null") {
      sp.set(k, String(v));
    }
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export type MetricsFetchOpts = {
  engine?: string;
  days?: number;
  from?: string;
  to?: string;
  market?: string;
  signal?: AbortSignal;
};

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await apiFetch(url, {
    cache: "no-store",
    signal,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export {
  daysFromRangeLabel,
  engineFilterFromLabel,
  isAllEnginesLabel,
  isAllMarketsLabel,
  isAllTagsLabel,
} from "./filters";


export async function fetchMonitoringWorkspaces(
  signal?: AbortSignal,
): Promise<WorkspaceListItem[]> {
  const body = await getJson<{ items: WorkspaceListItem[] }>(
    "/api/workspaces",
    signal,
  );
  return body.items;
}

export async function fetchWorkspaceById(
  workspaceId: string,
  signal?: AbortSignal,
): Promise<WorkspacePayload | null> {
  const res = await apiFetch(`/api/workspace${qs({ workspaceId })}`, {
    cache: "no-store",
    signal,
  });
  if (res.status === 204) return null;
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Failed to load workspace (${res.status})`);
  }
  return (await res.json()) as WorkspacePayload;
}

export async function fetchOverviewMetrics(
  workspaceId: string,
  opts?: MetricsFetchOpts,
): Promise<OverviewMetrics> {
  return getJson(
    `/api/metrics/overview${qs({
      workspaceId,
      engine:
        opts?.engine && opts.engine !== "全部平台" ? opts.engine : undefined,
      days: opts?.days,
      from: opts?.from,
      to: opts?.to,
      market: opts?.market,
    })}`,
    opts?.signal,
  );
}

export async function fetchPromptsMetrics(
  workspaceId: string,
  opts?: MetricsFetchOpts & { q?: string; market?: string },
): Promise<PromptsMetrics> {
  return getJson(
    `/api/metrics/prompts${qs({
      workspaceId,
      q: opts?.q,
      market: opts?.market,
      engine:
        opts?.engine && opts.engine !== "全部平台" ? opts.engine : undefined,
      days: opts?.days,
      from: opts?.from,
      to: opts?.to,
    })}`,
    opts?.signal,
  );
}

export async function fetchPromptDetail(
  workspaceId: string,
  promptId: string,
  opts?: MetricsFetchOpts,
): Promise<PromptDetailMetrics> {
  return getJson(
    `/api/metrics/prompts/${encodeURIComponent(promptId)}${qs({
      workspaceId,
      days: opts?.days,
      from: opts?.from,
      to: opts?.to,
      engine:
        opts?.engine && opts.engine !== "全部平台" ? opts.engine : undefined,
    })}`,
    opts?.signal,
  );
}

export async function fetchCitationsMetrics(
  workspaceId: string,
  opts?: MetricsFetchOpts,
): Promise<CitationsMetrics> {
  return getJson(
    `/api/metrics/citations${qs({
      workspaceId,
      engine:
        opts?.engine && opts.engine !== "全部平台" ? opts.engine : undefined,
      days: opts?.days,
      from: opts?.from,
      to: opts?.to,
    })}`,
    opts?.signal,
  );
}

export async function fetchBrandsMetrics(
  workspaceId: string,
  opts?: MetricsFetchOpts,
): Promise<BrandsMetrics> {
  return getJson(
    `/api/metrics/brands${qs({
      workspaceId,
      engine:
        opts?.engine && opts.engine !== "全部平台" ? opts.engine : undefined,
      days: opts?.days,
      from: opts?.from,
      to: opts?.to,
    })}`,
    opts?.signal,
  );
}
