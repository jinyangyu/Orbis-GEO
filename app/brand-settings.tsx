"use client";

import { t } from "@/lib/i18n";

import { useEffect, useMemo, useState } from "react";
import {
  fetchBrandSettings,
  fetchSettingsPrompts,
  patchBrandSettingsClient,
  savePromptMembership,
} from "@/lib/brand-settings/client";
import type {
  BrandSettingsPayload,
  SettingsPromptView,
} from "@/lib/brand-settings/service";
import {
  createBrandCompetitor,
  patchBrand,
  removeBrandCompetitor,
} from "@/lib/brands/client";
import type { BrandRowView } from "@/lib/brands/service";
import { BrandLogo } from "./dashboard/brand-logo";
import ReviewDetectedBrandsModal from "./review-detected-brands-modal";

export type BrandSettingsTab =
  | "details"
  | "prompts"
  | "competitors"
  | "notifications";

const MARKET_LABELS: Record<string, string> = {
  cn: "中国",
  uk: "英国",
  us: "美国",
  au: "澳大利亚",
  de: "德国",
  fr: "法国",
  jp: "日本",
  global: "全球",
};

function marketLabel(code: string): string {
  if (!code) return "—";
  return MARKET_LABELS[code.toLowerCase()] || code;
}

function ChipEditor({
  values,
  draft,
  setDraft,
  onChange,
  addLabel,
  placeholder,
}: {
  values: string[];
  draft: string;
  setDraft: (v: string) => void;
  onChange: (next: string[]) => void;
  addLabel: string;
  placeholder: string;
}) {
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...values, v].slice(0, 20));
    setDraft("");
  };
  return (
    <div className="bs-alias">
      {values.map((a, i) => (
        <span key={`${a}-${i}`} className="bs-alias-chip">
          {a}
          <button
            type="button"
            onClick={() => onChange(values.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </span>
      ))}
      <button type="button" className="bs-link" onClick={add}>
        {addLabel}
      </button>
      <input
        className="bs-alias-input"
        placeholder={placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
      />
    </div>
  );
}

type PaneKey = "left" | "right";

type PaneFilter = {
  q: string;
  market: string;
  tag: string;
  page: number;
  pageSize: number;
};

const DEFAULT_FILTER: PaneFilter = {
  q: "",
  market: "all",
  tag: "all",
  page: 1,
  pageSize: 50,
};

function filterPage(
  items: SettingsPromptView[],
  filter: PaneFilter,
): { rows: SettingsPromptView[]; total: number } {
  const q = filter.q.trim().toLowerCase();
  let list = items;
  if (q) list = list.filter((p) => p.text.toLowerCase().includes(q));
  if (filter.market !== "all") {
    list = list.filter((p) => p.market === filter.market);
  }
  if (filter.tag !== "all") {
    list = list.filter((p) => p.tags.includes(filter.tag));
  }
  const total = list.length;
  const start = (filter.page - 1) * filter.pageSize;
  return { rows: list.slice(start, start + filter.pageSize), total };
}

function PromptTransferPane({
  title,
  items,
  total,
  filter,
  onFilter,
  selected,
  onToggle,
  onToggleAll,
  markets,
  tags,
}: {
  title: string;
  items: SettingsPromptView[];
  total: number;
  filter: PaneFilter;
  onFilter: (patch: Partial<PaneFilter>) => void;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[], on: boolean) => void;
  markets: string[];
  tags: string[];
}) {
  const pageIds = items.map((p) => p.id);
  const allChecked =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const pageCount = Math.max(1, Math.ceil(total / filter.pageSize) || 1);

  return (
    <div className="bs-xfer-pane">
      <header className="bs-xfer-head">
        <span>
          {total} prompts
        </span>
        <b>{title}</b>
      </header>
      <div className="bs-xfer-tools">
        <label className="bs-xfer-check">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={(e) => onToggleAll(pageIds, e.target.checked)}
          />
        </label>
        <input
          className="bs-xfer-search"
          placeholder={t("action.search")}
          value={filter.q}
          onChange={(e) => onFilter({ q: e.target.value, page: 1 })}
        />
        <select
          className="orbis-select bs-xfer-select"
          value={filter.market}
          onChange={(e) => onFilter({ market: e.target.value, page: 1 })}
          aria-label="市场"
        >
          <option value="all">市场</option>
          {markets.map((m) => (
            <option key={m} value={m}>
              {marketLabel(m)}
            </option>
          ))}
        </select>
        <select
          className="orbis-select bs-xfer-select"
          value={filter.tag}
          onChange={(e) => onFilter({ tag: e.target.value, page: 1 })}
          aria-label="标签"
        >
          <option value="all">标签</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div className="bs-xfer-table">
        {items.map((p) => (
          <div className="bs-xfer-row" key={p.id}>
            <label className="bs-xfer-check">
              <input
                type="checkbox"
                checked={selected.has(p.id)}
                onChange={() => onToggle(p.id)}
              />
            </label>
            <p className="bs-xfer-text" title={p.text}>
              {p.text}
            </p>
            <span className="bs-xfer-market">{marketLabel(p.market)}</span>
            <span className="bs-xfer-tags">
              {p.tags.length ? p.tags.join(", ") : ""}
            </span>
          </div>
        ))}
        {items.length === 0 && (
          <div className="bs-xfer-empty muted">暂无 Prompt</div>
        )}
      </div>
      <footer className="bs-xfer-pager">
        <div className="bs-xfer-pages">
          {Array.from({ length: Math.min(pageCount, 7) }, (_, i) => {
            const n = i + 1;
            return (
              <button
                key={n}
                type="button"
                className={filter.page === n ? "active" : ""}
                onClick={() => onFilter({ page: n })}
              >
                {n}
              </button>
            );
          })}
        </div>
        <select
          className="orbis-select"
          value={String(filter.pageSize)}
          onChange={(e) =>
            onFilter({ pageSize: Number(e.target.value), page: 1 })
          }
        >
          <option value="20">20 / page</option>
          <option value="50">50 / page</option>
          <option value="100">100 / page</option>
        </select>
      </footer>
    </div>
  );
}

export default function BrandSettings({
  workspaceId,
  initialTab = "details",
  notify,
  onGoPrompts,
  onGoResearch,
  onSaved,
}: {
  workspaceId: string | null;
  initialTab?: BrandSettingsTab;
  notify: (s: string) => void;
  onGoPrompts: () => void;
  onGoResearch: () => void;
  onSaved?: (payload?: BrandSettingsPayload) => void;
}) {
  const [tab, setTab] = useState<BrandSettingsTab>(initialTab);
  const [data, setData] = useState<BrandSettingsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [reportTitle, setReportTitle] = useState("");
  const [brandName, setBrandName] = useState("");
  const [brandDomain, setBrandDomain] = useState("");
  const [aliases, setAliases] = useState<string[]>([]);
  const [aliasDraft, setAliasDraft] = useState("");
  const [domainAliases, setDomainAliases] = useState<string[]>([]);
  const [domainAliasDraft, setDomainAliasDraft] = useState("");
  const [includeSubdomains, setIncludeSubdomains] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [competitors, setCompetitors] = useState<BrandRowView[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDomain, setEditDomain] = useState("");
  const [newCompName, setNewCompName] = useState("");
  const [newCompDomain, setNewCompDomain] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [compDirty, setCompDirty] = useState(false);

  const [notifyNewRecs, setNotifyNewRecs] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState("");

  // Transfer list: full catalog + draft membership
  const [catalog, setCatalog] = useState<SettingsPromptView[]>([]);
  const [baselineActive, setBaselineActive] = useState<Record<string, boolean>>(
    {},
  );
  const [draftActive, setDraftActive] = useState<Record<string, boolean>>({});
  const [markets, setMarkets] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [leftFilter, setLeftFilter] = useState<PaneFilter>(DEFAULT_FILTER);
  const [rightFilter, setRightFilter] = useState<PaneFilter>(DEFAULT_FILTER);
  const [leftSelected, setLeftSelected] = useState<Set<string>>(new Set());
  const [rightSelected, setRightSelected] = useState<Set<string>>(new Set());
  const [promptsLoading, setPromptsLoading] = useState(false);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const applyPayload = (payload: BrandSettingsPayload) => {
    setData(payload);
    setReportTitle(payload.reportTitle);
    setBrandName(payload.primary?.name ?? "");
    setBrandDomain(payload.primary?.domain ?? "");
    setAliases(payload.primary?.aliases ?? []);
    setDomainAliases(payload.primary?.domainAliases ?? []);
    setIncludeSubdomains(payload.primary?.includeSubdomains ?? true);
    setCompetitors(payload.competitors);
    setNotifyNewRecs(payload.notifications.notifyNewRecommendations);
    setWebhookUrl(payload.notifications.notifyWebhookUrl ?? "");
    setCompDirty(false);
    setEditingId(null);
  };

  const reload = async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const payload = await fetchBrandSettings(workspaceId);
      applyPayload(payload);
    } catch (e) {
      notify(e instanceof Error ? e.message : "加载设置失败");
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const loadPromptCatalog = async () => {
    if (!workspaceId) return;
    setPromptsLoading(true);
    try {
      const [inactive, active] = await Promise.all([
        fetchSettingsPrompts(workspaceId, {
          pane: "inactive",
          page: 1,
          pageSize: 100,
        }),
        fetchSettingsPrompts(workspaceId, {
          pane: "active",
          page: 1,
          pageSize: 100,
        }),
      ]);

      const mergePages = async (
        pane: "inactive" | "active",
        first: typeof inactive,
      ) => {
        const items = [...first.items];
        let page = 1;
        let total = first.total;
        while (items.length < total && page < 20) {
          page += 1;
          const next = await fetchSettingsPrompts(workspaceId, {
            pane,
            page,
            pageSize: 100,
          });
          items.push(...next.items);
          total = next.total;
        }
        return items;
      };

      const [inactiveAll, activeAll] = await Promise.all([
        mergePages("inactive", inactive),
        mergePages("active", active),
      ]);

      const byId = new Map<string, SettingsPromptView>();
      for (const p of [...inactiveAll, ...activeAll]) byId.set(p.id, p);
      const list = [...byId.values()].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.text.localeCompare(b.text),
      );
      const baseline: Record<string, boolean> = {};
      for (const p of list) baseline[p.id] = p.isActive;

      setCatalog(list);
      setBaselineActive(baseline);
      setDraftActive({});
      setMarkets(
        [...new Set([...inactive.markets, ...active.markets])].sort(),
      );
      setTags([...new Set([...inactive.tags, ...active.tags])].sort());
      setLeftSelected(new Set());
      setRightSelected(new Set());
      setLeftFilter(DEFAULT_FILTER);
      setRightFilter(DEFAULT_FILTER);
    } catch (e) {
      notify(e instanceof Error ? e.message : "加载 Prompt 失败");
      throw e;
    } finally {
      setPromptsLoading(false);
    }
  };

  useEffect(() => {
    void reload().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  useEffect(() => {
    if (tab !== "prompts" || !workspaceId) return;
    void loadPromptCatalog().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, workspaceId]);

  const effectiveActive = useMemo(() => {
    const map: Record<string, boolean> = { ...baselineActive };
    for (const [id, v] of Object.entries(draftActive)) map[id] = v;
    return map;
  }, [baselineActive, draftActive]);

  const promptDirty = useMemo(() => {
    return Object.entries(draftActive).some(
      ([id, v]) => baselineActive[id] !== v,
    );
  }, [draftActive, baselineActive]);

  const leftItems = useMemo(
    () => catalog.filter((p) => !effectiveActive[p.id]),
    [catalog, effectiveActive],
  );
  const rightItems = useMemo(
    () => catalog.filter((p) => effectiveActive[p.id]),
    [catalog, effectiveActive],
  );

  const leftPage = useMemo(
    () => filterPage(leftItems, leftFilter),
    [leftItems, leftFilter],
  );
  const rightPage = useMemo(
    () => filterPage(rightItems, rightFilter),
    [rightItems, rightFilter],
  );

  const changeTab = (next: BrandSettingsTab) => {
    if (next !== tab && promptDirty) {
      if (!window.confirm("监测 Prompt 有未保存更改，确定离开？")) return;
      setDraftActive({});
      setLeftSelected(new Set());
      setRightSelected(new Set());
    }
    setTab(next);
  };

  const moveSelected = (from: PaneKey) => {
    if (from === "left") {
      const next = { ...draftActive };
      for (const id of leftSelected) next[id] = true;
      setDraftActive(next);
      setLeftSelected(new Set());
    } else {
      const next = { ...draftActive };
      for (const id of rightSelected) next[id] = false;
      setDraftActive(next);
      setRightSelected(new Set());
    }
  };

  const savePromptDraft = async () => {
    if (!workspaceId) return;
    const activateIds: string[] = [];
    const deactivateIds: string[] = [];
    for (const [id, v] of Object.entries(draftActive)) {
      if (baselineActive[id] === v) continue;
      if (v) activateIds.push(id);
      else deactivateIds.push(id);
    }
    if (!activateIds.length && !deactivateIds.length) {
      notify("没有需要保存的更改");
      return;
    }
    setSaving(true);
    try {
      await savePromptMembership(workspaceId, activateIds, deactivateIds);
      notify(
        `已更新监测 Prompt（启用 ${activateIds.length}，停用 ${deactivateIds.length}）`,
      );
      await loadPromptCatalog();
      const refreshed = await fetchBrandSettings(workspaceId);
      applyPayload(refreshed);
      onSaved?.(refreshed);
    } catch (e) {
      notify(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const cancelPromptDraft = () => {
    setDraftActive({});
    setLeftSelected(new Set());
    setRightSelected(new Set());
  };

  const saveDetails = async () => {
    if (!workspaceId) return;
    setSaving(true);
    try {
      const payload = await patchBrandSettingsClient(workspaceId, {
        reportTitle,
        brandName,
        brandDomain,
        aliases,
        domainAliases,
        includeSubdomains,
      });
      applyPayload(payload);
      notify("品牌详情已保存");
      onSaved?.(payload);
    } catch (e) {
      notify(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const saveNotifications = async () => {
    if (!workspaceId) return;
    setSaving(true);
    try {
      const payload = await patchBrandSettingsClient(workspaceId, {
        notifyNewRecommendations: notifyNewRecs,
        notifyWebhookUrl: webhookUrl,
      });
      applyPayload(payload);
      notify("通知偏好已保存");
      onSaved?.(payload);
    } catch (e) {
      notify(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const toggleInSet = (
    set: Set<string>,
    setter: (s: Set<string>) => void,
    id: string,
  ) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  return (
    <div className="brand-settings brand-settings-wide">
      <div className="brand-settings-head">
        <div>
          <h2>品牌设置</h2>
          {data?.reportTitle ? (
            <p className="bs-subtitle">{data.reportTitle}</p>
          ) : null}
        </div>
        {loading ? <span className="muted">加载中…</span> : null}
      </div>

      <div className="brand-settings-tabs" role="tablist">
        {(
          [
            ["details", "品牌详情"],
            ["prompts", "监测 Prompts"],
            ["competitors", "竞品"],
            ["notifications", "通知"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "active" : ""}
            onClick={() => changeTab(id)}
          >
            {label}
            {id === "prompts" && data
              ? ` (${rightItems.length}/${catalog.length || data.promptStats.total})`
              : ""}
          </button>
        ))}
      </div>

      {tab === "details" && (
        <section className="brand-settings-panel">
          <label className="bs-field">
            <span>项目名称</span>
            <input
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              placeholder="显示在侧栏与面包屑"
            />
          </label>
          <label className="bs-field">
            <span>品牌名称</span>
            <input
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
            />
          </label>
          <div className="bs-field">
            <span>品牌变体</span>
            <ChipEditor
              values={aliases}
              draft={aliasDraft}
              setDraft={setAliasDraft}
              onChange={setAliases}
              addLabel="+ 添加品牌变体"
              placeholder="例如 Gumtree UK"
            />
          </div>

          <button
            type="button"
            className="bs-advanced-toggle"
            onClick={() => setAdvancedOpen((v) => !v)}
          >
            {advancedOpen ? "▾" : "▸"} 高级设置
          </button>
          {advancedOpen && (
            <div className="bs-advanced">
              <label className="bs-field">
                <span>品牌域名</span>
                <input
                  value={brandDomain}
                  onChange={(e) => setBrandDomain(e.target.value)}
                />
              </label>
              <label className="bs-check">
                <input
                  type="checkbox"
                  checked={includeSubdomains}
                  onChange={(e) => setIncludeSubdomains(e.target.checked)}
                />
                <span>包含所有子域名</span>
              </label>
              <div className="bs-field">
                <span>域名变体</span>
                <ChipEditor
                  values={domainAliases}
                  draft={domainAliasDraft}
                  setDraft={setDomainAliasDraft}
                  onChange={setDomainAliases}
                  addLabel="+ 添加域名变体"
                  placeholder="例如 gumtree.co.uk"
                />
              </div>
            </div>
          )}

          <div className="bs-actions">
            <button
              type="button"
              className="pr-primary"
              disabled={saving || !data?.primary}
              onClick={() => void saveDetails()}
            >
              {saving ? "保存中…" : "保存更改"}
            </button>
            <button
              type="button"
              className="pr-cancel"
              onClick={() => void reload()}
            >
              取消
            </button>
          </div>
        </section>
      )}

      {tab === "prompts" && (
        <section className="brand-settings-panel bs-prompts-panel">
          <p className="bs-help">
            左侧为未启用的 Prompt，右侧为当前监测集。勾选后用中间箭头移动，确认后点「保存更改」。
            {" · "}
            <button type="button" className="bs-link" onClick={onGoResearch}>
              Prompt 研究
            </button>
            {" · "}
            <button type="button" className="bs-link" onClick={onGoPrompts}>
              查看指标
            </button>
            {promptsLoading ? " · 加载中…" : null}
            {promptDirty ? " · 有未保存更改" : null}
          </p>

          <div className="bs-xfer">
            <PromptTransferPane
              title="未启用"
              items={leftPage.rows}
              total={leftPage.total}
              filter={leftFilter}
              onFilter={(patch) =>
                setLeftFilter((f) => ({ ...f, ...patch }))
              }
              selected={leftSelected}
              onToggle={(id) =>
                toggleInSet(leftSelected, setLeftSelected, id)
              }
              onToggleAll={(ids, on) => {
                const next = new Set(leftSelected);
                for (const id of ids) {
                  if (on) next.add(id);
                  else next.delete(id);
                }
                setLeftSelected(next);
              }}
              markets={markets}
              tags={tags}
            />

            <div className="bs-xfer-arrows">
              <button
                type="button"
                className="bs-xfer-arrow"
                disabled={!leftSelected.size}
                onClick={() => moveSelected("left")}
                aria-label="启用选中"
              >
                ›
              </button>
              <button
                type="button"
                className="bs-xfer-arrow"
                disabled={!rightSelected.size}
                onClick={() => moveSelected("right")}
                aria-label="停用选中"
              >
                ‹
              </button>
            </div>

            <PromptTransferPane
              title="已启用监测"
              items={rightPage.rows}
              total={rightPage.total}
              filter={rightFilter}
              onFilter={(patch) =>
                setRightFilter((f) => ({ ...f, ...patch }))
              }
              selected={rightSelected}
              onToggle={(id) =>
                toggleInSet(rightSelected, setRightSelected, id)
              }
              onToggleAll={(ids, on) => {
                const next = new Set(rightSelected);
                for (const id of ids) {
                  if (on) next.add(id);
                  else next.delete(id);
                }
                setRightSelected(next);
              }}
              markets={markets}
              tags={tags}
            />
          </div>

          <div className="bs-actions">
            <button
              type="button"
              className="pr-primary"
              disabled={saving || !promptDirty}
              onClick={() => void savePromptDraft()}
            >
              {saving ? "保存中…" : "保存更改"}
            </button>
            <button
              type="button"
              className="pr-cancel"
              disabled={!promptDirty}
              onClick={cancelPromptDraft}
            >
              取消
            </button>
          </div>
        </section>
      )}

      {tab === "competitors" && (
        <section className="brand-settings-panel">
          <div className="bs-comp-toolbar">
            <button
              type="button"
              className="bs-filter-btn"
              onClick={() => setSuggestOpen(true)}
            >
              建议竞品
            </button>
          </div>
          <div className="bs-comp-list">
            {competitors.map((c) => (
              <div className="bs-comp-row" key={c.id}>
                <i>
                  <BrandLogo className="bs-comp-logo" domain={c.domain} name={c.name} />
                </i>
                {editingId === c.id ? (
                  <div className="bs-comp-edit">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                    <input
                      value={editDomain}
                      onChange={(e) => setEditDomain(e.target.value)}
                    />
                    <button
                      type="button"
                      className="bs-link"
                      onClick={async () => {
                        try {
                          await patchBrand(c.id, {
                            name: editName,
                            domain: editDomain,
                          });
                          setEditingId(null);
                          setCompDirty(true);
                          await reload();
                          notify("竞品已更新");
                          onSaved?.();
                        } catch (e) {
                          notify(e instanceof Error ? e.message : "更新失败");
                        }
                      }}
                    >
                      确定
                    </button>
                    <button
                      type="button"
                      className="pr-cancel"
                      onClick={() => setEditingId(null)}
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <div>
                    <b>{c.name}</b>
                    <span>{c.domain}</span>
                  </div>
                )}
                {editingId !== c.id && (
                  <div className="bs-comp-actions">
                    <button
                      type="button"
                      className="bs-link"
                      onClick={() => {
                        setEditingId(c.id);
                        setEditName(c.name);
                        setEditDomain(c.domain);
                      }}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className="pr-cancel"
                      onClick={async () => {
                        try {
                          await removeBrandCompetitor(c.id);
                          setCompDirty(true);
                          notify(`已删除「${c.name}」`);
                          await reload();
                          onSaved?.();
                        } catch (e) {
                          notify(e instanceof Error ? e.message : "删除失败");
                        }
                      }}
                    >
                      删除
                    </button>
                  </div>
                )}
              </div>
            ))}
            {competitors.length === 0 && (
              <p className="muted">暂无竞品，可手动添加或从建议中选择。</p>
            )}
          </div>
          <div className="bs-add-comp">
            <input
              placeholder="竞品名称"
              value={newCompName}
              onChange={(e) => setNewCompName(e.target.value)}
            />
            <input
              placeholder="域名（可选）"
              value={newCompDomain}
              onChange={(e) => setNewCompDomain(e.target.value)}
            />
            <button
              type="button"
              className="pr-primary"
              onClick={async () => {
                try {
                  await createBrandCompetitor(workspaceId ?? undefined, {
                    name: newCompName,
                    domain: newCompDomain || undefined,
                  });
                  setNewCompName("");
                  setNewCompDomain("");
                  setCompDirty(true);
                  notify("已添加竞品");
                  await reload();
                  onSaved?.();
                } catch (e) {
                  notify(e instanceof Error ? e.message : "添加失败");
                }
              }}
            >
              添加竞品
            </button>
          </div>
          {compDirty ? (
            <div className="bs-actions">
              <button
                type="button"
                className="pr-cancel"
                onClick={() => {
                  setCompDirty(false);
                  void reload();
                }}
              >
                刷新列表
              </button>
            </div>
          ) : null}
        </section>
      )}

      {tab === "notifications" && (
        <section className="brand-settings-panel">
          <label className="bs-check bs-check-block">
            <input
              type="checkbox"
              checked={notifyNewRecs}
              onChange={(e) => setNotifyNewRecs(e.target.checked)}
            />
            <span>
              <b>新优化建议</b>
              <small>当系统生成新的内容/公关建议时通知我</small>
            </span>
          </label>
          <label className="bs-field">
            <span>Webhook URL（可选）</span>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.example.com/orbis"
              disabled={!notifyNewRecs}
            />
            <small className="bs-help">
              建议摘要变化时，向该地址 POST JSON；留空则仅站内铃铛通知。
            </small>
          </label>
          <div className="bs-actions">
            <button
              type="button"
              className="pr-primary"
              disabled={saving}
              onClick={() => void saveNotifications()}
            >
              {saving ? "保存中…" : "保存更改"}
            </button>
            <button
              type="button"
              className="pr-cancel"
              onClick={() => {
                setNotifyNewRecs(
                  data?.notifications.notifyNewRecommendations ?? true,
                );
                setWebhookUrl(data?.notifications.notifyWebhookUrl ?? "");
              }}
            >
              取消
            </button>
          </div>
        </section>
      )}

      <ReviewDetectedBrandsModal
        open={suggestOpen}
        workspaceId={workspaceId}
        onClose={() => setSuggestOpen(false)}
        onOpenSettings={(t) => {
          setSuggestOpen(false);
          setTab(t);
        }}
        onChanged={() => {
          void reload();
          onSaved?.();
        }}
        notify={notify}
      />
    </div>
  );
}
