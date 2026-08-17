"use client";

import { useCallback, useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import {
  deleteReportExport,
  downloadReportPdf,
  fetchReportExports,
  type ReportExportView,
} from "@/lib/reports/client";

export function Reports({
  workspaceId,
  notify,
  onGoOverview,
  onRegenerate,
}: {
  workspaceId: string | null;
  notify: (s: string) => void;
  brandName?: string;
  onGoOverview: () => void;
  onRegenerate?: (row: ReportExportView) => void;
}) {
  const [items, setItems] = useState<ReportExportView[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!workspaceId) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const list = await fetchReportExports(workspaceId);
      setItems(list);
    } catch (e) {
      notify(e instanceof Error ? e.message : "加载报告失败");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, notify]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onDelete = async (id: string) => {
    if (!workspaceId) return;
    if (!window.confirm("确定删除这份报告记录？此操作无法撤销。")) return;
    setDeletingId(id);
    try {
      await deleteReportExport(workspaceId, id);
      setItems((prev) => prev.filter((x) => x.id !== id));
      notify("已删除报告记录");
    } catch (e) {
      notify(e instanceof Error ? e.message : "删除失败");
    } finally {
      setDeletingId(null);
    }
  };

  const onDownload = async (row: ReportExportView) => {
    if (!workspaceId || !row.downloadable) return;
    setBusyId(row.id);
    try {
      await downloadReportPdf(workspaceId, row.id, row.title || "品牌报告");
      notify("开始下载");
    } catch (e) {
      notify(e instanceof Error ? e.message : "下载失败");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <section className="report-hero">
        <div>
          <span className="eyebrow">{t("reports.emptyTitle")}</span>
          <h2>{t("reports.emptyTitle")}</h2>
          <p>
            {items.length
              ? `共 ${items.length} 份报告。可下载已上传的 PDF，或按原筛选再次生成。`
              : t("reports.emptyBody")}
          </p>
        </div>
        <button type="button" onClick={onGoOverview}>
          {t("reports.cta")}
        </button>
      </section>
      <div className="panel reports-list">
        <div className="panel-head">
          <div>
            <h3>最近报告</h3>
            <p>服务端保存 PDF 后可随时再下载</p>
          </div>
          <button type="button" className="text-button" onClick={() => void reload()}>
            刷新
          </button>
        </div>
        {loading && <div className="empty-delta" style={{ margin: 18 }}>加载中…</div>}
        {!loading && items.length === 0 && (
          <div className="empty-delta" style={{ margin: 18 }}>
            暂无已保存报告。请从品牌报告页使用「{t("action.generateReport")}」导出 PDF。
          </div>
        )}
        {!loading &&
          items.map((r) => {
            const f = r.filters;
            const meta = [
              f.rangeLabel,
              f.engineLabel,
              f.reportType === "presentation" ? "演示文稿" : "文档",
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <div className="report-row" key={r.id}>
                <span className="file-icon">▤</span>
                <div>
                  <b>{r.title || "品牌报告"}</b>
                  <small>
                    {meta || r.kind}
                    {" · "}
                    {String(r.generatedAt).slice(0, 19).replace("T", " ")}
                    {f.visibility != null ? ` · 可见度 ${f.visibility}` : ""}
                  </small>
                </div>
                <span className={r.downloadable ? "generated" : "draft"}>
                  {r.downloadable ? "可下载" : "仅元数据"}
                </span>
                {r.downloadable ? (
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => void onDownload(r)}
                  >
                    {busyId === r.id ? "下载中…" : "下载"}
                  </button>
                ) : null}
                {onRegenerate ? (
                  <button type="button" onClick={() => onRegenerate(r)}>
                    再次生成
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={deletingId === r.id}
                  onClick={() => void onDelete(r.id)}
                >
                  {deletingId === r.id ? "删除中…" : "删除"}
                </button>
              </div>
            );
          })}
      </div>
    </>
  );
}
