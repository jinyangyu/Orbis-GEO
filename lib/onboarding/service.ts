import { and, asc, eq, isNull } from "drizzle-orm";
import type { AppDb } from "@/db";
import {
  onboardingSessions,
  prompts,
  users,
  workspaceBrands,
  workspaceMembers,
  workspaces,
} from "@/db/schema";
import { newUserId } from "@/lib/identity";
import { buildWorkspaceSlug } from "@/lib/workspace/slug";
import type { OnboardingState, WorkspacePayload } from "./types";
import { isValidOnboardingState } from "./validate";

/** MySQL DATETIME(3) expects `YYYY-MM-DD HH:mm:ss.sss` (no T/Z). */
function toMysqlDateTime(value?: string | null): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return toMysqlDateTime(null);
  }
  return date.toISOString().replace("T", " ").replace("Z", "").slice(0, 23);
}

function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .replace(/:\d+$/, "");
}

async function ensureUser(db: AppDb, userId: string, state?: OnboardingState) {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (existing.length > 0) {
    if (state) {
      await db
        .update(users)
        .set({
          firstName: state.profile.firstName.trim(),
          lastName: state.profile.lastName.trim(),
          role: state.profile.role,
          source: state.profile.source.trim(),
        })
        .where(eq(users.id, userId));
    }
    return;
  }

  await db.insert(users).values({
    id: userId,
    firstName: state?.profile.firstName.trim() ?? "",
    lastName: state?.profile.lastName.trim() ?? "",
    role: state?.profile.role ?? "brand",
    source: state?.profile.source.trim() ?? "",
  });
}

export async function getDraftSession(db: AppDb, userId: string) {
  const rows = await db
    .select()
    .from(onboardingSessions)
    .where(
      and(
        eq(onboardingSessions.userId, userId),
        isNull(onboardingSessions.completedAt),
      ),
    )
    .orderBy(asc(onboardingSessions.createdAt))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (!isValidOnboardingState(row.draftJson)) return null;
  return { sessionId: row.id, draft: row.draftJson };
}

export async function upsertDraft(
  db: AppDb,
  userId: string,
  state: OnboardingState,
) {
  await ensureUser(db, userId, state);

  const existing = await db
    .select({ id: onboardingSessions.id })
    .from(onboardingSessions)
    .where(
      and(
        eq(onboardingSessions.userId, userId),
        isNull(onboardingSessions.completedAt),
      ),
    )
    .limit(1);

  const payload = {
    version: 1 as const,
    screen: state.screen,
    processingIndex: state.processingIndex,
    tourIndex: state.tourIndex,
    draftJson: state,
  };

  if (existing[0]) {
    await db
      .update(onboardingSessions)
      .set(payload)
      .where(eq(onboardingSessions.id, existing[0].id));
    return { sessionId: existing[0].id };
  }

  const sessionId = newUserId();
  await db.insert(onboardingSessions).values({
    id: sessionId,
    userId,
    ...payload,
  });
  return { sessionId };
}

export async function resetDraft(db: AppDb, userId: string) {
  const drafts = await db
    .select({ id: onboardingSessions.id })
    .from(onboardingSessions)
    .where(
      and(
        eq(onboardingSessions.userId, userId),
        isNull(onboardingSessions.completedAt),
      ),
    );

  for (const draft of drafts) {
    await db
      .delete(onboardingSessions)
      .where(eq(onboardingSessions.id, draft.id));
  }

  return { deleted: drafts.length };
}

export async function completeOnboarding(
  db: AppDb,
  userId: string,
  state: OnboardingState,
) {
  await ensureUser(db, userId, state);

  const completedAt = toMysqlDateTime(state.completedAt);
  const selectedPrompts = state.prompts.filter((p) => p.selected && p.text.trim());
  const competitorRows = state.competitors.filter(
    (c) => c.name.trim() && c.domain.trim(),
  );
  const primaryDomain = normalizeDomain(state.brand.website);
  const market = state.brand.market.trim();

  const workspaceId = await db.transaction(async (tx) => {
    const existingWs = await tx
      .select()
      .from(workspaces)
      .where(eq(workspaces.ownerUserId, userId))
      .limit(1);

    const wsId = existingWs[0]?.id ?? newUserId();
    const slugBase = buildWorkspaceSlug({
      website: state.brand.website,
      name: state.brand.name,
      fallbackId: wsId,
    });
    const slug = existingWs[0]?.slug ?? slugBase;

    if (existingWs[0]) {
      await tx
        .update(workspaces)
        .set({
          name: state.brand.name.trim(),
          reportTitle: state.brand.name.trim(),
          onboardingCompletedAt: completedAt,
        })
        .where(eq(workspaces.id, wsId));
    } else {
      await tx.insert(workspaces).values({
        id: wsId,
        ownerUserId: userId,
        name: state.brand.name.trim(),
        reportTitle: state.brand.name.trim(),
        slug,
        onboardingCompletedAt: completedAt,
      });
    }

    const [existingMember] = await tx
      .select({ userId: workspaceMembers.userId })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, wsId),
          eq(workspaceMembers.userId, userId),
        ),
      )
      .limit(1);
    if (!existingMember) {
      await tx.insert(workspaceMembers).values({
        workspaceId: wsId,
        userId,
        role: "owner",
      });
    }

    await tx.delete(workspaceBrands).where(eq(workspaceBrands.workspaceId, wsId));

    const brandRows = [
      {
        id: newUserId(),
        workspaceId: wsId,
        name: state.brand.name.trim(),
        domain: primaryDomain || normalizeDomain(state.brand.name),
        role: "primary" as const,
        status: "active" as const,
        detectedFrom: "",
        aliases: [] as string[],
        market,
        language: state.brand.language.trim(),
        mark: (state.brand.name.trim().slice(0, 1) || "?").toUpperCase(),
        color: "#5b68ef",
        sortOrder: 0,
      },
      ...competitorRows.map((item, index) => ({
        id: newUserId(),
        workspaceId: wsId,
        name: item.name.trim(),
        domain: normalizeDomain(item.domain),
        role: "competitor" as const,
        status: "active" as const,
        detectedFrom: "",
        aliases: [] as string[],
        market: "",
        language: "",
        mark: (item.mark || item.name.slice(0, 1) || "?").slice(0, 8),
        color: item.color || "#5366ea",
        sortOrder: index + 1,
      })),
    ];

    // Avoid UNIQUE(workspace, domain) clash if competitor domain equals primary.
    const seenDomains = new Set<string>();
    const dedupedBrands = brandRows.filter((row) => {
      const key = row.domain || row.id;
      if (seenDomains.has(key)) return false;
      seenDomains.add(key);
      return true;
    });
    await tx.insert(workspaceBrands).values(dedupedBrands);

    await tx.delete(prompts).where(eq(prompts.workspaceId, wsId));
    if (selectedPrompts.length > 0) {
      await tx.insert(prompts).values(
        selectedPrompts.map((item, index) => ({
          id: newUserId(),
          workspaceId: wsId,
          text: item.text.trim(),
          sortOrder: index,
          source: "onboarding",
          isActive: 1,
          market,
          tags: [],
          intentVolume: null,
        })),
      );
    }

    const draft = await tx
      .select({ id: onboardingSessions.id })
      .from(onboardingSessions)
      .where(
        and(
          eq(onboardingSessions.userId, userId),
          isNull(onboardingSessions.completedAt),
        ),
      )
      .limit(1);

    const finalState: OnboardingState = {
      ...state,
      completedAt,
    };

    if (draft[0]) {
      await tx
        .update(onboardingSessions)
        .set({
          screen: "ready",
          processingIndex: state.processingIndex,
          tourIndex: state.tourIndex,
          draftJson: finalState,
          completedAt,
        })
        .where(eq(onboardingSessions.id, draft[0].id));
    } else {
      await tx.insert(onboardingSessions).values({
        id: newUserId(),
        userId,
        version: 1,
        screen: "ready",
        processingIndex: state.processingIndex,
        tourIndex: state.tourIndex,
        draftJson: finalState,
        completedAt,
      });
    }

    return wsId;
  });

  return { workspaceId };
}

export async function getWorkspaceForUser(
  db: AppDb,
  userId: string,
): Promise<WorkspacePayload | null> {
  const wsRows = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerUserId, userId))
    .limit(1);

  const workspace = wsRows[0];
  if (!workspace) return null;
  return getWorkspacePayload(db, workspace.id, userId);
}

export async function getWorkspaceById(
  db: AppDb,
  workspaceId: string,
): Promise<WorkspacePayload | null> {
  const wsRows = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  const workspace = wsRows[0];
  if (!workspace) return null;
  return getWorkspacePayload(db, workspace.id, workspace.ownerUserId);
}

async function getWorkspacePayload(
  db: AppDb,
  workspaceId: string,
  profileUserId: string,
): Promise<WorkspacePayload | null> {
  const wsRows = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  const workspace = wsRows[0];
  if (!workspace) return null;

  const [userRow] = await db
    .select()
    .from(users)
    .where(eq(users.id, profileUserId))
    .limit(1);

  const brandRows = await db
    .select()
    .from(workspaceBrands)
    .where(eq(workspaceBrands.workspaceId, workspace.id))
    .orderBy(asc(workspaceBrands.sortOrder));

  const primary = brandRows.find((row) => row.role === "primary") ?? null;
  const competitorRows = brandRows.filter(
    (row) => row.role === "competitor" && row.status === "active",
  );

  const promptRows = await db
    .select()
    .from(prompts)
    .where(eq(prompts.workspaceId, workspace.id))
    .orderBy(asc(prompts.sortOrder));

  return {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      reportTitle:
        (workspace.reportTitle || "").trim() ||
        primary?.name ||
        workspace.name ||
        "",
      slug: workspace.slug,
      onboardingCompletedAt: workspace.onboardingCompletedAt,
    },
    brand: primary
      ? {
          id: primary.id,
          name: primary.name,
          website: primary.domain,
          market: primary.market,
          language: primary.language,
        }
      : null,
    prompts: promptRows.map((row) => ({
      id: row.id,
      text: row.text,
      sortOrder: row.sortOrder,
      isActive: row.isActive === 1,
    })),
    competitors: competitorRows.map((row) => ({
      id: row.id,
      name: row.name,
      domain: row.domain,
      mark: row.mark,
      color: row.color,
      sortOrder: row.sortOrder,
    })),
    profile: userRow
      ? {
          firstName: userRow.firstName,
          lastName: userRow.lastName,
          role: userRow.role,
          source: userRow.source,
        }
      : null,
  };
}
