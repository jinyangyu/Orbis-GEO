import type { AppDb } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isUuid } from "@/lib/identity";

/** Ensure a users row exists for the session subject (bootstrap / onboarding). */
export async function ensureUserRow(db: AppDb, userId: string): Promise<void> {
  if (!isUuid(userId)) throw new Error("Invalid user id");
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (existing.length) return;
  await db.insert(users).values({
    id: userId,
    firstName: "",
    lastName: "",
    role: "brand",
    source: "session",
  });
}
