import { apiFetch } from "@/lib/auth/fetch";
import {
  ORBIS_USER_ID_KEY,
  authHeaders,
  getOrCreateClientUserId,
} from "@/lib/identity";
import type { OnboardingState, WorkspacePayload } from "@/lib/onboarding/types";

export { ORBIS_USER_ID_KEY };

function userHeaders(extra?: HeadersInit): HeadersInit {
  const userId = getOrCreateClientUserId();
  return {
    ...authHeaders(userId),
    ...extra,
  };
}

export async function fetchOnboardingDraft(): Promise<OnboardingState | null> {
  const res = await apiFetch("/api/onboarding", {
    headers: userHeaders(),
    cache: "no-store",
  });
  if (res.status === 204) return null;
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Failed to load draft (${res.status})`);
  }
  const body = (await res.json()) as { draft: OnboardingState };
  return body.draft;
}

export async function saveOnboardingDraft(state: OnboardingState): Promise<void> {
  const res = await apiFetch("/api/onboarding", {
    method: "PUT",
    headers: userHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(state),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Failed to save draft (${res.status})`);
  }
}

export async function completeOnboardingRemote(
  state: OnboardingState,
): Promise<{ workspaceId: string }> {
  const res = await apiFetch("/api/onboarding/complete", {
    method: "POST",
    headers: userHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(state),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Failed to complete onboarding (${res.status})`);
  }
  return (await res.json()) as { workspaceId: string };
}

export async function resetOnboardingRemote(): Promise<void> {
  const res = await apiFetch("/api/onboarding/reset", {
    method: "POST",
    headers: userHeaders(),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Failed to reset onboarding (${res.status})`);
  }
}

export async function fetchWorkspace(): Promise<WorkspacePayload | null> {
  const res = await apiFetch("/api/workspace", {
    headers: userHeaders(),
    cache: "no-store",
  });
  if (res.status === 204) return null;
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Failed to load workspace (${res.status})`);
  }
  return (await res.json()) as WorkspacePayload;
}
