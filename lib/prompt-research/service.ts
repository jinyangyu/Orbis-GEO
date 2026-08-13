import { desc, eq, max } from "drizzle-orm";
import type { AppDb } from "@/db";
import { promptResearchJobs, prompts, workspaces } from "@/db/schema";
import { newUserId } from "@/lib/identity";
import { generateResearchPrompts } from "./generate";
import type {
  PromptResearchInput,
  PromptResearchJobView,
  PromptResearchResult,
} from "./types";

async function assertWorkspaceAccess(
  db: AppDb,
  userId: string,
  workspaceId: string,
): Promise<void> {
  const rows = await db
    .select({ id: workspaces.id, ownerUserId: workspaces.ownerUserId })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  if (!rows[0] || rows[0].ownerUserId !== userId) {
    throw new Error("Workspace not found or access denied");
  }
}

function mapJob(row: typeof promptResearchJobs.$inferSelect): PromptResearchJobView {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    mode: row.mode,
    status: row.status,
    input: row.inputJson as PromptResearchInput,
    result: (row.resultJson as PromptResearchResult | null) ?? null,
    error: row.error,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function runPromptResearch(
  db: AppDb,
  userId: string,
  input: PromptResearchInput,
  workspaceId: string,
): Promise<PromptResearchJobView> {
  await assertWorkspaceAccess(db, userId, workspaceId);

  const id = newUserId();
  await db.insert(promptResearchJobs).values({
    id,
    workspaceId,
    userId,
    mode: input.mode,
    inputJson: input,
    status: "running",
    resultJson: null,
    error: null,
  });

  try {
    const result = await generateResearchPrompts(input);
    await db
      .update(promptResearchJobs)
      .set({
        status: "succeeded",
        resultJson: result,
        error: null,
      })
      .where(eq(promptResearchJobs.id, id));

    const rows = await db
      .select()
      .from(promptResearchJobs)
      .where(eq(promptResearchJobs.id, id))
      .limit(1);
    return mapJob(rows[0]!);
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成失败";
    await db
      .update(promptResearchJobs)
      .set({ status: "failed", error: message })
      .where(eq(promptResearchJobs.id, id));
    const rows = await db
      .select()
      .from(promptResearchJobs)
      .where(eq(promptResearchJobs.id, id))
      .limit(1);
    return mapJob(rows[0]!);
  }
}

export async function getPromptResearchJob(
  db: AppDb,
  userId: string,
  jobId: string,
): Promise<PromptResearchJobView | null> {
  const rows = await db
    .select()
    .from(promptResearchJobs)
    .where(eq(promptResearchJobs.id, jobId))
    .limit(1);
  if (!rows[0]) return null;
  await assertWorkspaceAccess(db, userId, rows[0].workspaceId);
  return mapJob(rows[0]);
}

export async function getLatestPromptResearchJob(
  db: AppDb,
  userId: string,
  workspaceId: string,
): Promise<PromptResearchJobView | null> {
  await assertWorkspaceAccess(db, userId, workspaceId);
  const rows = await db
    .select()
    .from(promptResearchJobs)
    .where(eq(promptResearchJobs.workspaceId, workspaceId))
    .orderBy(desc(promptResearchJobs.createdAt))
    .limit(1);
  return rows[0] ? mapJob(rows[0]) : null;
}

export async function appendPromptsFromResearch(
  db: AppDb,
  userId: string,
  workspaceId: string,
  texts: string[],
  market: string,
  intentByText?: Record<string, string>,
): Promise<{ added: number; skipped: number; ids: string[] }> {
  await assertWorkspaceAccess(db, userId, workspaceId);

  const cleaned = [
    ...new Set(
      texts.map((t) => t.trim()).filter((t) => t.length > 0 && t.length < 2000),
    ),
  ];
  if (!cleaned.length) {
    return { added: 0, skipped: 0, ids: [] };
  }

  const existing = await db
    .select({ id: prompts.id, text: prompts.text })
    .from(prompts)
    .where(eq(prompts.workspaceId, workspaceId));
  const existingSet = new Set(existing.map((r) => r.text.trim().toLowerCase()));

  const toInsert = cleaned.filter((t) => !existingSet.has(t.toLowerCase()));
  const skipped = cleaned.length - toInsert.length;

  const maxSort = await db
    .select({ m: max(prompts.sortOrder) })
    .from(prompts)
    .where(eq(prompts.workspaceId, workspaceId));
  let sort = (maxSort[0]?.m ?? -1) + 1;

  const ids: string[] = [];
  if (toInsert.length) {
    const values = toInsert.map((text) => {
      const id = newUserId();
      ids.push(id);
      const intent = intentByText?.[text];
      return {
        id,
        workspaceId,
        text,
        sortOrder: sort++,
        source: "research",
        isActive: 1 as const,
        market: market || "",
        tags: [] as string[],
        intentVolume: intent ?? null,
      };
    });
    await db.insert(prompts).values(values);
  }

  return { added: toInsert.length, skipped, ids };
}
