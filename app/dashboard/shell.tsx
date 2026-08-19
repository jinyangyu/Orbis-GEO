"use client";

import { Fragment, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import ContentArticles from "../content-articles";
import BrandSettings, { type BrandSettingsTab } from "../brand-settings";
import GenerateReportModal from "../generate-report-modal";
import Onboarding, { resetOnboardingStorage } from "../onboarding";
import { PromptResearch } from "../prompt-research";
import ReportFilters from "../report-filters";
import ReviewDetectedBrandsModal from "../review-detected-brands-modal";
import { isAllTagsLabel } from "@/lib/metrics/filters";
import { initLocaleFromStorage, t } from "@/lib/i18n";
import { buildPresetRange, type DateRangeValue } from "@/lib/report/date-range";
import type { PromptMetricRow, WorkspaceListItem } from "@/lib/metrics/types";
import { Citations } from "./citations";
import { useDashboardData } from "./use-dashboard-data";
import { FilterEmptyStage } from "./filter-empty";
import { brandReportItems, navGroups } from "./nav";
import { NotificationBell } from "./notification-bell";
import { Overview } from "./overview";
import { RecommendationsSkeleton, TablePageSkeleton } from "./skeleton";
import { Prompts } from "./prompts";
import { Recommendations } from "./recommendations";
import { Reports } from "./reports";
import { Billing, TrialBanner } from "./billing";
import { BrandRailMenu, NavRailIcon, RailTip, SIDEBAR_COLLAPSED_KEY, SidebarToggleIcon } from "./sidebar-rail";
import { BrandLogo } from "./brand-logo";
import { LEAF_PAGES, pageFromHash, type PageKey } from "./types";
import {
  loadBillingState,
  saveBillingState,
  type BillingState,
} from "@/lib/billing/plans";
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
  if (page === "prompts") return t("nav.prompts");
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

function subscribeSidebarCollapsed(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("orbis-sidebar-collapsed", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("orbis-sidebar-collapsed", onChange);
  };
}

function getSidebarCollapsed() {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribeDesktopLayout(onChange: () => void) {
  const mq = window.matchMedia("(min-width: 761px)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getDesktopLayout() {
  return window.matchMedia("(min-width: 761px)").matches;
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
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState("");
  const [contentReload, setContentReload] = useState(0);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [billingManageOpen, setBillingManageOpen] = useState(false);
  const [billingState, setBillingState] = useState<BillingState>(() => loadBillingState());
  const [plansFocusTick, setPlansFocusTick] = useState(0);
  const [returnPage, setReturnPage] = useState<PageKey>("overview");
  const [expandedBrandIds, setExpandedBrandIds] = useState<Set<string>>(() => new Set());
  const sidebarCollapsed = useSyncExternalStore(
    subscribeSidebarCollapsed,
    getSidebarCollapsed,
    () => false,
  );
  const desktopLayout = useSyncExternalStore(
    subscribeDesktopLayout,
    getDesktopLayout,
    () => true,
  );
  const [brandRailOpen, setBrandRailOpen] = useState(false);
  const [brandRailPos, setBrandRailPos] = useState({ top: 0, left: 0 });
  const brandRailBtnRef = useRef<HTMLButtonElement | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  const {
    workspace,
    workspaceList,
    workspaceId,
    overview,
    promptsData,
    citations,
    loadingOverview,
    loadingPrompts,
    loadingCitations,
    metricsError,
    drawerDetail,
    notifyRefresh,
    overviewTopPrompts,
    engineOptions,
    tagOptions,
    marketOptions,
    loadDashboard,
    switchWorkspace,
    invalidatePrompts,
  } = useDashboardData({
    experience,
    page,
    dateRange,
    engine,
    market,
    reportOpen,
    drawerPrompt,
  });

  useEffect(() => {
    initLocaleFromStorage();
  }, []);

  useEffect(() => {
    if (!workspaceId || !BRAND_CLUSTER.includes(page)) return;
    setExpandedBrandIds((prev) => {
      if (prev.has(workspaceId)) return prev;
      const next = new Set(prev);
      next.add(workspaceId);
      return next;
    });
  }, [workspaceId, page]);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const t = event.target as Node;
      if (accountMenuRef.current && !accountMenuRef.current.contains(t)) {
        setAccountMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [accountMenuOpen]);

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

  const changePage = (key: PageKey, opts?: { scroll?: boolean }) => {
    if (LEAF_PAGES.includes(key) && !LEAF_PAGES.includes(page)) {
      setReturnPage(page);
    }
    if (key !== "billing") setBillingManageOpen(false);
    setPage(key);
    setMobileNav(false);
    setAccountMenuOpen(false);
    setBrandRailOpen(false);
    const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const there =
      key === "overview"
        ? `${window.location.pathname}${window.location.search}`
        : `${window.location.pathname}${window.location.search}#${key}`;
    if (here !== there) {
      window.history.pushState({ page: key }, "", there);
    }
    if (opts?.scroll !== false) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const updateBillingState = (next: BillingState, persist = true) => {
    setBillingState(next);
    if (persist) saveBillingState(next);
  };

  const startSubscription = () => {
    setPlansFocusTick((n) => n + 1);
    if (page !== "billing") changePage("billing", { scroll: false });
  };

  const goHome = () => changePage("overview");
  const goBack = () => changePage(returnPage !== page ? returnPage : "overview");

  const railMode = sidebarCollapsed && desktopLayout;
  const persistSidebarCollapsed = (next: boolean) => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event("orbis-sidebar-collapsed"));
    setBrandRailOpen(false);
  };
  const openBrandRailMenu = () => {
    const btn = brandRailBtnRef.current;
    if (btn) {
      const r = btn.getBoundingClientRect();
      setBrandRailPos({ top: r.top, left: r.right + 8 });
    }
    setBrandRailOpen((open) => !open);
  };

  const expandBrand = (id: string) => {
    if (!id) return;
    setExpandedBrandIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const toggleBrandExpanded = (id: string) => {
    if (!id) return;
    setExpandedBrandIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openBrandPage = (id: string, key: PageKey) => {
    expandBrand(id);
    if (id !== workspaceId) selectWorkspace(id);
    changePage(key);
  };

  const selectWorkspace = (nextId: string) => {
    const next = switchWorkspace(nextId);
    if (!next) return;
    expandBrand(next.id);
    notify(`已切换到 ${workspaceItemLabel(next)}`);
  };

  const brandsForNav = workspaceList.length
    ? workspaceList
    : workspaceId
      ? [
          {
            id: workspaceId,
            name: workspaceName,
            slug: "",
            reportTitle: workspaceName,
            brandName: workspaceName,
            brandDomain: null,
            observationCount: 0,
          },
        ]
      : [];
  const currentRailBrand =
    brandsForNav.find((b) => b.id === workspaceId) ?? brandsForNav[0];
  const currentRailLabel = currentRailBrand
    ? workspaceItemLabel(currentRailBrand)
    : "";

  const titles: Record<PageKey, [string, string]> = {
    overview: ["品牌报告总览", "覆盖率、提及、位次与引用，对照竞品表现。"],
    prompts: [t("prompts.title"), t("prompts.subtitle")],
    citations: ["引用分析", "AI 回答引用的 URL、域名与竞品共现。"],
    recommendations: ["优化建议", "把可见度缺口转成可执行的内容与公关动作。"],
    research: ["AI Prompt 研究", "发现真实用户会向 AI 提出的高价值问题。"],
    reports: ["报告中心", "创建面向团队、客户和管理层的周期报告。"],
    content: ["内容生成", "查看 seo-generator-agent 产出的文章状态、摘要与预览。"],
    "brand-settings": ["品牌设置", "管理本品、竞品、监测 Prompt 与通知偏好。"],
    billing: ["账单", "在这里管理套餐与账单记录。"],
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
    <div
      className={[
        "app-shell",
        billingState.plan === "trial" ? "has-trial-banner" : "",
        page === "overview" ? "is-overview" : "",
        page === "prompts" ? "is-prompts" : "",
        page === "citations" ? "is-citations" : "",
        page === "recommendations" ? "is-recommendations" : "",
        page === "reports" ? "is-reports" : "",
        railMode ? "sidebar-collapsed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {billingState.plan === "trial" ? (
        <TrialBanner state={billingState} onStartSubscription={startSubscription} />
      ) : null}
      <div className="app-shell-body">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="brand sidebar-header">
          <button
            type="button"
            className="brand-home"
            onClick={goHome}
            aria-label="返回总览"
          >
            <div className="brand-orbit">
              <i />
            </div>
            <div className="sidebar-label">
              <strong>ORBIS</strong>
              <span>{t("app.tagline")}</span>
            </div>
          </button>
          <button
            type="button"
            className="sidebar-collapse-btn"
            aria-expanded={!railMode}
            aria-label={railMode ? "展开侧边栏" : "收起侧边栏"}
            title={railMode ? "展开侧边栏" : "收起侧边栏"}
            onClick={() => persistSidebarCollapsed(!sidebarCollapsed)}
          >
            <SidebarToggleIcon collapsed={railMode} />
          </button>
        </div>
        <nav>
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-group-head">
                <p className="sidebar-label">{group.label}</p>
                {group.add ? (
                  <span className="nav-group-add sidebar-label" aria-hidden>
                    +
                  </span>
                ) : null}
              </div>
              {group.label === "品牌报告" ? (
                railMode ? (
                  <>
                    {currentRailBrand ? (
                      <RailTip label={currentRailLabel}>
                        <button
                          type="button"
                          ref={brandRailBtnRef}
                          data-brand-rail-trigger=""
                          className={`sidebar-rail-item is-brand${brandRailOpen ? " is-open" : ""}`}
                          aria-label={currentRailLabel}
                          aria-expanded={brandRailOpen}
                          aria-haspopup="menu"
                          onClick={openBrandRailMenu}
                        >
                          <BrandLogo
                            className="brand-nav-logo"
                            domain={currentRailBrand.brandDomain}
                            name={currentRailLabel}
                          />
                        </button>
                      </RailTip>
                    ) : null}
                    {brandReportItems.map((item) => {
                      const isOn = page === item.key;
                      return (
                        <RailTip key={item.key} label={item.label}>
                          <button
                            type="button"
                            className={`sidebar-rail-item${isOn ? " is-on" : ""}`}
                            aria-label={item.label}
                            onClick={() => {
                              if (workspaceId) openBrandPage(workspaceId, item.key);
                              else changePage(item.key);
                            }}
                          >
                            <span className="nav-icon">
                              <NavRailIcon name={item.key} />
                            </span>
                          </button>
                        </RailTip>
                      );
                    })}
                  </>
                ) : (
                  brandsForNav.map((brand) => {
                    const brandId = brand.id;
                    const label = workspaceItemLabel(brand);
                    const expanded = expandedBrandIds.has(brandId);
                    return (
                      <div className="brand-nav" key={brandId}>
                        <button
                          type="button"
                          className="brand-nav-row"
                          aria-expanded={expanded}
                          onClick={() => toggleBrandExpanded(brandId)}
                        >
                          <BrandLogo
                            className="brand-nav-logo"
                            domain={brand.brandDomain}
                            name={label}
                          />
                          <span className="brand-nav-name">{label}</span>
                          <span
                            className={`brand-nav-caret${expanded ? " is-open" : ""}`}
                            aria-hidden
                          >
                            ▸
                          </span>
                        </button>
                        {expanded ? (
                          <div className="brand-nav-children">
                            {brandReportItems.map((item) => {
                              const isOn = brandId === workspaceId && page === item.key;
                              return (
                                <button
                                  key={item.key}
                                  type="button"
                                  className={isOn ? "brand-nav-child is-on" : "brand-nav-child"}
                                  onClick={() => openBrandPage(brandId, item.key)}
                                >
                                  {item.label}
                                  {item.key === "prompts" &&
                                  brandId === workspaceId &&
                                  promptBadge ? (
                                    <small>{promptBadge}</small>
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )
              ) : railMode ? (
                group.items.map((item) => (
                  <RailTip key={item.key} label={item.label}>
                    <button
                      type="button"
                      className={`sidebar-rail-item${page === item.key ? " is-on" : ""}`}
                      aria-label={item.label}
                      onClick={() => changePage(item.key as PageKey)}
                    >
                      <span className="nav-icon">
                        <NavRailIcon name={item.key} />
                      </span>
                    </button>
                  </RailTip>
                ))
              ) : (
                group.items.map((item) => (
                  <button
                    key={item.key}
                    className={page === item.key ? "active" : ""}
                    onClick={() => changePage(item.key as PageKey)}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    {item.label}
                  </button>
                ))
              )}
            </div>
          ))}
          <div className="sidebar-bottom">
            <p className="sidebar-label">管理</p>
            {railMode ? (
              <>
                <RailTip label="帮助与文档">
                  <a
                    href="/help"
                    target="_blank"
                    rel="noreferrer"
                    className="sidebar-rail-item"
                    aria-label="帮助与文档"
                  >
                    <span className="nav-icon">
                      <NavRailIcon name="help" />
                    </span>
                  </a>
                </RailTip>
                <RailTip label="账单与套餐">
                  <button
                    type="button"
                    className={`sidebar-rail-item${page === "billing" ? " is-on" : ""}`}
                    aria-label="账单与套餐"
                    onClick={() => changePage("billing")}
                  >
                    <span className="nav-icon">
                      <NavRailIcon name="billing" />
                    </span>
                  </button>
                </RailTip>
                <RailTip label="重新体验首次激活">
                  <button
                    type="button"
                    className="sidebar-rail-item"
                    aria-label="重新体验首次激活"
                    onClick={() => {
                      void resetOnboardingStorage().then(() => setExperience("onboarding"));
                    }}
                  >
                    <span className="nav-icon">
                      <NavRailIcon name="reset" />
                    </span>
                  </button>
                </RailTip>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </nav>
        <BrandRailMenu
          open={railMode && brandRailOpen}
          top={brandRailPos.top}
          left={brandRailPos.left}
          currentId={workspaceId}
          items={brandsForNav.map((b) => ({
            id: b.id,
            label: workspaceItemLabel(b),
            domain: b.brandDomain,
          }))}
          onClose={() => setBrandRailOpen(false)}
          onPick={(id) => {
            setBrandRailOpen(false);
            const nextPage = BRAND_CLUSTER.includes(page) ? page : "overview";
            openBrandPage(id, nextPage);
          }}
        />
      </aside>
      {mobileNav && (
        <button className="nav-backdrop" aria-label="关闭菜单" onClick={() => setMobileNav(false)} />
      )}

      <main className="main">
        <div className="page-topbar">
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
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setAccountMenuOpen(false);
                          void fetch("/api/auth/logout", {
                            method: "POST",
                            credentials: "include",
                          }).then(() => {
                            window.location.href = "/";
                          });
                        }}
                      >
                        退出登录
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
        </div>
        <section className="content">
          <div className="page-chrome">
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
                    <BrandLogo
                      className="brand-mark-logo"
                      domain={
                        selectedWorkspace?.brandDomain ||
                        workspace?.brand?.website ||
                        profileSite
                      }
                      name={workspaceName}
                    />
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
                  ) : page === "citations" ? (
                    <p>{titles.citations[1]}</p>
                  ) : page === "recommendations" ? (
                    <p>{titles.recommendations[1]}</p>
                  ) : (
                      [
                        "overview",
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
                  {page === "billing" ? (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setBillingManageOpen(true)}
                    >
                      管理套餐
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
                invalidatePrompts();
                changePage("prompts");
              }}
            />
          )}
          {page === "prompts" && loadingPrompts ? (
            <TablePageSkeleton title={t("prompts.title")} />
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
            <RecommendationsSkeleton />
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
              usage={{
                prompts: promptsData?.total ?? overview?.promptTotal ?? 0,
                geoAudits: 0,
                api: 0,
                mcp: 0,
                agentEvents: 0,
              }}
              workspaceCount={workspaceList.length}
              notify={notify}
              manageOpen={billingManageOpen}
              onManageOpenChange={setBillingManageOpen}
              state={billingState}
              onStateChange={updateBillingState}
              plansFocusTick={plansFocusTick}
            />
          )}
        </section>
      </main>
      </div>

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
