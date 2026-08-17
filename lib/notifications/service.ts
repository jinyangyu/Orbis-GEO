import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { AppDb } from "@/db";
import {
  notificationDeliveries,
  notificationEvents,
  notificationReads,
  workspaceSettings,
} from "@/db/schema";
import { assertWorkspaceMember } from "@/lib/auth/membership";
import { newUserId } from "@/lib/identity";
import { assertSafeOutboundUrl } from "@/lib/http/safe-url";
import type { OverviewAction } from "@/lib/metrics/types";
import { buildRecommendationsDigest } from "./digest";
import type { NotificationView } from "./types";

export type { NotificationView } from "./types";

async function ensureSettings(db: AppDb, workspaceId: string) {
  const [row] = await db
    .select()
    .from(workspaceSettings)
    .where(eq(workspaceSettings.workspaceId, workspaceId))
    .limit(1);
  if (row) return row;
  await db.insert(workspaceSettings).values({
    workspaceId,
    notifyNewRecommendations: 1,
    notifyWebhookUrl: "",
    lastRecsDigest: "",
  });
  const [created] = await db
    .select()
    .from(workspaceSettings)
    .where(eq(workspaceSettings.workspaceId, workspaceId))
    .limit(1);
  return created!;
}

async function deliverWebhook(
  db: AppDb,
  eventId: string,
  webhookUrl: string,
  payload: unknown,
) {
  const deliveryId = newUserId();
  try {
    assertSafeOutboundUrl(webhookUrl);
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    await db.insert(notificationDeliveries).values({
      id: deliveryId,
      eventId,
      channel: "webhook",
      status: res.ok ? "sent" : "failed",
      error: res.ok ? "" : `HTTP ${res.status}`.slice(0, 512),
    });
  } catch (e) {
    await db.insert(notificationDeliveries).values({
      id: deliveryId,
      eventId,
      channel: "webhook",
      status: "failed",
      error: (e instanceof Error ? e.message : "webhook error").slice(0, 512),
    });
  }
}

/**
 * Compare recommendations digest; create event + optional webhook when changed.
 * No-ops when webhook URL is empty (in-app event still created on change).
 */
export async function checkRecommendationsNotifications(
  db: AppDb,
  userId: string,
  workspaceId: string,
  actions: OverviewAction[],
): Promise<{ created: boolean; digest: string; eventId?: string }> {
  await assertWorkspaceMember(db, userId, workspaceId);

  const settings = await ensureSettings(db, workspaceId);
  if (settings.notifyNewRecommendations !== 1) {
    return { created: false, digest: buildRecommendationsDigest(actions) };
  }

  const digest = buildRecommendationsDigest(actions);
  if (!actions.length) {
    return { created: false, digest };
  }
  if (settings.lastRecsDigest && settings.lastRecsDigest === digest) {
    return { created: false, digest };
  }

  // First run: seed digest without notifying
  if (!settings.lastRecsDigest) {
    await db
      .update(workspaceSettings)
      .set({ lastRecsDigest: digest })
      .where(eq(workspaceSettings.workspaceId, workspaceId));
    return { created: false, digest };
  }

  const eventId = newUserId();
  const title = "优化建议已更新";
  const body = `检测到 ${actions.length} 条建议变更，请查看「建议」页。`;
  const payload = {
    kind: "recommendations",
    workspaceId,
    digest,
    actions: actions.slice(0, 10),
  };

  await db.insert(notificationEvents).values({
    id: eventId,
    workspaceId,
    kind: "recommendations",
    title,
    body,
    payloadJson: payload,
  });

  await db.insert(notificationDeliveries).values({
    id: newUserId(),
    eventId,
    channel: "in_app",
    status: "sent",
    error: "",
  });

  const webhook = (settings.notifyWebhookUrl || "").trim();
  if (webhook.startsWith("http://") || webhook.startsWith("https://")) {
    await deliverWebhook(db, eventId, webhook, {
      ...payload,
      title,
      body,
      time: new Date().toISOString(),
    });
  }

  await db
    .update(workspaceSettings)
    .set({ lastRecsDigest: digest })
    .where(eq(workspaceSettings.workspaceId, workspaceId));

  return { created: true, digest, eventId };
}

export async function listNotifications(
  db: AppDb,
  userId: string,
  workspaceId: string,
  limit = 20,
): Promise<{ items: NotificationView[]; unread: number }> {
  await assertWorkspaceMember(db, userId, workspaceId);
  const rows = await db
    .select()
    .from(notificationEvents)
    .where(eq(notificationEvents.workspaceId, workspaceId))
    .orderBy(desc(notificationEvents.createdAt))
    .limit(Math.min(50, Math.max(1, limit)));

  const ids = rows.map((r) => r.id);
  const readSet = new Set<string>();
  if (ids.length) {
    const reads = await db
      .select()
      .from(notificationReads)
      .where(
        and(
          eq(notificationReads.userId, userId),
          inArray(notificationReads.eventId, ids),
        ),
      );
    for (const r of reads) readSet.add(r.eventId);
  }

  const items: NotificationView[] = rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    createdAt: r.createdAt,
    read: readSet.has(r.id),
  }));

  const [unreadRow] = await db
    .select({ c: sql<number>`count(*)` })
    .from(notificationEvents)
    .leftJoin(
      notificationReads,
      and(
        eq(notificationReads.eventId, notificationEvents.id),
        eq(notificationReads.userId, userId),
      ),
    )
    .where(
      and(
        eq(notificationEvents.workspaceId, workspaceId),
        isNull(notificationReads.eventId),
      ),
    );

  const unread = Number(unreadRow?.c ?? items.filter((i) => !i.read).length);
  return {
    items,
    unread: Number.isFinite(unread) ? unread : items.filter((i) => !i.read).length,
  };
}

export async function markNotificationsRead(
  db: AppDb,
  userId: string,
  eventIds: string[],
): Promise<void> {
  const ids = [...new Set(eventIds.filter(Boolean))].slice(0, 50);
  if (!ids.length) return;

  const events = await db
    .select({
      id: notificationEvents.id,
      workspaceId: notificationEvents.workspaceId,
    })
    .from(notificationEvents)
    .where(inArray(notificationEvents.id, ids));

  const allowed = new Set<string>();
  for (const ev of events) {
    try {
      await assertWorkspaceMember(db, userId, ev.workspaceId);
      allowed.add(ev.id);
    } catch {
      /* skip events outside membership */
    }
  }

  for (const eventId of allowed) {
    const existing = await db
      .select()
      .from(notificationReads)
      .where(
        and(
          eq(notificationReads.userId, userId),
          eq(notificationReads.eventId, eventId),
        ),
      )
      .limit(1);
    if (!existing.length) {
      await db.insert(notificationReads).values({ userId, eventId });
    }
  }
}
