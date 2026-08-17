import { apiFetch } from "@/lib/auth/fetch";
import {
  authHeaders,
  getOrCreateClientUserId,
} from "@/lib/identity";
import type { OverviewAction } from "@/lib/metrics/types";
import type { NotificationView } from "./types";

function userHeaders(extra?: HeadersInit): HeadersInit {
  return {
    ...authHeaders(getOrCreateClientUserId()),
    ...extra,
  };
}

export async function fetchNotifications(workspaceId: string, limit = 20) {
  const qs = new URLSearchParams({
    workspaceId,
    limit: String(limit),
  });
  const res = await apiFetch(`/api/notifications?${qs}`, {
    headers: userHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `加载通知失败 (${res.status})`);
  }
  return (await res.json()) as { items: NotificationView[]; unread: number };
}

export async function markNotificationsReadClient(eventIds: string[]) {
  const res = await apiFetch("/api/notifications/read", {
    method: "POST",
    headers: userHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ eventIds }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "标记已读失败");
  }
  return (await res.json()) as { ok: boolean };
}

export async function checkNotificationsClient(
  workspaceId: string,
  actions: OverviewAction[],
) {
  const res = await apiFetch("/api/notifications/check", {
    method: "POST",
    headers: userHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ workspaceId, actions }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "检查通知失败");
  }
  return (await res.json()) as {
    created: boolean;
    digest?: string;
    skipped?: boolean;
    eventId?: string;
  };
}
