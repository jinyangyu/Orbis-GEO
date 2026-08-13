"use client";

import { useEffect, useRef, useState } from "react";
import type { CitationsMetrics, OverviewMetrics } from "@/lib/metrics/types";
import {
  exportBrandReportPdf,
  type ReportType,
} from "@/lib/report/export-brand-report";

type Phase = "configure" | "generating" | "ready" | "error";

type Props = {
  open: boolean;
  onClose: () => void;
  overview: OverviewMetrics | null;
  citations?: CitationsMetrics | null;
  rangeLabel: string;
  engineLabel: string;
  tagLabel: string;
  marketLabel: string;
  brandName: string;
};

export default function GenerateReportModal({
  open,
  onClose,
  overview,
  citations,
  rangeLabel,
  engineLabel,
  tagLabel,
  marketLabel,
  brandName,
}: Props) {
  const [phase, setPhase] = useState<Phase>("configure");
  const [reportType, setReportType] = useState<ReportType>("document");
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoName, setLogoName] = useState("");
  const [progress, setProgress] = useState(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState("品牌报告.pdf");
  const [error, setError] = useState("");
  const cancelled = useRef(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    cancelled.current = false;
    setPhase("configure");
    setProgress(0);
    setError("");
    setBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [open]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  if (!open) return null;

  const close = () => {
    cancelled.current = true;
    onClose();
  };

  const onFile = (file: File | null) => {
    if (!file) return;
    if (!/\.(png|jpe?g|svg)$/i.test(file.name) && !file.type.startsWith("image/")) {
      setError("支持格式：JPG、PNG 或 SVG。");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogoDataUrl(String(reader.result || ""));
      setLogoName(file.name);
      setError("");
    };
    reader.readAsDataURL(file);
  };

  const startExport = async () => {
    if (!overview) {
      setError("总览数据尚未就绪。");
      return;
    }
    cancelled.current = false;
    setPhase("generating");
    setProgress(8);
    setError("");
    try {
      // Fake early progress while CDN loads
      const timer = window.setInterval(() => {
        setProgress((p) => (p < 18 ? p + 2 : p));
      }, 120);
      const result = await exportBrandReportPdf(
        {
          overview,
          citations,
          rangeLabel,
          engineLabel,
          tagLabel,
          marketLabel,
          reportType,
          logoDataUrl,
          brandName,
        },
        (pct) => {
          if (!cancelled.current) setProgress(pct);
        },
      );
      window.clearInterval(timer);
      if (cancelled.current) return;
      setBlobUrl(result.blobUrl);
      setFilename(result.filename);
      setPhase("ready");
      setProgress(100);
    } catch (e) {
      if (cancelled.current) return;
      setPhase("error");
      setError(e instanceof Error ? e.message : "Export failed");
    }
  };

  return (
    <div className="report-modal-backdrop" role="presentation" onClick={close}>
      <div
        className="report-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {phase === "configure" && (
          <>
            <div className="report-modal-head">
              <h2 id="report-modal-title">生成品牌报告</h2>
              <button type="button" className="report-close" onClick={close} aria-label="关闭">
                ×
              </button>
            </div>
            <p className="report-lead">选择报告格式，并可添加 Logo 后导出。</p>
            <div className="report-section">
              <b>报告类型</b>
              <label className={`report-radio${reportType === "document" ? " on" : ""}`}>
                <input
                  type="radio"
                  name="report-type"
                  checked={reportType === "document"}
                  onChange={() => setReportType("document")}
                />
                <span>
                  <strong>文档</strong>
                  <small>竖版页面，适合打印与阅读（A4 纵向）。</small>
                </span>
              </label>
              <label className={`report-radio${reportType === "presentation" ? " on" : ""}`}>
                <input
                  type="radio"
                  name="report-type"
                  checked={reportType === "presentation"}
                  onChange={() => setReportType("presentation")}
                />
                <span>
                  <strong>演示文稿</strong>
                  <small>横版页面，适合会议汇报与客户演示（16:9 横向）。</small>
                </span>
              </label>
            </div>
            <div className="report-section">
              <b>添加 Logo，个性化报告</b>
              <button
                type="button"
                className="report-dropzone"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  onFile(e.dataTransfer.files?.[0] ?? null);
                }}
              >
                <em>↑</em>
                <span>
                  拖拽文件到此处，或 <u>选择文件</u> 上传
                </span>
                {logoName ? <small className="logo-name">{logoName}</small> : null}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".png,.jpg,.jpeg,.svg,image/*"
                hidden
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />
              <p className="report-help">
                支持格式：JPG、PNG 或 SVG。建议高度至少 200px。
              </p>
            </div>
            {error ? <p className="report-error">{error}</p> : null}
            <div className="report-footer">
              <button type="button" className="report-btn ghost" onClick={close}>
                取消
              </button>
              <button
                type="button"
                className="report-btn primary"
                onClick={() => void startExport()}
                disabled={!overview}
              >
                导出 PDF
              </button>
            </div>
          </>
        )}

        {phase === "generating" && (
          <>
            <div className="report-modal-head">
              <h2>正在生成品牌报告…</h2>
              <button type="button" className="report-close" onClick={close} aria-label="关闭">
                ×
              </button>
            </div>
            <div className="report-progress-block">
              <b>已开始导出。</b>
              <p>正在准备文件，稍后将自动下载。</p>
              <div className="report-progress-row">
                <div className="report-progress-track">
                  <i style={{ width: `${progress}%` }} />
                </div>
                <span>{progress}%</span>
              </div>
            </div>
            <div className="report-footer">
              <button type="button" className="report-btn ghost" onClick={close}>
                取消
              </button>
            </div>
          </>
        )}

        {(phase === "ready" || phase === "error") && (
          <>
            <div className="report-modal-head">
              <h2>{phase === "ready" ? "品牌报告已就绪" : "导出失败"}</h2>
              <button type="button" className="report-close" onClick={close} aria-label="关闭">
                ×
              </button>
            </div>
            <div className="report-progress-block">
              {phase === "ready" ? (
                <>
                  <b>导出成功。</b>
                  <p>文件已开始下载。</p>
                  <p className="report-help">
                    若未自动开始，请{" "}
                    {blobUrl ? (
                      <a href={blobUrl} download={filename}>
                        点击这里
                      </a>
                    ) : (
                      <span>点击这里</span>
                    )}
                    。
                  </p>
                </>
              ) : (
                <>
                  <b>出错了。</b>
                  <p>{error || "请重试。"}</p>
                </>
              )}
            </div>
            <div className="report-footer">
              <button type="button" className="report-btn ghost" onClick={close}>
                关闭
              </button>
              {phase === "error" && (
                <button
                  type="button"
                  className="report-btn primary"
                  onClick={() => setPhase("configure")}
                >
                  重试
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
