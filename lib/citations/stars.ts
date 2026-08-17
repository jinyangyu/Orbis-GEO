import { and, eq } from "drizzle-orm";
import type { AppDb } from "@/db";
import { citationStars } from "@/db/schema";
import { assertWorkspaceMember } from "@/lib/auth/membership";
import { newUserId } from "@/lib/identity";
import { normalizeCitationUrl } from "./url";

export { applyStarredFlag, normalizeCitationUrl } from "./url";

export async function listStarredUrls(
  db: AppDb,
  userId: string,
  workspaceId: string,
): Promise<string[]> {
  await assertWorkspaceMember(db, userId, workspaceId);
  const rows = await db
    .select({ url: citationStars.url })
    .from(citationStars)
    .where(
      and(
        eq(citationStars.workspaceId, workspaceId),
        eq(citationStars.userId, userId),
      ),
    );
  return rows.map((r) => r.url);
}

export async function starUrl(
  db: AppDb,
  userId: string,
  workspaceId: string,
  urlRaw: string,
): Promise<{ url: string; starred: true }> {
  await assertWorkspaceMember(db, userId, workspaceId);
  const url = normalizeCitationUrl(urlRaw);
  if (!url) throw new Error("URL 无效");

  const existing = await db
    .select({ id: citationStars.id })
    .from(citationStars)
    .where(
      and(
        eq(citationStars.workspaceId, workspaceId),
        eq(citationStars.userId, userId),
        eq(citationStars.url, url),
      ),
    )
    .limit(1);
  if (!existing.length) {
    await db.insert(citationStars).values({
      id: newUserId(),
      workspaceId,
      userId,
      url,
    });
  }
  return { url, starred: true };
}

export async function unstarUrl(
  db: AppDb,
  userId: string,
  workspaceId: string,
  urlRaw: string,
): Promise<{ url: string; starred: false }> {
  await assertWorkspaceMember(db, userId, workspaceId);
  const url = normalizeCitationUrl(urlRaw);
  if (!url) throw new Error("URL 无效");

  await db
    .delete(citationStars)
    .where(
      and(
        eq(citationStars.workspaceId, workspaceId),
        eq(citationStars.userId, userId),
        eq(citationStars.url, url),
      ),
    );
  return { url, starred: false };
}
