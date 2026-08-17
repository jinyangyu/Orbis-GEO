"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ContentArticles from "../content-articles";
import BrandSettings, { type BrandSettingsTab } from "../brand-settings";
import GenerateReportModal from "../generate-report-modal";
import Onboarding, { resetOnboardingStorage } from "../onboarding";
import { PromptResearch } from "../prompt-research";
import ReportFilters from "../report-filters";
import ReviewDetectedBrandsModal from "../review-detected-brands-modal";
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
import { isAllTagsLabel } from "@/lib/metrics/filters";
import { initLocaleFromStorage, t } from "@/lib/i18n";
import { buildPresetRange, type DateRangeValue } from "@/lib/report/date-range";
import type {
  CitationsMetrics,
  OverviewMetrics,
  PromptDetailMetrics,
  PromptMetricRow,
  PromptsMetrics,
  WorkspaceListItem,
} from "@/lib/metrics/types";
import type { WorkspacePayload } from "@/lib/onboarding/types";
import { Citations } from "./citations";
import { FilterEmptyStage } from "./filter-empty";
import { navGroups } from "./nav";
import { NotificationBell } from "./notification-bell";
import { Overview } from "./overview";
import { OverviewSkeleton, TablePageSkeleton } from "./skeleton";
import { Prompts } from "./prompts";
import { Recommendations } from "./recommendations";
import { Reports } from "./reports";
import { Billing } from "./billing";
import { LEAF_PAGES, pageFromHash, type PageKey } from "./types";
import { checkNotificationsClient } from "@/lib/notifications/client";
function workspaceItemLabel(w: WorkspaceListItem) {
  return (w.reportTitle || w.brandName || w.name || "").trim() || "未命名工作区";
}

const BRAND_CLUSTER: PageKey[] = [
  "overview",
  "prompts",
  "citations",
  "recommendations",
  "brand-settings",
];

function brandClusterLabel(page: PageKey): string {
  if (page === "overview") return "总览";
  if (page === "prompts") return "Prompts";
  if (page === "citations") return "引用";
  if (page === "recommendations") return "建议";
  return "品牌设置";
}

function CrumbNav({
  items,
}: {
  items: Array<{ label: string; onSelect?: () => void }>;
}) {
  return (
    <nav className="crumb" aria-label="面包屑">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <Fragment key={`${item.label}-${i}`}>
            {i > 0 ? <i>/</i> : null}
            {last ? (
              <b>{item.label}</b>
            ) : item.onSelect ? (
              <button type="button" className="crumb-link" onClick={item.onSelect}>
                {item.label}
              </button>
            ) : (
              <span>{item.label}</span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

const BRAND_REPORT_PAGES: PageKey[] = [
  "overview",
  "prompts",
  "citations",
  "recommendations",
];

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.07 7.07 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.55-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.8 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.92 14.16a.5.5 0 0 0-.12.64l1.92 3.32c.13.23.4.32.64.22l2.39-.96c.5.39 1.04.7 1.63.94l.36 2.54c.05.24.26.42.5.42h3.8c.24 0 .45-.18.5-.42l.36-2.54c.59-.24 1.13-.55 1.63-.94l2.39.96c.24.1.51 0 .64-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"
      />
    </svg>
  );
}

export default function DashboardShell() {
  const [experience, setExperience] = useState<"onboarding" | "dashboard">("dashboard");
  const [page, setPage] = useState<PageKey>("overview");
  const [dateRange, setDateRange] = useState<DateRangeValue>(() =>
    buildPresetRange("30"),
  );
  const [engine, setEngine] = useState(() => t("filter.allEngines"));
  const [tag, setTag] = useState(() => t("filter.allTags"));
  const [query, setQuery] = useState("");
  const [market, setMarket] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportSeedType, setReportSeedType] = useState<"document" | "presentation">(
    "document",
  );
  const [detectedOpen, setDetectedOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<BrandSettingsTab>("details");
  const [drawerPrompt, setDrawerPrompt] = useState<PromptMetricRow | null>(null);
  const [drawerDetail, setDrawerDetail] = useState<PromptDetailMetrics | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState("");
  const [contentReload, setContentReload] = useState(0);
  const [notifyRefresh, setNotifyRefresh] = useState(0);
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
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [returnPage, setReturnPage] = useState<PageKey>("overview");
  const workspaceMenuRef = useRef<HTMLDivElement | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const overviewAbort = useRef<AbortController | null>(null);
  const promptsAbort = useRef<AbortController | null>(null);
  const citationsAbort = useRef<AbortController | null>(null);
  const promptsKeyRef = useRef("");
  const citationsKeyRef = useRef("");
  const notifyWsRef = useRef<string | null>(null);
  const workspaceIdRef = useRef<string | null>(null);

  useEffect(() => {
    initLocaleFromStorage();
  }, []);

  useEffect(() => {
    if (!workspaceMenuOpen && !accountMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const t = event.target as Node;
      if (workspaceMenuOpen && workspaceMenuRef.current && !workspaceMenuRef.current.contains(t)) {
        setWorkspaceMenuOpen(false);
      }
      if (accountMenuOpen && accountMenuRef.current && !accountMenuRef.current.contains(t)) {
        setAccountMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setWorkspaceMenuOpen(false);
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [workspaceMenuOpen, accountMenuOpen]);

  useEffect(() => {
    const sync = () => setPage(pageFromHash(window.location.hash));
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);

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
    setDateRange(buildPresetRange("30", new Date(), t("date.30")));
    setEngine(t("filter.allEngines"));
    setTag(t("filter.allTags"));
    setMarket("");
    setQuery("");
  };

  const loadDashboard = useCallback(
    async (preferredId?: string | null) => {
      overviewAbort.current?.abort();
      const incoming = preferredId ?? getStoredWorkspaceId() ?? workspaceIdRef.current;
      const switchingWorkspace = Boolean(
        incoming && workspaceIdRef.current && incoming !== workspaceIdRef.current,
      );
      if (switchingWorkspace) {
        promptsAbort.current?.abort();
        citationsAbort.current?.abort();
        setOverview(null);
        setPromptsData(null);
        setCitations(null);
        promptsKeyRef.current = "";
        citationsKeyRef.current = "";
        setLoadingPrompts(true);
        setLoadingCitations(true);
      }
      const ac = new AbortController();
      overviewAbort.current = ac;

      setLoadingOverview(true);
      setMetricsError("");

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
          workspaceIdRef.current = null;
          promptsAbort.current?.abort();
          citationsAbort.current?.abort();
          setWorkspaceId(null);
          setWorkspace(null);
          setOverview(null);
          setPromptsData(null);
          setCitations(null);
          setMetricsError("暂无监测数据，请先导入 inspection 答卷。");
          return;
        }
        workspaceIdRef.current = selected;
        setStoredWorkspaceId(selected);
        setWorkspaceId(selected);
        const [ws, ov] = await Promise.all([
          fetchWorkspaceById(selected, ac.signal),
          fetchOverviewMetrics(selected, {
            engine: engineCode,
            days: rangeDays,
            from: rangeFrom,
            to: rangeTo,
            market: market || undefined,
            signal: ac.signal,
          }),
        ]);
        setWorkspace(ws);
        setOverview(ov);
        if (notifyWsRef.current !== selected) {
          notifyWsRef.current = selected;
          void checkNotificationsClient(selected, ov.actions ?? [])
            .then(() => setNotifyRefresh((n) => n + 1))
            .catch(() => {
              /* tables may not exist yet */
            });
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (err instanceof Error && err.name === "AbortError") return;
        setMetricsError(err instanceof Error ? err.message : "加载失败");
      } finally {
        if (!ac.signal.aborted) setLoadingOverview(false);
      }
    },
    [engineCode, rangeDays, rangeFrom, rangeTo, market],
  );

  useEffect(() => {
    if (experience === "dashboard") void loadDashboard();
  }, [experience, loadDashboard]);

  useEffect(() => {
    if (experience !== "dashboard" || !workspaceId) return;
    if (
      page !== "prompts" &&
      page !== "overview" &&
      page !== "citations" &&
      page !== "recommendations"
    ) {
      return;
    }
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

  const overviewTopPrompts = useMemo(() => {
    const items = promptsData?.items ?? [];
    if (!items.length) return [];
    return [...items]
      .sort((a, b) => b.brandMentions - a.brandMentions || b.coverage - a.coverage)
      .slice(0, 6)
      .map((p) => ({ promptId: p.promptId, q: p.q, count: p.brandMentions }));
  }, [promptsData]);

  const filteredPrompts = useMemo(() => {
    const rows = promptsData?.items ?? [];
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchQ =
        !q || row.q.toLowerCase().includes(q) || row.tag.includes(query);
      const matchM = !market || row.market === market;
      const matchTag = isAllTagsLabel(tag) || row.tag === tag;
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
        onExit={() => setExperience("dashboard")}
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
    if (LEAF_PAGES.includes(key) && !LEAF_PAGES.includes(page)) {
      setReturnPage(page);
    }
    setPage(key);
    setMobileNav(false);
    setAccountMenuOpen(false);
    const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const there =
      key === "overview"
        ? `${window.location.pathname}${window.location.search}`
        : `${window.location.pathname}${window.location.search}#${key}`;
    if (here !== there) {
      window.history.pushState({ page: key }, "", there);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goHome = () => changePage("overview");
  const goBack = () => changePage(returnPage !== page ? returnPage : "overview");

  const selectWorkspace = (nextId: string) => {
    setWorkspaceMenuOpen(false);
    if (!nextId || nextId === workspaceId) return;
    const next = workspaceList.find((w) => w.id === nextId);
    if (!next) return;
    setStoredWorkspaceId(next.id);
    setWorkspaceId(next.id);
    setOverview(null);
    setWorkspace(null);
    setPromptsData(null);
    setCitations(null);
    promptsKeyRef.current = "";
    citationsKeyRef.current = "";
    notify(`已切换到 ${workspaceItemLabel(next)}`);
    void loadDashboard(next.id);
  };

  const toggleWorkspaceMenu = () => {
    if (workspaceList.length < 2) {
      notify("当前只有一个监测工作区");
      return;
    }
    setWorkspaceMenuOpen((open) => !open);
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
    billing: ["账单与套餐", "试用、升级、加购、发票与公司抬头。"],
  };

  const promptBadge = promptsData?.total ? String(promptsData.total) : undefined;
  const showBrandSettings = BRAND_REPORT_PAGES.includes(page);
  const showGenerateReport =
    page === "overview" || page === "citations" || page === "recommendations";
  const showExportCsv = page === "prompts";
  const hasPageActions = showBrandSettings || showGenerateReport || showExportCsv;
  const isLeafPage = LEAF_PAGES.includes(page);

  const exportPromptsCsv = () => {
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
    const escape = (v: string | number | null | undefined) => {
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
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <button
          type="button"
          className="brand"
          onClick={goHome}
          aria-label="返回总览"
        >
          <div className="brand-orbit">
            <i />
          </div>
          <div>
            <strong>ORBIS</strong>
            <span>AI SEARCH INTELLIGENCE</span>
          </div>
        </button>
        <div className="workspace-switch-wrap" ref={workspaceMenuRef}>
          <button
            type="button"
            className="workspace-switch"
            aria-haspopup="listbox"
            aria-expanded={workspaceMenuOpen}
            onClick={toggleWorkspaceMenu}
          >
            <span className="workspace-avatar">{workspaceInitial}</span>
            <span>
              <b>{workspaceName}</b>
              <small>
                {workspaceList.length > 1
                  ? `监测工作区 · 点击选择 (${workspaceList.length})`
                  : "监测工作区"}
              </small>
            </span>
            <em>⌄</em>
          </button>
          {workspaceMenuOpen ? (
            <div className="workspace-menu" role="listbox" aria-label="选择监测工作区">
              {workspaceList.map((w) => {
                const label = workspaceItemLabel(w);
                const active = w.id === workspaceId;
                return (
                  <button
                    key={w.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={active ? "active" : ""}
                    onClick={() => selectWorkspace(w.id)}
                  >
                    <b>{label}</b>
                    <small>
                      {w.brandDomain || w.slug}
                      {w.observationCount
                        ? ` · ${w.observationCount} 条答卷`
                        : ""}
                    </small>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
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
          <a href="/help" target="_blank" rel="noreferrer">
            <span>?</span>帮助与文档
          </a>
          <button
            type="button"
            className={page === "billing" ? "active" : ""}
            onClick={() => changePage("billing")}
          >
            <span>$</span>账单与套餐
          </button>
          <button
            onClick={() => {
              void resetOnboardingStorage().then(() => setExperience("onboarding"));
            }}
          >
            <span>↺</span>重新体验首次激活
          </button>
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
              <CrumbNav
                items={
                  BRAND_CLUSTER.includes(page)
                    ? [
                        { label: "品牌报告", onSelect: goHome },
                        { label: workspaceName, onSelect: goHome },
                        { label: brandClusterLabel(page) },
                      ]
                    : page === "billing"
                      ? [
                          { label: "工作台", onSelect: goHome },
                          { label: "账单与套餐" },
                        ]
                      : [
                          { label: "工作台", onSelect: goHome },
                          { label: titles[page][0] },
                        ]
                }
              />
              <div className="crumb-utils">
                <NotificationBell
                  workspaceId={workspaceId}
                  refreshToken={notifyRefresh}
                  onOpenRecommendations={() => changePage("recommendations")}
                />
                <div className="header-account" ref={accountMenuRef}>
                  <button
                    type="button"
                    className="crumb-avatar"
                    aria-label={`${profileName} 账户菜单`}
                    aria-haspopup="menu"
                    aria-expanded={accountMenuOpen}
                    title={profileName}
                    onClick={() => setAccountMenuOpen((open) => !open)}
                  >
                    {profileInitials}
                  </button>
                  {accountMenuOpen ? (
                    <div className="header-account-menu" role="menu">
                      <div className="header-account-meta">
                        <b>{profileName}</b>
                        <small>{profileEmail}</small>
                      </div>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => changePage("billing")}
                      >
                        账单与套餐
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
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
                  <button
                    type="button"
                    className="brand-mark"
                    onClick={goHome}
                    aria-label={`返回 ${workspaceName} 总览`}
                  >
                    {workspaceInitial}
                  </button>
                ) : null}
                <div>
                  <h1>
                    {page === "prompts"
                      ? t("prompts.title")
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
                    <p>{t("prompts.subtitle")}</p>
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
              {hasPageActions || isLeafPage ? (
                <div className="heading-actions">
                  {isLeafPage ? (
                    <button
                      type="button"
                      className="heading-back"
                      onClick={goBack}
                    >
                      ← 返回
                    </button>
                  ) : null}
                  {showBrandSettings ? (
                    <button
                      type="button"
                      className="settings-btn"
                      aria-label={t("action.settings")}
                      title={t("action.settings")}
                      onClick={() => {
                        setSettingsTab("details");
                        changePage("brand-settings");
                      }}
                    >
                      <GearIcon />
                    </button>
                  ) : null}
                  {showGenerateReport ? (
                    <button
                      type="button"
                      className="generate-report-btn"
                      onClick={() => setReportOpen(true)}
                      disabled={!overview}
                    >
                      <span aria-hidden>⬇</span>
                      {t("action.generateReport")}
                    </button>
                  ) : null}
                  {showExportCsv ? (
                    <button
                      type="button"
                      className="generate-report-btn"
                      onClick={exportPromptsCsv}
                    >
                      <span aria-hidden>⬇</span>
                      {t("action.exportCsv")}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {page !== "content" &&
            page !== "research" &&
            page !== "brand-settings" &&
            page !== "billing" && (
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
              busy={loadingOverview}
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

          {metricsError &&
            page !== "content" &&
            page !== "research" &&
            page !== "billing" && (
            <div className="notice">
              <span>!</span>
              <div>
                <b>数据加载提示</b>
                <p>{metricsError}</p>
              </div>
            </div>
          )}
          {page === "overview" && (
            <Overview
              data={overview}
              loadingCore={loadingOverview}
              loadingPrompts={loadingPrompts || promptsData == null}
              topPromptRows={overviewTopPrompts}
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
          {page === "prompts" && loadingPrompts ? (
            <TablePageSkeleton title="Prompts" />
          ) : page === "prompts" && promptsData ? (
            <FilterEmptyStage empty={filteredPrompts.length === 0}>
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
            </FilterEmptyStage>
          ) : null}
          {page === "citations" && loadingCitations ? (
            <TablePageSkeleton title="引用分析" />
          ) : page === "citations" && citations ? (
            <FilterEmptyStage empty={citations.totalCitations === 0}>
            <Citations
              data={citations}
              workspaceId={workspaceId}
              onOpenPrompts={() => changePage("prompts")}
              notify={notify}
            />
            </FilterEmptyStage>
          ) : null}
          {page === "recommendations" && loadingOverview ? (
            <OverviewSkeleton />
          ) : page === "recommendations" ? (
            <FilterEmptyStage
              empty={Boolean(overview && overview.observationCount === 0)}
            >
            <Recommendations overview={overview} notify={notify} />
            </FilterEmptyStage>
          ) : null}
          {page === "reports" && (
            <Reports
              workspaceId={workspaceId}
              notify={notify}
              brandName={workspaceName}
              onGoOverview={() => {
                changePage("overview");
                setReportOpen(true);
              }}
              onRegenerate={(row) => {
                if (row.filters.reportType === "presentation") {
                  /* initial type applied when modal opens via key below */
                }
                setReportSeedType(
                  row.filters.reportType === "presentation"
                    ? "presentation"
                    : "document",
                );
                changePage("overview");
                setReportOpen(true);
              }}
            />
          )}
          {page === "content" && (
            <ContentArticles notify={notify} reloadToken={contentReload} />
          )}
          {page === "billing" && (
            <Billing
              promptUsed={promptsData?.total ?? overview?.promptTotal ?? 0}
              workspaceCount={workspaceList.length}
              notify={notify}
            />
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
        onClose={() => {
          setReportOpen(false);
          setReportSeedType("document");
        }}
        overview={overview}
        citations={citations}
        rangeLabel={dateRange.label}
        engineLabel={engine}
        tagLabel={tag}
        marketLabel={market || t("filter.allMarkets")}
        brandName={overview?.brandName || workspaceName}
        workspaceId={workspaceId}
        rangeFrom={rangeFrom}
        rangeTo={rangeTo}
        rangeDays={rangeDays}
        initialReportType={reportSeedType}
        onRegistered={() => {
          if (page === "reports") {
            /* Reports remount reload via workspaceId; nudge by toast */
            notify("报告已登记到报告中心");
          }
        }}
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
