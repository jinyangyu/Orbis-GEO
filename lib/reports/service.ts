import { and, desc, eq } from "drizzle-orm";
import type { AppDb } from "@/db";
import { reportExports } from "@/db/schema";
import { assertWorkspaceMember } from "@/lib/auth/membership";
import { newUserId } from "@/lib/identity";
import {
  serializeReportFilters,
  type ReportFiltersPayload,
} from "./filters";
import {
  deleteReportPdf,
  getReportPdf,
  isStoredFilePath,
  putReportPdf,
} from "./storage";

export type { ReportFiltersPayload };
export { serializeReportFilters };

export type ReportExportView = {
  id: string;
  workspaceId: string;
  title: string;
  kind: string;
  filters: ReportFiltersPayload;
  filePath: string | null;
  generatedAt: string;
  /** True when server holds a downloadable PDF object. */
  downloadable: boolean;
};

function rowToView(row: typeof reportExports.$inferSelect): ReportExportView {
  const filters =
    row.filtersJson && typeof row.filtersJson === "object"
      ? (row.filtersJson as ReportFiltersPayload)
      : {};
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    title: row.title,
    kind: row.kind,
    filters: serializeReportFilters(filters),
    filePath: row.filePath,
    generatedAt: row.generatedAt,
    downloadable: isStoredFilePath(row.filePath),
  };
}

export async function createExport(
  db: AppDb,
  userId: string,
  input: {
    workspaceId: string;
    title: string;
    kind?: string;
    filters: ReportFiltersPayload;
    filePath?: string | null;
    generatedAt?: string;
  },
): Promise<ReportExportView> {
  await assertWorkspaceMember(db, userId, input.workspaceId);
  const id = newUserId();
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const filters = serializeReportFilters(input.filters);
  await db.insert(reportExports).values({
    id,
    workspaceId: input.workspaceId,
    title: (input.title || "品牌报告").slice(0, 255),
    kind: input.kind || "overview",
    filtersJson: filters,
    filePath: input.filePath ?? null,
    generatedAt,
  });
  const [row] = await db
    .select()
    .from(reportExports)
    .where(eq(reportExports.id, id))
    .limit(1);
  if (!row) throw new Error("Failed to create report export");
  return rowToView(row);
}

export async function attachExportFile(
  db: AppDb,
  userId: string,
  workspaceId: string,
  exportId: string,
  pdfBytes: Uint8Array,
): Promise<ReportExportView> {
  await assertWorkspaceMember(db, userId, workspaceId);
  const [row] = await db
    .select()
    .from(reportExports)
    .where(
      and(
        eq(reportExports.id, exportId),
        eq(reportExports.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!row) throw new Error("Workspace not found or access denied");

  if (isStoredFilePath(row.filePath)) {
    await deleteReportPdf(row.filePath);
  }

  const stored = await putReportPdf(workspaceId, exportId, pdfBytes);
  await db
    .update(reportExports)
    .set({ filePath: stored.filePath })
    .where(eq(reportExports.id, exportId));

  const [updated] = await db
    .select()
    .from(reportExports)
    .where(eq(reportExports.id, exportId))
    .limit(1);
  if (!updated) throw new Error("Failed to attach report file");
  return rowToView(updated);
}

export async function getExportFile(
  db: AppDb,
  userId: string,
  workspaceId: string,
  exportId: string,
): Promise<{
  title: string;
  bytes: Uint8Array;
  contentType: string;
} | null> {
  await assertWorkspaceMember(db, userId, workspaceId);
  const [row] = await db
    .select()
    .from(reportExports)
    .where(
      and(
        eq(reportExports.id, exportId),
        eq(reportExports.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!row || !isStoredFilePath(row.filePath)) return null;
  const file = await getReportPdf(row.filePath!);
  if (!file) return null;
  return {
    title: row.title || "品牌报告",
    bytes: file.bytes,
    contentType: file.contentType,
  };
}

export async function listExports(
  db: AppDb,
  userId: string,
  workspaceId: string,
  limit = 50,
): Promise<ReportExportView[]> {
  await assertWorkspaceMember(db, userId, workspaceId);
  const rows = await db
    .select()
    .from(reportExports)
    .where(eq(reportExports.workspaceId, workspaceId))
    .orderBy(desc(reportExports.generatedAt))
    .limit(Math.min(100, Math.max(1, limit)));
  return rows.map(rowToView);
}

export async function deleteExport(
  db: AppDb,
  userId: string,
  workspaceId: string,
  exportId: string,
): Promise<void> {
  await assertWorkspaceMember(db, userId, workspaceId);
  const [row] = await db
    .select()
    .from(reportExports)
    .where(
      and(
        eq(reportExports.id, exportId),
        eq(reportExports.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (row?.filePath) {
    await deleteReportPdf(row.filePath);
  }
  await db
    .delete(reportExports)
    .where(
      and(
        eq(reportExports.id, exportId),
        eq(reportExports.workspaceId, workspaceId),
      ),
    );
}
