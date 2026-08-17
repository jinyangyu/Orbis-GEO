import { apiFetch } from "@/lib/auth/fetch";
import {
  authHeaders,
  getOrCreateClientUserId,
} from "@/lib/identity";
import type {
  ReportExportView,
  ReportFiltersPayload,
} from "@/lib/reports/service";

function headers(): HeadersInit {
  return {
    ...authHeaders(getOrCreateClientUserId()),
    "content-type": "application/json",
  };
}

export type { ReportExportView, ReportFiltersPayload };

export async function fetchReportExports(
  workspaceId: string,
): Promise<ReportExportView[]> {
  const res = await apiFetch(`/api/reports?workspaceId=${encodeURIComponent(workspaceId)}`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "加载报告列表失败");
  }
  const body = (await res.json()) as { items: ReportExportView[] };
  return body.items ?? [];
}

export async function registerReportExport(input: {
  workspaceId: string;
  title: string;
  kind?: string;
  filters: ReportFiltersPayload;
  filePath?: string | null;
}): Promise<ReportExportView | null> {
  try {
    const res = await apiFetch("/api/reports", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    return (await res.json()) as ReportExportView;
  } catch {
    return null;
  }
}

/** Upload generated PDF to server object storage for later download. */
export async function uploadReportPdfFile(
  workspaceId: string,
  exportId: string,
  blob: Blob,
): Promise<ReportExportView | null> {
  try {
    const res = await apiFetch(
      `/api/reports/${encodeURIComponent(exportId)}/file?workspaceId=${encodeURIComponent(workspaceId)}`,
      {
        method: "PUT",
        headers: {
          ...authHeaders(getOrCreateClientUserId()),
          "content-type": "application/pdf",
        },
        body: blob,
      },
    );
    if (!res.ok) return null;
    return (await res.json()) as ReportExportView;
  } catch {
    return null;
  }
}

export function reportPdfDownloadUrl(
  workspaceId: string,
  exportId: string,
): string {
  return `/api/reports/${encodeURIComponent(exportId)}/file?workspaceId=${encodeURIComponent(workspaceId)}`;
}

/** Trigger browser download of a stored report PDF (uses session cookie). */
export async function downloadReportPdf(
  workspaceId: string,
  exportId: string,
  filenameHint?: string,
): Promise<void> {
  const res = await apiFetch(
    reportPdfDownloadUrl(workspaceId, exportId),
    { cache: "no-store" },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "下载失败");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filenameHint?.endsWith(".pdf")
    ? filenameHint
    : `${filenameHint || "品牌报告"}.pdf`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function deleteReportExport(
  workspaceId: string,
  id: string,
): Promise<void> {
  const res = await apiFetch(
    `/api/reports/${encodeURIComponent(id)}?workspaceId=${encodeURIComponent(workspaceId)}`,
    { method: "DELETE", headers: headers() },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "删除失败");
  }
}
