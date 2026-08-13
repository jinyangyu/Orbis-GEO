import type { CitationsMetrics, OverviewMetrics } from "@/lib/metrics/types";
import { buildReportPages } from "./pdf/pages";
import { buildReportCss } from "./pdf/styles";
import { todayYmd } from "./pdf/util";

export type ReportType = "document" | "presentation";

export type ReportExportInput = {
  overview: OverviewMetrics;
  citations?: CitationsMetrics | null;
  rangeLabel: string;
  engineLabel: string;
  tagLabel: string;
  marketLabel: string;
  reportType: ReportType;
  logoDataUrl?: string | null;
  brandName: string;
};

/** Loose typing for html2pdf Worker chain (CDN UMD). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfWorker = any;

declare global {
  interface Window {
    html2pdf?: () => PdfWorker;
  }
}

async function loadHtml2Pdf(): Promise<() => PdfWorker> {
  if (window.html2pdf) return window.html2pdf;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-orbis-html2pdf]",
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("html2pdf 加载失败")),
      );
      if (window.html2pdf) resolve();
      return;
    }
    const s = document.createElement("script");
    s.src =
      "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    s.async = true;
    s.dataset.orbisHtml2pdf = "1";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("无法加载 PDF 导出组件"));
    document.head.appendChild(s);
  });
  if (!window.html2pdf) throw new Error("html2pdf 不可用");
  return window.html2pdf;
}

/** Keep CJK / letters / digits for download filename; strip path-illegal chars. */
export function reportFilename(brand: string, dateYmd: string): string {
  const raw = String(brand || "品牌")
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 48);
  const slug = raw || "品牌";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateYmd) ? dateYmd : todayYmd();
  return `${slug}-品牌报告-${date}.pdf`;
}

async function ensureChineseFont(): Promise<void> {
  const id = "orbis-noto-sans-sc";
  if (!document.getElementById(id)) {
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap";
    document.head.appendChild(link);
  }
  try {
    await Promise.race([
      document.fonts?.load?.('16px "Noto Sans SC"') ?? Promise.resolve(),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch {
    /* system CJK fonts still available */
  }
}

function injectReportCss(landscape: boolean): HTMLStyleElement {
  document.getElementById("orbis-report-css")?.remove();
  const style = document.createElement("style");
  style.id = "orbis-report-css";
  style.textContent = buildReportCss(landscape);
  document.head.appendChild(style);
  return style;
}

function downloadBlob(blob: Blob, filename: string): string {
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  return blobUrl;
}

/**
 * Otterly-style multi-page PDF.
 * CSS lives in document.head (.orbis-rp*) so html2pdf page clones keep styles.
 */
export async function exportBrandReportPdf(
  input: ReportExportInput,
  onProgress?: (pct: number) => void,
): Promise<{ filename: string; blobUrl: string }> {
  const tick = (n: number) =>
    onProgress?.(Math.max(0, Math.min(100, Math.round(n))));
  tick(5);

  const html2pdf = await loadHtml2Pdf();
  tick(12);
  await ensureChineseFont();
  tick(20);

  const brand = input.brandName || input.overview.brandName || "品牌";
  const dateYmd = input.overview.range?.to ?? todayYmd();
  const filename = reportFilename(brand, dateYmd);
  const landscape = input.reportType === "presentation";
  const pageWmm = landscape ? 297 : 210;

  document.getElementById("orbis-report-stage")?.remove();
  const cssEl = injectReportCss(landscape);

  const stage = document.createElement("div");
  stage.id = "orbis-report-stage";
  // On-screen + full opacity (under report modal z-index:90). Critical for html2canvas.
  stage.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    `width:${pageWmm}mm`,
    "z-index:1",
    "background:#fff",
    "pointer-events:none",
    "overflow:visible",
  ].join(";");

  const pagesHtml = buildReportPages({
    overview: input.overview,
    citations: input.citations,
    rangeLabel: input.rangeLabel,
    engineLabel: input.engineLabel,
    tagLabel: input.tagLabel,
    marketLabel: input.marketLabel,
    logoDataUrl: input.logoDataUrl,
    brandName: brand,
  });
  stage.innerHTML = pagesHtml.join("");
  document.body.appendChild(stage);

  try {
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r())),
    );
    tick(28);

    const pages = [
      ...stage.querySelectorAll<HTMLElement>(":scope > .orbis-rp"),
    ];
    if (!pages.length) {
      throw new Error("报告页面未生成，请重试");
    }

    const opt = {
      margin: 0,
      filename,
      image: { type: "jpeg", quality: 0.96 },
      html2canvas: {
        scale: 1.5,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        scrollX: 0,
        scrollY: 0,
      },
      jsPDF: {
        unit: "mm",
        format: "a4",
        orientation: landscape ? "landscape" : "portrait",
      },
      pagebreak: { mode: [] as string[] },
    };

    let worker: PdfWorker = html2pdf().set(opt).from(pages[0]).toPdf();
    tick(40);

    for (let i = 1; i < pages.length; i++) {
      const pageEl = pages[i];
      worker = worker
        .get("pdf")
        .then((pdf: { addPage: () => void }) => {
          pdf.addPage();
        })
        .from(pageEl)
        .toContainer()
        .toCanvas()
        .toPdf();
      tick(40 + Math.round((i / pages.length) * 45));
    }

    const blob: Blob = await worker.outputPdf("blob");
    if (!blob || blob.size < 5000) {
      throw new Error(
        `PDF 生成异常（${blob?.size ?? 0} 字节），请重试或检查网络字体加载`,
      );
    }
    tick(92);

    const blobUrl = downloadBlob(blob, filename);
    tick(100);
    return { filename, blobUrl };
  } finally {
    stage.remove();
    cssEl.remove();
  }
}
