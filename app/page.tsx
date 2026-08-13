"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ContentArticles from "./content-articles";
import BrandSettings, { type BrandSettingsTab } from "./brand-settings";
import GenerateReportModal from "./generate-report-modal";
import Onboarding, { resetOnboardingStorage } from "./onboarding";
import { PromptResearch } from "./prompt-research";
import ReportFilters from "./report-filters";
import ReviewDetectedBrandsModal from "./review-detected-brands-modal";
import PromptHoverText from "./prompt-hover-text";
import { SentimentCell } from "./sentiment-cell";
import {
  engineFilterFromLabel,
  fetchCitationsMetrics,
  fetchMonitoringWorkspaces,
  fetchOverviewMetrics,
  fetchPromptDetail,
  fetchPromptsMetrics,
  fetchWorkspaceById,
  getStoredWorkspaceId,
  setStoredWorkspaceId,
} from "@/lib/metrics/client";
import { buildPresetRange, type DateRangeValue } from "@/lib/report/date-range";
import type {
  CitationsMetrics,
  CitedUrlRow,
  OverviewMetrics,
  PromptDetailMetrics,
  PromptMetricRow,
  PromptsMetrics,
  TrendPoint,
  BviMetrics,
  WorkspaceListItem,
} from "@/lib/metrics/types";
import type { WorkspacePayload } from "@/lib/onboarding/types";

type PageKey =
  | "overview"
  | "prompts"
  | "citations"
  | "recommendations"
  | "research"
  | "reports"
  | "content"
  | "brand-settings";

const navGroups = [
  {
    label: "品牌报告",
    items: [
      { key: "overview", icon: "⌂", label: "总览" },
      { key: "prompts", icon: "◎", label: "Prompts" },
      { key: "citations", icon: "↗", label: "引用" },
      { key: "recommendations", icon: "✓", label: "建议" },
    ],
  },
  {
    label: "通用",
    items: [
      { key: "research", icon: "✦", label: "Prompt 研究" },
      { key: "content", icon: "✎", label: "内容生成" },
      { key: "reports", icon: "▤", label: "报告中心" },
    ],
  },
] as const;

function Sparkline({
  color = "#39b980",
  points = "0,42 18,38 36,41 54,28 72,31 90,17 108,22 126,7 144,12 164,3",
}: {
  color?: string;
  points?: string;
}) {
  return (
    <svg className="spark" viewBox="0 0 164 48" preserveAspectRatio="none" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Donut({ value, color = "#5b6cff" }: { value: number; color?: string }) {
  return (
    <div
      className="donut"
      style={{ background: `conic-gradient(${color} ${value}%, #edf0f4 0)` }}
    >
      <span>{value}%</span>
    </div>
  );
}

/** Otterly-like brand coverage palette (distinct, slightly muted). */
const TREND_PALETTE = [
  "#3F3D89",
  "#FF8A22",
  "#7CB342",
  "#8D6E32",
  "#D27B7E",
  "#556B2F",
  "#4A90A4",
  "#C4782A",
  "#6B5B95",
  "#2E8B57",
];

/** Round coverage axis up so lines use the plot height instead of sitting in the bottom third. */
function coverageAxisMax(values: number[]): number {
  const peak = Math.max(0, ...values);
  if (peak <= 0) return 20;
  const padded = peak * 1.12;
  const step = padded <= 25 ? 5 : padded <= 60 ? 10 : 20;
  return Math.min(100, Math.max(step * 2, Math.ceil(padded / step) * step));
}

/** Smooth Catmull-Rom spline → cubic Bezier (Otterly-style curves). */
function seriesSmoothPath(values: number[], maxY: number): string {
  if (!values.length) return "M0 120 L700 120";
  const max = Math.max(maxY, 1);
  const step = values.length > 1 ? 700 / (values.length - 1) : 700;
  const pts = values.map((v, i) => ({
    x: i * step,
    y: 220 - (v / max) * 180,
  }));
  if (pts.length === 1) return `M${pts[0].x} ${pts[0].y}`;
  if (pts.length === 2) {
    return `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} L${pts[1].x.toFixed(1)} ${pts[1].y.toFixed(1)}`;
  }
  let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function formatTrendDate(raw: string): string {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(raw).slice(0, 10));
  if (!m) return raw || "—";
  return `${Number(m[3])} ${months[Number(m[2]) - 1]}`;
}

function InfoTip({ text, align = "right" }: { text: string; align?: "left" | "right" }) {
  return (
    <span className={`info-tip info-tip-${align}`}>
      <button type="button" className="info-tip-btn" aria-label="指标说明">
        i
      </button>
      <span className="info-tip-bubble" role="tooltip">
        {text}
      </span>
    </span>
  );
}

function PanelTitle({
  title,
  subtitle,
  tip,
}: {
  title: string;
  subtitle?: string;
  tip?: string;
}) {
  return (
    <div>
      <h3>
        {title}
        {tip ? <InfoTip text={tip} /> : null}
      </h3>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
  );
}

function KpiTitle({ title, tip }: { title: string; tip: string }) {
  return (
    <div className="kpi-title">
      <h3>{title}</h3>
      <InfoTip text={tip} />
    </div>
  );
}

function trendSeries(trend: TrendPoint[]) {
  const first = trend[0]?.series ?? [];
  return first.map((s) => ({
    brandId: s.brandId,
    name: s.name,
    values: trend.map(
      (t) => t.series.find((x) => x.brandId === s.brandId)?.coverage ?? 0,
    ),
  }));
}

/** Pick sparse axis ticks like Otterly: "15 Jul", "13 Aug". */
function trendAxisTicks(trend: TrendPoint[], maxTicks = 5) {
  if (!trend.length) return [{ date: "—", label: "—", index: 0 }];
  const n = trend.length;
  const count = Math.min(Math.max(3, maxTicks), n);
  const indexes =
    count <= 1
      ? [0]
      : Array.from({ length: count }, (_, i) =>
          Math.round((i * (n - 1)) / (count - 1)),
        );
  const uniq = [...new Set(indexes)];
  return uniq.map((index) => {
    const raw = String(trend[index]?.date ?? "").slice(0, 10);
    return {
      date: raw || "—",
      label: formatTrendDate(raw || "—"),
      index,
    };
  });
}

function TrendCoverageChart({
  trend,
  series,
  colors,
}: {
  trend: TrendPoint[];
  series: Array<{ brandId: string; name: string; values: number[] }>;
  colors: string[];
}) {
  const plotRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<{
    index: number;
    xPct: number;
  } | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const seriesKey = series.map((s) => s.brandId).join("|");
  useEffect(() => {
    setHidden(new Set());
  }, [seriesKey]);

  const axisTicks = trendAxisTicks(trend);
  const trendLen = Math.max(trend.length - 1, 1);
  const activeSeries = series.filter((s) => !hidden.has(s.brandId));
  const maxY = coverageAxisMax(activeSeries.flatMap((s) => s.values));

  const updateHover = (clientX: number) => {
    const el = plotRef.current;
    if (!el || trend.length === 0) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const index = Math.round(ratio * (trend.length - 1));
    setHover({
      index,
      xPct: (index / trendLen) * 100,
    });
  };

  const tip = hover
    ? {
        date: formatTrendDate(trend[hover.index]?.date ?? ""),
        rows: activeSeries.map((s) => {
          const i = series.findIndex((x) => x.brandId === s.brandId);
          return {
            name: s.name,
            color: colors[i] || TREND_PALETTE[0],
            value: s.values[hover.index] ?? 0,
          };
        }),
      }
    : null;

  const yTicks = [1, 0.75, 0.5, 0.25, 0].map((r) => Math.round(maxY * r));

  const toggleBrand = (brandId: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(brandId)) next.delete(brandId);
      else {
        // Keep at least one series visible.
        if (series.length - next.size <= 1) return prev;
        next.add(brandId);
      }
      return next;
    });
  };

  return (
    <>
      <div className="chart-wrap">
        <div className="y-axis-block" aria-hidden>
          <span className="y-axis-title">Brand Coverage %</span>
          <div className="y-axis">
            {yTicks.map((v, i) => (
              <span key={`${v}-${i}`}>{v}%</span>
            ))}
          </div>
        </div>
        <div
          className="line-chart"
          ref={plotRef}
          onMouseMove={(e) => updateHover(e.clientX)}
          onMouseLeave={() => setHover(null)}
        >
          <div className="grid-lines" />
          <svg
            viewBox="0 0 700 240"
            preserveAspectRatio="none"
            aria-label="品牌覆盖趋势图"
          >
            {activeSeries.map((s) => {
              const i = series.findIndex((x) => x.brandId === s.brandId);
              const color = colors[i] || TREND_PALETTE[0];
              return (
                <path
                  key={s.brandId}
                  d={seriesSmoothPath(s.values, maxY)}
                  fill="none"
                  stroke={color}
                  strokeWidth={2.1}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
            {hover &&
              activeSeries.map((s) => {
                const i = series.findIndex((x) => x.brandId === s.brandId);
                const color = colors[i] || TREND_PALETTE[0];
                const v = s.values[hover.index] ?? 0;
                const x = (hover.index / trendLen) * 700;
                const y = 220 - (v / maxY) * 180;
                return (
                  <g key={`dot-${s.brandId}`}>
                    <circle
                      cx={x}
                      cy={y}
                      r={6}
                      fill={color}
                      opacity={0.18}
                      vectorEffect="non-scaling-stroke"
                    />
                    <circle
                      cx={x}
                      cy={y}
                      r={3.2}
                      fill="#fff"
                      stroke={color}
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                );
              })}
          </svg>
          {hover && (
            <>
              <div className="chart-guide" style={{ left: `${hover.xPct}%` }} />
              <div
                className={`chart-tooltip${hover.xPct > 62 ? " chart-tooltip-left" : ""}`}
                style={{ left: `${hover.xPct}%` }}
              >
                <b>{tip?.date}</b>
                <ul>
                  {tip?.rows.map((row) => (
                    <li key={row.name}>
                      <i style={{ background: row.color }} />
                      <span>{row.name}</span>
                      <strong>{row.value}%</strong>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
          <div className="x-axis">
            {axisTicks.map((tick, i) => {
              const isFirst = i === 0;
              const isLast = i === axisTicks.length - 1;
              return (
                <span
                  key={`${tick.date}-${tick.index}`}
                  style={{
                    left: `${(tick.index / trendLen) * 100}%`,
                    transform: isFirst
                      ? "none"
                      : isLast
                        ? "translateX(-100%)"
                        : "translateX(-50%)",
                  }}
                  title={tick.date}
                >
                  {tick.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>
      <div className="chart-legend">
        {series.map((s, i) => {
          const on = !hidden.has(s.brandId);
          const color = colors[i] || TREND_PALETTE[0];
          return (
            <button
              key={s.brandId}
              type="button"
              className={`legend-item${on ? "" : " off"}`}
              onClick={() => toggleBrand(s.brandId)}
            >
              <span
                className="legend-check"
                style={{ background: on ? color : "#d1d5db" }}
                aria-hidden
              >
                {on ? "✓" : ""}
              </span>
              {s.name}
            </button>
          );
        })}
      </div>
    </>
  );
}

function formatBviDate(raw: string): string {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(raw).slice(0, 10));
  if (!m) return raw || "—";
  return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`;
}

function BrandVisibilityIndexPanel({
  bvi,
  colorByBrand,
}: {
  bvi: BviMetrics;
  colorByBrand: Map<string, string>;
}) {
  const frames = bvi.frames;
  const last = Math.max(0, frames.length - 1);
  const [idx, setIdx] = useState(last);
  const [playing, setPlaying] = useState(false);
  const [sortKey, setSortKey] = useState<"coverage" | "likelihood">("coverage");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const frameKey = `${frames[0]?.date ?? ""}|${frames[last]?.date ?? ""}|${frames.length}`;

  useEffect(() => {
    setIdx(last);
    setPlaying(false);
  }, [frameKey, last]);

  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const timer = window.setInterval(() => {
      setIdx((prev) => {
        if (prev >= frames.length - 1) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 420);
    return () => window.clearInterval(timer);
  }, [playing, frames.length]);

  const frame = frames[Math.min(idx, last)];
  const brands = frame?.brands ?? [];
  const sorted = [...brands].sort((a, b) => {
    const av = sortKey === "coverage" ? a.coverage : a.likelihoodToBuy;
    const bv = sortKey === "coverage" ? b.coverage : b.likelihoodToBuy;
    return sortDir === "desc" ? bv - av : av - bv;
  });

  const toggleSort = (key: "coverage" | "likelihood") => {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const startDate = frames[0]?.date ?? "";
  const endDate = frames[last]?.date ?? "";
  const progress = last === 0 ? 100 : (idx / last) * 100;

  return (
    <article className="panel bvi-panel">
      <div className="bvi-head">
        <PanelTitle
          title="Brand Visibility Index on AI Search"
          tip="横轴为品牌覆盖率，纵轴 Likelihood to buy 由平均出现位次换算（位次越靠前分数越高）。四象限：Leaders / Niche / Low Conversion / Low Performance。可用时间轴回放每日位置变化。"
        />
        <div className="bvi-lapse">
          <span className="bvi-date">{formatBviDate(startDate)}</span>
          <div className="bvi-slider-wrap">
            <input
              className="bvi-slider"
              type="range"
              min={0}
              max={last}
              step={1}
              value={Math.min(idx, last)}
              disabled={frames.length < 2}
              aria-label="Brand Visibility Index time-lapse"
              onChange={(e) => {
                setPlaying(false);
                setIdx(Number(e.target.value));
              }}
              style={{ ["--bvi-progress" as string]: `${progress}%` }}
            />
          </div>
          <span className="bvi-date">{formatBviDate(frame?.date || endDate)}</span>
          <button
            type="button"
            className={`bvi-play${playing ? " playing" : ""}`}
            disabled={frames.length < 2}
            onClick={() => {
              if (playing) {
                setPlaying(false);
                return;
              }
              if (idx >= last) setIdx(0);
              setPlaying(true);
            }}
          >
            <em aria-hidden>{playing ? "❚❚" : "▶"}</em>
            {playing ? "Pause" : "Play time-lapse"}
          </button>
        </div>
      </div>

      <div className="bvi-body">
        <div className="bvi-chart" aria-label="Brand Visibility Index scatter">
          <div className="bvi-y-axis" aria-hidden>
            <span>100</span>
            <span>75</span>
            <span>50</span>
            <span>25</span>
            <span>0</span>
          </div>
          <div className="bvi-plot">
            <div
              className="bvi-mid-x"
              style={{ left: `${bvi.coverageMid}%` }}
            />
            <div
              className="bvi-mid-y"
              style={{ top: `calc(${100 - bvi.likelihoodMid}% - 14px)` }}
            />
            <span
              className="bvi-q niche"
              style={{
                left: 12,
                top: 12,
                maxWidth: `calc(${bvi.coverageMid}% - 16px)`,
              }}
            >
              Niche
            </span>
            <span
              className="bvi-q leaders"
              style={{ right: 12, top: 12 }}
            >
              Leaders
            </span>
            <span
              className="bvi-q low-perf"
              style={{ left: 12, bottom: 36 }}
            >
              Low Performance
            </span>
            <span
              className="bvi-q low-conv"
              style={{ right: 12, bottom: 36 }}
            >
              Low Conversion
            </span>
            {brands.map((b) => {
              const color = colorByBrand.get(b.brandId) || "#3F3D89";
              const left = Math.max(2, Math.min(96, b.coverage));
              const top = Math.max(2, Math.min(96, 100 - b.likelihoodToBuy));
              return (
                <div
                  key={b.brandId}
                  className={`bvi-point${b.isPrimary ? " primary" : ""}`}
                  style={{ left: `${left}%`, top: `${top}%` }}
                  title={`${b.name}: coverage ${b.coverage}%, LTB ${b.likelihoodToBuy}`}
                >
                  <i style={{ background: color }} />
                  <span>{b.name}</span>
                </div>
              );
            })}
            <div className="bvi-x-axis" aria-hidden>
              <span>0</span>
              <span>Brand Coverage %</span>
              <span>100</span>
            </div>
          </div>
        </div>

        <div className="bvi-table-wrap">
          <table className="bvi-table">
            <thead>
              <tr>
                <th>Brand</th>
                <th>
                  <button type="button" onClick={() => toggleSort("coverage")}>
                    Brand Coverage
                    <em>{sortKey === "coverage" ? (sortDir === "desc" ? "↓" : "↑") : "↕"}</em>
                  </button>
                </th>
                <th>
                  <button type="button" onClick={() => toggleSort("likelihood")}>
                    Likelihood to buy
                    <em>{sortKey === "likelihood" ? (sortDir === "desc" ? "↓" : "↑") : "↕"}</em>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((b) => (
                <tr key={b.brandId} className={b.isPrimary ? "primary" : ""}>
                  <td>
                    <i
                      className="kpi-dot"
                      style={{
                        background: colorByBrand.get(b.brandId) || "#3F3D89",
                      }}
                    />
                    <b>{b.name}</b>
                    {b.isPrimary ? <small className="you-label">你</small> : null}
                  </td>
                  <td>{b.coverage}%</td>
                  <td>{b.likelihoodToBuy}</td>
                </tr>
              ))}
              {!sorted.length ? (
                <tr>
                  <td colSpan={3} className="bvi-empty">
                    当前时间窗暂无 BVI 数据
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </article>
  );
}

export default function Home() {
  const [experience, setExperience] = useState<"onboarding" | "dashboard">("dashboard");
  const [page, setPage] = useState<PageKey>("overview");
  const [dateRange, setDateRange] = useState<DateRangeValue>(() =>
    buildPresetRange("30"),
  );
  const [engine, setEngine] = useState("All Engines");
  const [tag, setTag] = useState("All tags");
  const [query, setQuery] = useState("");
  const [market, setMarket] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [detectedOpen, setDetectedOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<BrandSettingsTab>("details");
  const [drawerPrompt, setDrawerPrompt] = useState<PromptMetricRow | null>(null);
  const [drawerDetail, setDrawerDetail] = useState<PromptDetailMetrics | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState("");
  const [contentReload, setContentReload] = useState(0);
  const [workspace, setWorkspace] = useState<WorkspacePayload | null>(null);
  const [workspaceList, setWorkspaceList] = useState<WorkspaceListItem[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [promptsData, setPromptsData] = useState<PromptsMetrics | null>(null);
  const [citations, setCitations] = useState<CitationsMetrics | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [loadingCitations, setLoadingCitations] = useState(false);
  const [metricsError, setMetricsError] = useState("");
  const overviewAbort = useRef<AbortController | null>(null);
  const promptsAbort = useRef<AbortController | null>(null);
  const citationsAbort = useRef<AbortController | null>(null);
  const promptsKeyRef = useRef("");
  const citationsKeyRef = useRef("");

  const rangeDays = dateRange.days;
  const rangeFrom = dateRange.from;
  const rangeTo = dateRange.to;
  const engineCode = engineFilterFromLabel(engine);
  const filterKey = `${rangeFrom}|${rangeTo}|${rangeDays}|${engineCode ?? "all"}`;

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  };

  const resetFilters = () => {
    setDateRange(buildPresetRange("30"));
    setEngine("All Engines");
    setTag("All tags");
    setMarket("");
    setQuery("");
  };

  const loadDashboard = useCallback(
    async (preferredId?: string | null) => {
      overviewAbort.current?.abort();
      promptsAbort.current?.abort();
      citationsAbort.current?.abort();
      const ac = new AbortController();
      overviewAbort.current = ac;

      setLoadingOverview(true);
      setMetricsError("");
      setPromptsData(null);
      setCitations(null);
      promptsKeyRef.current = "";
      citationsKeyRef.current = "";

      try {
        const list = await fetchMonitoringWorkspaces(ac.signal);
        setWorkspaceList(list);
        const stored = preferredId ?? getStoredWorkspaceId();
        const validStored =
          stored && stored !== "undefined" && list.some((w) => w.id === stored)
            ? stored
            : null;
        const selected = validStored ?? list[0]?.id ?? null;
        if (!selected) {
          setWorkspaceId(null);
          setWorkspace(null);
          setOverview(null);
          setMetricsError("暂无监测数据，请先导入 inspection 答卷。");
          return;
        }
        setStoredWorkspaceId(selected);
        setWorkspaceId(selected);
        const [ws, ov] = await Promise.all([
          fetchWorkspaceById(selected, ac.signal),
          fetchOverviewMetrics(selected, {
            engine: engineCode,
            days: rangeDays,
            from: rangeFrom,
            to: rangeTo,
            signal: ac.signal,
          }),
        ]);
        setWorkspace(ws);
        setOverview(ov);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (err instanceof Error && err.name === "AbortError") return;
        setMetricsError(err instanceof Error ? err.message : "加载失败");
      } finally {
        if (!ac.signal.aborted) setLoadingOverview(false);
      }
    },
    [engineCode, rangeDays, rangeFrom, rangeTo],
  );

  useEffect(() => {
    if (experience === "dashboard") void loadDashboard();
  }, [experience, loadDashboard]);

  useEffect(() => {
    if (experience !== "dashboard" || !workspaceId) return;
    if (page !== "prompts") return;
    const key = `${workspaceId}|${filterKey}|prompts`;
    if (promptsKeyRef.current === key) return;

    promptsAbort.current?.abort();
    const ac = new AbortController();
    promptsAbort.current = ac;
    setLoadingPrompts(true);
    void fetchPromptsMetrics(workspaceId, {
      engine: engineCode,
      days: rangeDays,
      from: rangeFrom,
      to: rangeTo,
      market: market || undefined,
      signal: ac.signal,
    })
      .then((data) => {
        if (ac.signal.aborted) return;
        setPromptsData(data);
        promptsKeyRef.current = key;
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (err instanceof Error && err.name === "AbortError") return;
        setMetricsError(err instanceof Error ? err.message : "Prompts 加载失败");
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoadingPrompts(false);
      });
  }, [experience, page, workspaceId, filterKey, engineCode, rangeDays, rangeFrom, rangeTo, market]);

  useEffect(() => {
    if (experience !== "dashboard" || !workspaceId) return;
    if (page !== "citations" && !reportOpen) return;
    const key = `${workspaceId}|${filterKey}|citations`;
    if (citationsKeyRef.current === key) return;

    citationsAbort.current?.abort();
    const ac = new AbortController();
    citationsAbort.current = ac;
    setLoadingCitations(true);
    void fetchCitationsMetrics(workspaceId, {
      engine: engineCode,
      days: rangeDays,
      from: rangeFrom,
      to: rangeTo,
      signal: ac.signal,
    })
      .then((data) => {
        if (ac.signal.aborted) return;
        setCitations(data);
        citationsKeyRef.current = key;
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (err instanceof Error && err.name === "AbortError") return;
        if (page === "citations") {
          setMetricsError(err instanceof Error ? err.message : "Citations 加载失败");
        }
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoadingCitations(false);
      });
  }, [
    experience,
    page,
    workspaceId,
    filterKey,
    engineCode,
    rangeDays,
    rangeFrom,
    rangeTo,
    reportOpen,
  ]);

  useEffect(() => {
    if (!drawerPrompt || !workspaceId) {
      setDrawerDetail(null);
      return;
    }
    const ac = new AbortController();
    void fetchPromptDetail(workspaceId, drawerPrompt.promptId, {
      days: rangeDays,
      from: rangeFrom,
      to: rangeTo,
      engine: engineCode,
      signal: ac.signal,
    })
      .then(setDrawerDetail)
      .catch(() => {
        if (!ac.signal.aborted) setDrawerDetail(null);
      });
    return () => ac.abort();
  }, [drawerPrompt, workspaceId, rangeDays, rangeFrom, rangeTo, engineCode]);

  const filteredPrompts = useMemo(() => {
    const rows = promptsData?.items ?? [];
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchQ =
        !q || row.q.toLowerCase().includes(q) || row.tag.includes(query);
      const matchM = !market || row.market === market;
      const matchTag = tag === "All tags" || row.tag === tag;
      return matchQ && matchM && matchTag;
    });
  }, [promptsData, query, market, tag]);

  const engineOptions = useMemo(() => {
    const fromOverview =
      overview?.engines.map((e) => ({
        code: e.code,
        name: e.name,
        mark: e.mark,
      })) ?? [];
    if (fromOverview.length) return fromOverview;
    return [
      { code: "deepseek", name: "DeepSeek", mark: "D" },
      { code: "doubao", name: "Doubao", mark: "豆" },
      { code: "gpt", name: "ChatGPT", mark: "G" },
    ];
  }, [overview]);

  const tagOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of promptsData?.items ?? []) {
      if (row.tag) set.add(row.tag);
    }
    for (const row of overview?.attentionPrompts ?? []) {
      if (row.tag) set.add(row.tag);
    }
    return [...set];
  }, [promptsData, overview]);

  const marketOptions = useMemo(() => {
    if (promptsData?.markets?.length) return promptsData.markets;
    const set = new Set<string>();
    for (const row of overview?.attentionPrompts ?? []) {
      if (row.market) set.add(row.market);
    }
    return [...set];
  }, [promptsData, overview]);

  if (experience === "onboarding") {
    return (
      <Onboarding
        onComplete={() => {
          void loadDashboard();
          setExperience("dashboard");
        }}
      />
    );
  }

  const selectedWorkspace =
    workspaceList.find((w) => w.id === workspaceId) ?? null;
  const workspaceName =
    selectedWorkspace?.reportTitle ||
    workspace?.workspace.reportTitle ||
    selectedWorkspace?.brandName ||
    selectedWorkspace?.name ||
    workspace?.workspace.name ||
    workspace?.brand?.name ||
    overview?.brandName ||
    "选择工作区";
  const workspaceInitial = workspaceName.slice(0, 1).toUpperCase() || "O";
  const profileName = workspace?.profile
    ? `${workspace.profile.firstName} ${workspace.profile.lastName}`.trim()
    : "监测账号";
  const profileInitials = workspace?.profile
    ? `${workspace.profile.firstName.slice(0, 1)}${workspace.profile.lastName.slice(0, 1)}`.toUpperCase() ||
      "OR"
    : "OR";
  const profileSite =
    selectedWorkspace?.brandDomain ||
    workspace?.brand?.website?.replace(/^www\./, "") ||
    "";
  const profileEmail = profileSite
    ? `import@${profileSite.replace(/^www\./, "")}`
    : "import@orbis.local";

  const changePage = (key: PageKey) => {
    setPage(key);
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cycleWorkspace = () => {
    if (workspaceList.length < 2) {
      notify("当前只有一个监测工作区");
      return;
    }
    const idx = workspaceList.findIndex((w) => w.id === workspaceId);
    const next = workspaceList[(idx + 1) % workspaceList.length];
    // Optimistic UI: name/breadcrumb switch immediately; metrics load after.
    setStoredWorkspaceId(next.id);
    setWorkspaceId(next.id);
    setOverview(null);
    setWorkspace(null);
    setPromptsData(null);
    setCitations(null);
    promptsKeyRef.current = "";
    citationsKeyRef.current = "";
    notify(`已切换到 ${next.brandName || next.name}`);
    void loadDashboard(next.id);
  };

  const titles: Record<PageKey, [string, string]> = {
    overview: ["品牌报告总览", "覆盖率、提及、位次与引用，对照竞品表现。"],
    prompts: ["Prompts", "查看哪些问题提及品牌，哪些提及竞品。"],
    citations: ["引用分析", "AI 回答引用的 URL、域名与竞品共现。"],
    recommendations: ["优化建议", "把可见度缺口转成可执行的内容与公关动作。"],
    research: ["AI Prompt 研究", "发现真实用户会向 AI 提出的高价值问题。"],
    reports: ["报告中心", "创建面向团队、客户和管理层的周期报告。"],
    content: ["内容生成", "查看 seo-generator-agent 产出的文章状态、摘要与预览。"],
    "brand-settings": ["品牌设置", "管理本品、竞品、监测 Prompt 与通知偏好。"],
  };

  const promptBadge = promptsData?.total ? String(promptsData.total) : undefined;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-orbit">
            <i />
          </div>
          <div>
            <strong>ORBIS</strong>
            <span>AI SEARCH INTELLIGENCE</span>
          </div>
        </div>
        <button className="workspace-switch" onClick={cycleWorkspace}>
          <span className="workspace-avatar">{workspaceInitial}</span>
          <span>
            <b>{workspaceName}</b>
            <small>
              {workspaceList.length > 1
                ? `监测工作区 · 点击切换 (${workspaceList.length})`
                : "监测工作区"}
            </small>
          </span>
          <em>⌄</em>
        </button>
        <nav>
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <p>{group.label}</p>
              {group.items.map((item) => (
                <button
                  key={item.key}
                  className={page === item.key ? "active" : ""}
                  onClick={() => changePage(item.key as PageKey)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                  {item.key === "prompts" && promptBadge && <small>{promptBadge}</small>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button onClick={() => notify("帮助中心即将上线")}>
            <span>?</span>帮助与文档
          </button>
          <button
            onClick={() => {
              void resetOnboardingStorage().then(() => setExperience("onboarding"));
            }}
          >
            <span>↺</span>重新体验首次激活
          </button>
          <div className="account">
            <span>{profileInitials}</span>
            <div>
              <b>{profileName}</b>
              <small>{profileEmail}</small>
            </div>
            <button aria-label="账户菜单">•••</button>
          </div>
        </div>
      </aside>
      {mobileNav && (
        <button className="nav-backdrop" aria-label="关闭菜单" onClick={() => setMobileNav(false)} />
      )}

      <main className="main">
        <section className="content">
          <div className="page-chrome">
            <div className="crumb-row">
              <button
                className="mobile-menu"
                onClick={() => setMobileNav(true)}
                aria-label="打开菜单"
              >
                ☰
              </button>
              <div className="crumb">
                {(
                  [
                    "overview",
                    "prompts",
                    "citations",
                    "recommendations",
                    "brand-settings",
                  ] as PageKey[]
                ).includes(page) ? (
                  <>
                    <span>品牌报告</span>
                    <i>/</i>
                    <span>{workspaceName}</span>
                    <i>/</i>
                    <b>
                      {page === "overview"
                        ? "总览"
                        : page === "prompts"
                          ? "Prompts"
                          : page === "citations"
                            ? "引用"
                            : page === "recommendations"
                              ? "建议"
                              : "品牌设置"}
                    </b>
                  </>
                ) : (
                  <b>{titles[page][0]}</b>
                )}
              </div>
              <button
                type="button"
                className="crumb-avatar"
                aria-label={`${profileName} 账户`}
                title={profileName}
              >
                {profileInitials}
              </button>
            </div>

            <div className="page-heading">
              <div className="page-title">
                {(
                  [
                    "overview",
                    "citations",
                    "recommendations",
                    "brand-settings",
                  ] as PageKey[]
                ).includes(page) ? (
                  <span className="brand-mark" aria-hidden>
                    {workspaceInitial}
                  </span>
                ) : null}
                <div>
                  <h1>
                    {page === "prompts"
                      ? "Prompts"
                      : (
                            [
                              "overview",
                              "citations",
                              "recommendations",
                            ] as PageKey[]
                          ).includes(page)
                        ? workspaceName
                        : titles[page][0]}
                  </h1>
                  {page === "prompts" ? (
                    <p>查看哪些问题提及本品，哪些提及竞品。</p>
                  ) : (
                      [
                        "overview",
                        "citations",
                        "recommendations",
                        "brand-settings",
                      ] as PageKey[]
                    ).includes(page) ? null : (
                    <p>{titles[page][1]}</p>
                  )}
                </div>
              </div>
              {page === "prompts" ? (
                <div className="heading-actions">
                  <button
                    type="button"
                    className="generate-report-btn"
                    onClick={() => {
                      const rows = filteredPrompts;
                      if (!rows.length) {
                        notify("没有可导出的 Prompt");
                        return;
                      }
                      const header = [
                        "Prompt",
                        "Tag",
                        "Market",
                        "Coverage",
                        "Sentiment",
                        "Intent",
                        "BrandMentions",
                        "TotalBrandMentions",
                        "DomainCitations",
                        "TotalDomainCitations",
                        "Competitors",
                      ];
                      const escape = (v: string | number) => {
                        const s = String(v ?? "");
                        if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
                        return s;
                      };
                      const lines = [
                        header.join(","),
                        ...rows.map((r) =>
                          [
                            r.q,
                            r.tag,
                            r.market,
                            r.coverage,
                            r.sentiment,
                            r.intentVolume,
                            r.brandMentions,
                            r.totalBrandMentions,
                            r.domainMentions,
                            r.totalDomainCitations,
                            (r.competitors ?? []).join("; ") || r.competitor,
                          ]
                            .map(escape)
                            .join(","),
                        ),
                      ];
                      const blob = new Blob(["\uFEFF" + lines.join("\n")], {
                        type: "text/csv;charset=utf-8",
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${workspaceName || "prompts"}-prompts.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                      notify(`已导出 ${rows.length} 条 Prompt`);
                    }}
                  >
                    <span aria-hidden>⬇</span>
                    Export as CSV
                  </button>
                </div>
              ) : (
                [
                  "overview",
                  "citations",
                  "recommendations",
                ] as PageKey[]
              ).includes(page) ? (
                <div className="heading-actions">
                  <button
                    type="button"
                    className="settings-btn"
                    aria-label="品牌设置"
                    onClick={() => {
                      setSettingsTab("details");
                      changePage("brand-settings");
                    }}
                  >
                    ⚙
                  </button>
                  <button
                    type="button"
                    className="generate-report-btn"
                    onClick={() => setReportOpen(true)}
                    disabled={!overview}
                  >
                    <span aria-hidden>⬇</span>
                    Generate Report
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {page !== "content" && page !== "research" && page !== "brand-settings" && (
            <ReportFilters
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              engine={engine}
              onEngineChange={setEngine}
              engines={engineOptions}
              tag={tag}
              onTagChange={setTag}
              tags={tagOptions}
              market={market}
              onMarketChange={setMarket}
              markets={marketOptions}
              promptTotal={overview?.promptTotal ?? promptsData?.total ?? 0}
              filteredPromptCount={
                page === "prompts" ? filteredPrompts.length : undefined
              }
              onReset={resetFilters}
            />
          )}

          {page === "content" && (
            <div className="heading-actions" style={{ marginBottom: 14 }}>
              <button
                className="secondary-button"
                onClick={() => {
                  setContentReload((n) => n + 1);
                  notify("内容列表已刷新");
                }}
              >
                ↻ 刷新
              </button>
            </div>
          )}

          {metricsError && page !== "content" && page !== "research" && (
            <div className="notice">
              <span>!</span>
              <div>
                <b>数据加载提示</b>
                <p>{metricsError}</p>
              </div>
            </div>
          )}
          {loadingOverview && !overview && page !== "content" && page !== "research" && (
            <div className="notice">
              <span>…</span>
              <div>
                <b>正在加载监测数据</b>
                <p>按所选时间范围聚合覆盖率、声量与引用。</p>
              </div>
            </div>
          )}

          {page === "overview" && overview && (
            <Overview
              data={overview}
              onOpenPrompts={() => changePage("prompts")}
              onOpenRecs={() => changePage("recommendations")}
              onOpenCitations={() => changePage("citations")}
              onOpenDetected={() => setDetectedOpen(true)}
            />
          )}
          {page === "brand-settings" && (
            <BrandSettings
              workspaceId={workspaceId}
              initialTab={settingsTab}
              notify={notify}
              onGoPrompts={() => changePage("prompts")}
              onGoResearch={() => changePage("research")}
              onSaved={() => {
                void loadDashboard(workspaceId ?? undefined);
              }}
            />
          )}
          {page === "research" && (
            <PromptResearch
              workspace={workspace}
              workspaceId={workspaceId}
              notify={notify}
              onPromoted={() => {
                promptsKeyRef.current = "";
                changePage("prompts");
              }}
            />
          )}
          {page === "prompts" && loadingPrompts && !promptsData && (
            <div className="notice">
              <span>…</span>
              <div>
                <b>正在加载 Prompts</b>
                <p>聚合当前时间窗内的覆盖率与提及矩阵。</p>
              </div>
            </div>
          )}
          {page === "prompts" && promptsData && (
            <Prompts
              query={query}
              setQuery={setQuery}
              market={market}
              setMarket={setMarket}
              markets={promptsData?.markets ?? []}
              rows={filteredPrompts}
              total={promptsData?.total ?? filteredPrompts.length}
              onOpen={setDrawerPrompt}
              notify={notify}
            />
          )}
          {page === "citations" && loadingCitations && !citations && (
            <div className="notice">
              <span>…</span>
              <div>
                <b>正在加载引用</b>
                <p>聚合 URL 与域名份额。</p>
              </div>
            </div>
          )}
          {page === "citations" && citations && (
            <Citations data={citations} onOpenPrompts={() => changePage("prompts")} />
          )}
          {page === "recommendations" && (
            <Recommendations overview={overview} notify={notify} />
          )}
          {page === "reports" && <Reports notify={notify} brandName={workspaceName} />}
          {page === "content" && (
            <ContentArticles notify={notify} reloadToken={contentReload} />
          )}
        </section>
      </main>

      {drawerPrompt && (
        <div className="drawer-wrap">
          <button
            className="drawer-backdrop"
            aria-label="关闭详情"
            onClick={() => setDrawerPrompt(null)}
          />
          <aside className="drawer">
            <div className="drawer-head">
              <span className="eyebrow">PROMPT 详情</span>
              <button onClick={() => setDrawerPrompt(null)}>×</button>
            </div>
            <h2>{drawerPrompt.q}</h2>
            <div className="drawer-tags">
              <span>{drawerPrompt.tag}</span>
              <span>{drawerPrompt.market || "全市场"}</span>
            </div>
            <div className="drawer-metrics">
              <div>
                <small>品牌覆盖率</small>
                <b>{drawerPrompt.coverage}%</b>
              </div>
              <div>
                <small>品牌提及</small>
                <b>{drawerPrompt.brandMentions}</b>
              </div>
              <div>
                <small>域名引用</small>
                <b>{drawerPrompt.domainMentions}</b>
              </div>
            </div>
            <div className="tabs">
              <button className="active">AI 回答</button>
            </div>
            {(drawerDetail?.observations ?? []).slice(0, 3).map((obs) => (
              <div className="answer-card" key={obs.id}>
                <div className="answer-head">
                  <span className="engine-logo dark" style={{ background: obs.engineColor }}>
                    {obs.engineMark}
                  </span>
                  <div>
                    <b>{obs.engine}</b>
                    <small>
                      {obs.observedOn}
                      {obs.market ? ` · ${obs.market}` : ""}
                    </small>
                  </div>
                  <span className={obs.mentioned ? "positive" : "down"}>
                    {obs.mentioned ? "已提及品牌" : "未提及"}
                  </span>
                </div>
                <p>
                  {obs.answerText.slice(0, 420)}
                  {obs.answerText.length > 420 ? "…" : ""}
                </p>
                {obs.citations[0] && (
                  <div className="source-line">
                    <span>↗</span>
                    <div>
                      <b>{obs.citations[0].domain || obs.citations[0].url}</b>
                      <small>
                        引用位置 #{obs.citations[0].position}
                        {obs.citations[0].title ? ` · ${obs.citations[0].title}` : ""}
                      </small>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {!drawerDetail && <p className="drawer-tags">加载答卷中…</p>}
            {drawerDetail && drawerDetail.observations.length === 0 && (
              <p className="drawer-tags">该 Prompt 暂无答卷。</p>
            )}
          </aside>
        </div>
      )}
      <ReviewDetectedBrandsModal
        open={detectedOpen}
        workspaceId={workspaceId}
        onClose={() => setDetectedOpen(false)}
        notify={notify}
        onChanged={() => {
          void loadDashboard(workspaceId ?? undefined);
        }}
        onOpenSettings={(tab) => {
          setSettingsTab(tab);
          changePage("brand-settings");
        }}
      />
      <GenerateReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        overview={overview}
        citations={citations}
        rangeLabel={dateRange.label}
        engineLabel={engine}
        tagLabel={tag}
        marketLabel={market || "All markets"}
        brandName={overview?.brandName || workspaceName}
      />
      {toast && (
        <div className="toast">
          <span>✓</span>
          {toast}
        </div>
      )}
    </div>
  );
}

function Overview({
  data,
  onOpenPrompts,
  onOpenRecs,
  onOpenCitations,
  onOpenDetected,
}: {
  data: OverviewMetrics;
  onOpenPrompts: () => void;
  onOpenRecs: () => void;
  onOpenCitations: () => void;
  onOpenDetected: () => void;
}) {
  const [mePlus, setMePlus] = useState<"top5" | "all">("top5");
  const [mePlusOpen, setMePlusOpen] = useState(false);
  const mePlusRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mePlusOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!mePlusRef.current?.contains(e.target as Node)) setMePlusOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMePlusOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [mePlusOpen]);

  const colorByBrand = useMemo(() => {
    const map = new Map<string, string>();
    data.ranking.forEach((row, i) => {
      map.set(row.brandId, TREND_PALETTE[i % TREND_PALETTE.length]);
    });
    return map;
  }, [data.ranking]);

  const visibleBrandIds = useMemo(() => {
    const primary = data.ranking.find((r) => r.isPrimary);
    const competitors = data.ranking.filter((r) => !r.isPrimary);
    const picked =
      mePlus === "all"
        ? [primary, ...competitors]
        : [primary, ...competitors.slice(0, 5)];
    return new Set(
      picked.filter(Boolean).map((r) => r!.brandId),
    );
  }, [data.ranking, mePlus]);

  const series = useMemo(() => {
    const all = trendSeries(data.trend).filter((s) =>
      visibleBrandIds.has(s.brandId),
    );
    // Keep primary first, then competitors by ranking order.
    const order = data.ranking
      .filter((r) => visibleBrandIds.has(r.brandId))
      .map((r) => r.brandId);
    return order
      .map((id) => all.find((s) => s.brandId === id))
      .filter(Boolean) as Array<{
      brandId: string;
      name: string;
      values: number[];
    }>;
  }, [data.trend, data.ranking, visibleBrandIds]);

  const colors = series.map(
    (s) => colorByBrand.get(s.brandId) || TREND_PALETTE[0],
  );
  const mePlusLabel =
    mePlus === "all" ? "Me + all competitors" : "Me + Top 5 competitors";

  return (
    <>
      <div className="notice">
        <span>✦</span>
        <div>
          <b>{data.notice.title}</b>
          <p>
            基于 {data.promptTotal} 个 Prompt、{data.observationCount} 条答卷。
            {data.notice.body}
          </p>
        </div>
        <button onClick={onOpenRecs}>查看建议 →</button>
      </div>
      <div className="metric-grid">
        {data.metrics.map((metric, index) => (
          <article className={`metric-card ${metric.tone}`} key={metric.label}>
            <div className="metric-top">
              <span>{metric.label}</span>
              <InfoTip text={metric.hint} />
            </div>
            <div className="metric-value">
              <strong>{metric.value}</strong>
              {metric.suffix && <small>{metric.suffix}</small>}
            </div>
            <div className="metric-foot">
              <span className={metric.delta.startsWith("+") ? "delta-up" : metric.delta.startsWith("-") ? "delta-down" : ""}>
                {metric.delta}
              </span>
              <small>{metric.delta === "—" ? "暂无上期对比" : "较上一周期"}</small>
            </div>
            <Sparkline color={["#31b981", "#4d7cf3", "#7d6bf2", "#e2a640"][index]} />
          </article>
        ))}
      </div>

      <div className="dashboard-grid overview-top">
        <article className="panel trend-panel">
          <div className="panel-head">
            <PanelTitle
              title="Brand Coverage Over Time"
              tip="选定时间范围内，本品与竞品在 AI 答卷中的日覆盖率走势。可用右上角 Me+ 切换 Top 5 / 全部竞品；点击图例可显隐曲线。"
            />
            <div className="me-plus" ref={mePlusRef}>
              <button
                type="button"
                className={`me-plus-trigger${mePlusOpen ? " open" : ""}`}
                aria-haspopup="listbox"
                aria-expanded={mePlusOpen}
                onClick={() => setMePlusOpen((v) => !v)}
              >
                <span>{mePlusLabel}</span>
                <em aria-hidden>▾</em>
              </button>
              {mePlusOpen && (
                <ul className="me-plus-menu" role="listbox">
                  <li>
                    <button
                      type="button"
                      role="option"
                      aria-selected={mePlus === "all"}
                      className={mePlus === "all" ? "active" : ""}
                      onClick={() => {
                        setMePlus("all");
                        setMePlusOpen(false);
                      }}
                    >
                      Me + all competitors
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      role="option"
                      aria-selected={mePlus === "top5"}
                      className={mePlus === "top5" ? "active" : ""}
                      onClick={() => {
                        setMePlus("top5");
                        setMePlusOpen(false);
                      }}
                    >
                      Me + Top 5 competitors
                    </button>
                  </li>
                </ul>
              )}
            </div>
          </div>
          <div className="trend-body">
            <TrendCoverageChart trend={data.trend} series={series} colors={colors} />
          </div>
        </article>
        <div className="kpi-column">
          <article className="panel kpi-stack">
            <KpiTitle
              title="Your Brand Mentions"
              tip="监测周期内，本品在 AI 答卷中被提及的总次数。下方列出主要竞品的提及量，便于对比声量规模。"
            />
            <div className="kpi-hero">{data.primaryMentions}</div>
            <div className="kpi-list">
              {data.competitorMentions.map((c) => {
                const brand = data.ranking.find((r) => r.name === c.name);
                const color =
                  (brand && colorByBrand.get(brand.brandId)) || c.color;
                return (
                  <div className="kpi-mini" key={c.name}>
                    <span>
                      <i className="kpi-dot" style={{ background: color }} />
                      {c.name}
                    </span>
                    <b>{c.value}</b>
                  </div>
                );
              })}
            </div>
          </article>
          <article className="panel kpi-stack">
            <KpiTitle
              title="Your Average Brand Position"
              tip="本品在答卷品牌列表中的平均出现位次。1 表示最常被首先提到；数值越小越好，反映推荐优先级而非仅是否出现。"
            />
            <div className="kpi-hero">
              {data.avgPosition == null ? "—" : data.avgPosition.toFixed(2)}
            </div>
            <div className="kpi-list">
              {data.competitorPositions.map((c) => {
                const brand = data.ranking.find((r) => r.name === c.name);
                const color =
                  (brand && colorByBrand.get(brand.brandId)) || c.color;
                return (
                  <div className="kpi-mini" key={c.name}>
                    <span>
                      <i className="kpi-dot" style={{ background: color }} />
                      {c.name}
                    </span>
                    <b>{c.value.toFixed(2)}</b>
                  </div>
                );
              })}
            </div>
          </article>
        </div>
      </div>

      <div className="twin-tables">
        <article className="panel table-panel">
          <div className="panel-head">
            <PanelTitle
              title="品牌排名"
              tip="按提及次数、覆盖率与 Share of Voice 汇总的品牌竞争榜。情感为启发式得分，悬停可查看估算分布。"
            />
            <button type="button" className="secondary-button" onClick={onOpenDetected}>
              更多已发现品牌
            </button>
          </div>
          <div className="table-scroll">
            <table className="compact-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>名称</th>
                  <th>情感</th>
                  <th>提及</th>
                  <th>覆盖率</th>
                  <th>SOV</th>
                </tr>
              </thead>
              <tbody>
                {data.ranking.slice(0, 6).map((r, i) => (
                  <tr key={r.brandId}>
                    <td>{i + 1}</td>
                    <td>
                      <span
                        className="comp-dot"
                        style={{
                          background: colorByBrand.get(r.brandId) || r.color,
                          display: "inline-grid",
                          marginRight: 6,
                        }}
                      >
                        {r.name.slice(0, 1)}
                      </span>
                      <b>{r.name}</b>
                      {r.isPrimary && <small className="you-label">你</small>}
                    </td>
                    <SentimentCell row={r} />
                    <td>{r.mentions}</td>
                    <td>{r.coverage}%</td>
                    <td>{r.sovPercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
        <article className="panel table-panel">
          <div className="panel-head">
            <PanelTitle
              title="Top Prompts by Brand Mentions"
              tip="本品被提及次数最多的监测问题。可用于识别高可见话题，并下钻到具体答卷。"
            />
            <button className="text-button" onClick={onOpenPrompts}>
              查看完整报告
            </button>
          </div>
          <div className="table-scroll">
            <table className="compact-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Prompt</th>
                  <th>提及</th>
                </tr>
              </thead>
              <tbody>
                {data.topPromptsByMentions.slice(0, 6).map((p, i) => (
                  <tr key={p.promptId}>
                    <td>{i + 1}</td>
                    <td>
                      <b className="prompt-name">
                        <PromptHoverText text={p.q} />
                      </b>
                    </td>
                    <td>{p.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>

      <BrandVisibilityIndexPanel
        bvi={data.bvi ?? { coverageMid: 50, likelihoodMid: 50, frames: [] }}
        colorByBrand={colorByBrand}
      />

      <div className="dashboard-grid overview-top" style={{ marginTop: 16 }}>
        <article className="panel trend-panel">
          <div className="panel-head">
            <PanelTitle
              title="域名覆盖"
              tip={`各 AI 引擎答卷中，本品官网域名被引用的覆盖率（当前 ${data.domainCoverage}%）。品牌被提及但官网未被引用时，说明存在可引用性缺口。`}
            />
            <button className="text-button" onClick={onOpenCitations}>
              完整引用 →
            </button>
          </div>
          <div className="trend-body">
            <div className="engine-list">
              {data.engines.map((e) => (
                <div className="engine-row" key={e.code}>
                  <span className="engine-logo" style={{ background: e.color }}>
                    {e.mark}
                  </span>
                  <div className="engine-info">
                    <div>
                      <b>{e.name}</b>
                      <span>{e.coverage}%</span>
                    </div>
                    <div className="progress">
                      <i style={{ width: `${e.coverage}%`, background: e.color }} />
                    </div>
                  </div>
                  <span>{e.change}</span>
                </div>
              ))}
            </div>
          </div>
        </article>
        <div className="kpi-column">
          <article className="panel kpi-stack">
            <KpiTitle
              title="Domain Citation"
              tip="本品官网域名在答卷引用中出现的总次数。下方为主要竞品域名的引用量对比。"
            />
            <div className="kpi-hero">{data.domainCitations}</div>
            <div className="kpi-list">
              {data.competitorDomainCites.map((c) => (
                <div className="kpi-mini" key={c.name}>
                  <span>
                    <i className="kpi-dot" style={{ background: c.color }} />
                    {c.name}
                  </span>
                  <b>{c.value}</b>
                </div>
              ))}
            </div>
          </article>
          <article className="panel kpi-stack">
            <KpiTitle
              title="Citations Share"
              tip="本品引用次数占全部引用的份额。下方列出高引用 URL，可识别 AI 搜索中的「赢家页面」。"
            />
            <div className="kpi-hero">{data.citationShare}%</div>
            <div className="kpi-list">
              {data.topCitedUrls.slice(0, 3).map((u) => (
                <div className="kpi-mini" key={u.url}>
                  <span title={u.url}>{u.title || u.url}</span>
                  <b>{u.cited}</b>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>

      <div className="twin-tables">
        <article className="panel table-panel">
          <div className="panel-head">
            <PanelTitle
              title="域名引用"
              subtitle="按引用次数排序"
              tip="所有被 AI 答卷引用的域名排行。份额 = 该域名引用次数 ÷ 全部引用次数。"
            />
          </div>
          <div className="table-scroll">
            <table className="compact-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>域名</th>
                  <th>份额</th>
                  <th>次数</th>
                </tr>
              </thead>
              <tbody>
                {data.domainCitationTable.map((d, i) => (
                  <tr key={d.domain}>
                    <td>{i + 1}</td>
                    <td>
                      <b>{d.domain}</b>
                    </td>
                    <td>{d.share}%</td>
                    <td>{d.citations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
        <article className="panel table-panel">
          <div className="panel-head">
            <PanelTitle
              title="按官网引用的 Top Prompts"
              subtitle="本品域名被引用最多的问题"
              tip="本品官网被引用次数最多的监测问题。适合优先做内容强化与 GEO 优化。"
            />
          </div>
          <div className="table-scroll">
            <table className="compact-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Prompt</th>
                  <th>引用</th>
                </tr>
              </thead>
              <tbody>
                {data.topPromptsByDomainCites.map((p, i) => (
                  <tr key={p.promptId}>
                    <td>{i + 1}</td>
                    <td>
                      <b className="prompt-name">
                        <PromptHoverText text={p.q} />
                      </b>
                    </td>
                    <td>{p.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </>
  );
}

function Prompts({
  query,
  setQuery,
  market,
  setMarket,
  markets,
  rows,
  total,
  onOpen,
}: {
  query: string;
  setQuery: (s: string) => void;
  market: string;
  setMarket: (s: string) => void;
  markets: string[];
  rows: PromptMetricRow[];
  total: number;
  onOpen: (r: PromptMetricRow) => void;
  notify: (s: string) => void;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    setPage(1);
  }, [query, market, rows.length]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize) || 1);
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);
  const viewEnd = Math.min(start + pageRows.length, rows.length);

  const COMP_COLORS = [
    "#5b68ef",
    "#FF8A22",
    "#7CB342",
    "#8D6E32",
    "#D27B7E",
    "#4A90A4",
  ];

  return (
    <div className="panel table-panel">
      <div className="table-toolbar">
        <div className="search-box">
          <span>⌕</span>
          <input
            placeholder="Search by prompt"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          className="orbis-select"
          value={market}
          onChange={(e) => setMarket(e.target.value)}
          aria-label="市场"
        >
          <option value="">全部市场</option>
          {markets.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <div className="spacer" />
      </div>
      <div className="table-scroll">
        <table className="prompts-table">
          <thead>
            <tr>
              <th>Prompt</th>
              <th>品牌覆盖率</th>
              <th>情感</th>
              <th>意图量</th>
              <th>品牌提及</th>
              <th>全品牌提及</th>
              <th>域名引用</th>
              <th>全部域名引用</th>
              <th>竞品</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => {
              const bd = row.sentimentBreakdown;
              const comps =
                row.competitors?.length
                  ? row.competitors
                  : row.competitor && row.competitor !== "—"
                    ? row.competitor.split(",").map((s) => s.trim()).filter(Boolean)
                    : [];
              return (
                <tr key={row.promptId}>
                  <td>
                    <b className="prompt-name">
                      <PromptHoverText text={row.q} />
                    </b>
                    {row.tag ? <span className="tag">{row.tag}</span> : null}
                  </td>
                  <td>
                    <div className="coverage">
                      <b>{row.coverage}%</b>
                      <i>
                        <em style={{ width: `${row.coverage}%` }} />
                      </i>
                    </div>
                  </td>
                  <td>
                    <div className="prompt-sentiment">
                      <span
                        className={`sentiment-value ${row.sentiment >= 70 ? "good" : "neutral"}`}
                      >
                        +{row.sentiment}
                      </span>
                      {bd ? (
                        <span className="prompt-sentiment-stack" title="情感估算">
                          <i
                            style={{
                              width: `${bd.negativePct}%`,
                              background: "#ef4444",
                            }}
                          />
                          <i
                            style={{
                              width: `${bd.neutralPct}%`,
                              background: "#f59e0b",
                            }}
                          />
                          <i
                            style={{
                              width: `${bd.positivePct}%`,
                              background: "#22c55e",
                            }}
                          />
                        </span>
                      ) : (
                        <span className="track">
                          <em style={{ width: `${row.sentiment}%` }} />
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="intent-chip">{row.intentVolume}</span>
                  </td>
                  <td>{row.brandMentions}</td>
                  <td>{row.totalBrandMentions}</td>
                  <td>{row.domainMentions}</td>
                  <td>{row.totalDomainCitations ?? row.domainMentions}</td>
                  <td>
                    <div className="comp-pills">
                      {comps.slice(0, 4).map((name, i) => (
                        <i
                          key={`${row.promptId}-${name}`}
                          style={{ background: COMP_COLORS[i % COMP_COLORS.length] }}
                          title={name}
                        >
                          {name.slice(0, 1).toUpperCase()}
                        </i>
                      ))}
                      {comps.length > 4 ? (
                        <span className="comp-more">+{comps.length - 4}</span>
                      ) : null}
                      {comps.length === 0 ? (
                        <span className="muted">—</span>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="bs-link"
                      onClick={() => onOpen(row)}
                    >
                      详情
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="pagination prompts-pagination">
        <span>
          Viewing {rows.length ? start + 1 : 0}–{viewEnd} of {total} results
        </span>
        <div className="prompts-pager-controls">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ‹
          </button>
          <span className="prompts-page-num">{safePage}</span>
          <button
            type="button"
            disabled={safePage >= pageCount}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
          >
            ›
          </button>
          <select
            className="orbis-select"
            value={String(pageSize)}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            <option value="20">20 / page</option>
            <option value="50">50 / page</option>
            <option value="100">100 / page</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function UrlDeltaList({
  rows,
  emptyText,
  tone,
}: {
  rows: CitedUrlRow[];
  emptyText: string;
  tone: "up" | "down";
}) {
  if (!rows.length) {
    return <div className="empty-delta">{emptyText}</div>;
  }
  return (
    <ul className="wl-list">
      {rows.map((row) => {
        const delta = row.delta ?? 0;
        const label = delta > 0 ? `+${delta}` : String(delta);
        return (
          <li key={row.url}>
            <div>
              <b>{row.title || row.domain}</b>
              <small>{row.domain}</small>
            </div>
            <div className="wl-meta">
              <strong>{row.cited}</strong>
              <em className={tone === "up" ? "delta-up" : "delta-down"}>{label}</em>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Citations({
  data,
  onOpenPrompts,
}: {
  data: CitationsMetrics;
  onOpenPrompts: () => void;
}) {
  const own = data.structure[0]?.percent ?? 0;
  return (
    <>
      <div className="wl-grid">
        <article className="panel">
          <div className="panel-head">
            <div>
              <h3>Top Winners</h3>
              <p>相对上一周期引用上升的来源</p>
            </div>
          </div>
          <UrlDeltaList
            rows={data.winners}
            tone="up"
            emptyText="当前时间窗暂无上升来源"
          />
        </article>
        <article className="panel">
          <div className="panel-head">
            <div>
              <h3>Top Losers</h3>
              <p>相对上一周期引用下降的来源</p>
            </div>
          </div>
          <UrlDeltaList
            rows={data.losers}
            tone="down"
            emptyText="当前时间窗暂无下降来源"
          />
        </article>
      </div>
      <div className="citation-cards">
        <article className="panel citation-summary">
          <span className="eyebrow">引用结构</span>
          <div className="citation-donut">
            <Donut value={own} color={data.structure[0]?.color ?? "#4f67ef"} />
            <div>
              <h3>{data.totalCitations}</h3>
              <p>总引用次数</p>
            </div>
          </div>
          <ul>
            {data.structure.slice(0, 4).map((s) => (
              <li key={s.label}>
                <i style={{ background: s.color }} />
                {s.label} <b>{s.percent}%</b>
              </li>
            ))}
          </ul>
        </article>
        <article className="panel table-panel">
          <div className="panel-head">
            <div>
              <h3>域名引用</h3>
              <p>
                份额与次数
                {data.domains.some((d) => d.growth !== "—") ? " · 含环比" : ""}
              </p>
            </div>
          </div>
          <div className="table-scroll">
            <table className="compact-table">
              <thead>
                <tr>
                  <th>域名</th>
                  <th>份额</th>
                  <th>次数</th>
                  <th>环比</th>
                </tr>
              </thead>
              <tbody>
                {data.domainCitations.slice(0, 8).map((d) => {
                  const growth =
                    data.domains.find((x) => x.domain === d.domain)?.growth ?? "—";
                  return (
                    <tr key={d.domain}>
                      <td>
                        <b>{d.domain}</b>
                      </td>
                      <td>{d.share}%</td>
                      <td>{d.citations}</td>
                      <td>
                        <span
                          className={
                            growth.startsWith("+")
                              ? "delta-up"
                              : growth.startsWith("-")
                                ? "delta-down"
                                : ""
                          }
                        >
                          {growth}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>
      </div>
      <div className="panel table-panel">
        <div className="panel-head">
          <div>
            <h3>全部引用 URL</h3>
            <p>按引用次数排序 · 星标仅展示</p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th />
                <th>URL</th>
                <th>Cited</th>
                <th>品牌提及</th>
                <th>域名</th>
                <th>类型</th>
                <th>竞品</th>
              </tr>
            </thead>
            <tbody>
              {data.urls.map((r) => (
                <tr key={r.url}>
                  <td className="star-col">☆</td>
                  <td className="url-cell">
                    <b>{r.title || r.domain}</b>
                    <small>{r.url}</small>
                  </td>
                  <td>
                    <b>{r.cited}</b>
                  </td>
                  <td>
                    <span className={r.brandMentioned === "yes" ? "mention-yes" : "mention-no"}>
                      {r.brandMentioned === "yes" ? "Yes" : "No"}
                    </span>
                  </td>
                  <td>{r.domain}</td>
                  <td>
                    <span className="source-type">{r.category}</span>
                  </td>
                  <td>
                    <div className="comp-pills">
                      {r.competitors.map((c) => (
                        <span
                          key={c.brandId}
                          className="comp-pill"
                          title={c.name}
                          style={{ background: c.color }}
                        >
                          {c.mark || c.name.slice(0, 1)}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="panel table-panel" style={{ marginTop: 14 }}>
        <div className="panel-head">
          <div>
            <h3>按官网引用的 Top Prompts</h3>
          </div>
          <button className="text-button" onClick={onOpenPrompts}>
            查看 Prompts →
          </button>
        </div>
        <div className="table-scroll">
          <table className="compact-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Prompt</th>
                <th>引用</th>
              </tr>
            </thead>
            <tbody>
              {data.topPromptsByDomainCites.map((p, i) => (
                <tr key={p.promptId}>
                  <td>{i + 1}</td>
                  <td>
                    <b className="prompt-name">{p.q}</b>
                  </td>
                  <td>{p.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function Recommendations({
  overview,
  notify,
}: {
  overview: OverviewMetrics | null;
  notify: (s: string) => void;
}) {
  const items = overview?.actions ?? [];
  return (
    <>
      <section className="audit-hero">
        <div>
          <span className="eyebrow">RECOMMENDATIONS · 基于监测库</span>
          <h2>
            {overview ? overview.brandName : "品牌"} 优先行动
          </h2>
          <p>
            {overview
              ? `覆盖率、官网引用份额与高频第三方来源已接入真实答卷。共 ${items.length} 条建议。`
              : "加载监测数据后生成建议。"}
          </p>
        </div>
      </section>
      <div className="panel audit-list">
        <div className="panel-head">
          <div>
            <h3>优化建议</h3>
            <p>按影响优先级排序</p>
          </div>
        </div>
        {items.map((item, i) => (
          <div className="audit-item" key={item.title}>
            <span className="audit-score">{90 - i * 6}</span>
            <div className="audit-copy">
              <div>
                <b>{item.title}</b>
                <span>{item.category}</span>
              </div>
              <p>{item.description}</p>
              <div className="audit-meta">
                <span>
                  影响{" "}
                  <b className={item.priority === "高" ? "danger-text" : "warn-text"}>
                    {item.priority}
                  </b>
                </span>
              </div>
            </div>
            <button onClick={() => notify(`已打开「${item.title}」执行指南`)}>
              查看指南 →
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <div className="empty-delta" style={{ margin: 18 }}>
            暂无建议
          </div>
        )}
      </div>
    </>
  );
}

function Reports({
  notify,
  brandName,
}: {
  notify: (s: string) => void;
  brandName: string;
}) {
  const reports = [
    {
      title: "AI 搜索月度表现报告",
      type: "管理层摘要",
      date: "2026年8月5日",
      status: "已生成",
    },
    {
      title: `${brandName} 竞品可见度分析`,
      type: "品牌报告",
      date: "2026年8月5日",
      status: "已生成",
    },
  ];
  return (
    <>
      <section className="report-hero">
        <div>
          <span className="eyebrow">REPORT BUILDER</span>
          <h2>把 AI 可见度数据变成清晰的决策</h2>
          <p>快速生成适合团队周会、客户汇报和管理层审阅的专业报告。</p>
        </div>
        <button onClick={() => notify("报告创建器将在下一期接入真实导出")}>＋ 创建报告</button>
      </section>
      <div className="panel reports-list">
        <div className="panel-head">
          <div>
            <h3>最近报告</h3>
            <p>基于当前监测工作区</p>
          </div>
        </div>
        {reports.map((r) => (
          <div className="report-row" key={r.title}>
            <span className="file-icon">▤</span>
            <div>
              <b>{r.title}</b>
              <small>
                {r.type} · {r.date}
              </small>
            </div>
            <span className="generated">{r.status}</span>
            <button onClick={() => notify(`正在打开「${r.title}」`)}>打开</button>
          </div>
        ))}
      </div>
    </>
  );
}
