import {
  authHeaders,
  getOrCreateClientUserId,
} from "@/lib/identity";
import type { PromptResearchJobView, PromptResearchInput } from "./types";

function userHeaders(extra?: HeadersInit): HeadersInit {
  return {
    ...authHeaders(getOrCreateClientUserId()),
    ...extra,
  };
}

export async function startPromptResearch(
  input: PromptResearchInput,
): Promise<PromptResearchJobView> {
  const res = await fetch("/api/prompt-research", {
    method: "POST",
    headers: userHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(input),
  });
  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
  } & Partial<PromptResearchJobView>;
  if (!res.ok) {
    throw new Error(body.error ?? `研究失败 (${res.status})`);
  }
  return body as PromptResearchJobView;
}

export async function fetchLatestPromptResearch(
  workspaceId?: string,
): Promise<PromptResearchJobView | null> {
  const qs = workspaceId
    ? `?workspaceId=${encodeURIComponent(workspaceId)}`
    : "";
  const res = await fetch(`/api/prompt-research${qs}`, {
    headers: userHeaders(),
    cache: "no-store",
  });
  if (res.status === 204) return null;
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `加载失败 (${res.status})`);
  }
  return (await res.json()) as PromptResearchJobView;
}

export async function appendMonitoringPrompts(payload: {
  workspaceId?: string;
  texts: string[];
  market?: string;
  intentByText?: Record<string, string>;
}): Promise<{ added: number; skipped: number; ids: string[] }> {
  const res = await fetch("/api/prompts", {
    method: "POST",
    headers: userHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    added?: number;
    skipped?: number;
    ids?: string[];
  };
  if (!res.ok) {
    throw new Error(body.error ?? `加入监测失败 (${res.status})`);
  }
  return {
    added: body.added ?? 0,
    skipped: body.skipped ?? 0,
    ids: body.ids ?? [],
  };
}
