"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/auth/fetch";
import { buildArticleListSearchParams } from "../lib/seo-agent/query";
import type { ArticleListItem, ArticleListResponse } from "../lib/seo-agent/types";

const STATUS_OPTIONS = [
  { value: "", label: "全部状态" },
  { value: "TOPIC_REVIEW", label: "选题待确认" },
  { value: "OUTLINE_REVIEW", label: "大纲待确认" },
  { value: "CONTENT_REVIEW", label: "正文待确认" },
  { value: "PROCESSING", label: "文章处理中" },
  { value: "FINAL_REVIEW", label: "终稿待批准" },
  { value: "COMPLETED", label: "已完成" },
  { value: "FAILED", label: "失败待处理" },
] as const;

const SITE_OPTIONS = [
  { value: "", label: "全部站点" },
  { value: "gumtree", label: "gumtree" },
] as const;

const MARKET_OPTIONS = [
  { value: "", label: "全部市场" },
  { value: "uk", label: "uk" },
  { value: "ie", label: "ie" },
] as const;

const PAGE_SIZE = 20;

function formatUpdatedAt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("zh-CN", { hour12: false });
}

function statusClass(status: string) {
  switch (status) {
    case "COMPLETED":
      return "good";
    case "FAILED":
      return "danger";
    case "PROCESSING":
    case "TOPIC_GENERATING":
    case "OUTLINE_GENERATING":
    case "CONTENT_GENERATING":
      return "warn";
    default:
      return "neutral";
  }
}

type Props = {
  notify: (message: string) => void;
  reloadToken?: number;
};

export default function ContentArticles({ notify, reloadToken = 0 }: Props) {
  const [q, setQ] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [status, setStatus] = useState("");
  const [site, setSite] = useState("");
  const [market, setMarket] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ArticleListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drawer, setDrawer] = useState<ArticleListItem | null>(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = buildArticleListSearchParams({
      q,
      status,
      site,
      market,
      page,
      page_size: PAGE_SIZE,
    });
    try {
      const res = await apiFetch(`/api/content/articles?${params.toString()}`, {
        cache: "no-store",
      });
      const body = (await res.json()) as ArticleListResponse & { error?: string };
      if (!res.ok) {
        throw new Error(body.error || `加载失败 (${res.status})`);
      }
      setData(body);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [q, status, site, market, page]);

  useEffect(() => {
    void load();
  }, [load, tick, reloadToken]);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const items = data?.items ?? [];
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  const applySearch = () => {
    setPage(1);
    setQ(qDraft.trim());
  };

  const openPreview = (item: ArticleListItem) => {
    if (!item.preview_ready || !item.preview_url) {
      notify("预览不可用：尚无 ACTIVE 正文");
      return;
    }
    window.open(item.preview_url, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <div className="panel table-panel">
        <div className="table-toolbar">
          <div className="search-box">
            <span>⌕</span>
            <input
              placeholder="搜索关键词、标题或文章 ID"
              value={qDraft}
              onChange={(e) => setQDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applySearch();
              }}
              aria-label="搜索文章"
            />
          </div>
          <select
            className="orbis-select"
            aria-label="状态"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            className="orbis-select"
            aria-label="站点"
            value={site}
            onChange={(e) => {
              setPage(1);
              setSite(e.target.value);
            }}
          >
            {SITE_OPTIONS.map((o) => (
              <option key={o.value || "all-site"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            className="orbis-select"
            aria-label="市场"
            value={market}
            onChange={(e) => {
              setPage(1);
              setMarket(e.target.value);
            }}
          >
            {MARKET_OPTIONS.map((o) => (
              <option key={o.value || "all-market"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button type="button" className="secondary-button" onClick={applySearch}>
            搜索
          </button>
          <div className="spacer" />
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setTick((n) => n + 1);
              notify("内容列表已刷新");
            }}
          >
            ↻ 刷新
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => notify("导出将在下一期接入")}
          >
            ⇩ 导出
          </button>
        </div>

        {error && (
          <div className="notice" style={{ margin: "0 0 14px" }}>
            <span>!</span>
            <div>
              <b>无法加载内容列表</b>
              <p>{error}</p>
            </div>
            <button type="button" onClick={() => setTick((n) => n + 1)}>
              重试 →
            </button>
          </div>
        )}

        {loading && !data && !error && (
          <div className="content-list-state">正在加载文章…</div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="content-list-state">暂无匹配的文章</div>
        )}

        {items.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>关键词 / 标题</th>
                  <th>状态</th>
                  <th>站点</th>
                  <th>更新时间</th>
                  <th>预览</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} onClick={() => setDrawer(row)}>
                    <td>
                      <b className="prompt-name">{row.keyword || row.id}</b>
                      {row.title ? <span className="tag">{row.title}</span> : null}
                    </td>
                    <td>
                      <span className={`content-status ${statusClass(row.status)}`}>
                        {row.status_label || row.status}
                      </span>
                    </td>
                    <td>
                      <span className="competitor-text">
                        {row.site || "—"}
                        {row.market ? ` · ${row.market}` : ""}
                      </span>
                    </td>
                    <td>{formatUpdatedAt(row.updated_at)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {row.preview_ready ? (
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => openPreview(row)}
                        >
                          打开预览 →
                        </button>
                      ) : (
                        <span className="competitor-text">预览不可用</span>
                      )}
                    </td>
                    <td>›</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="pagination">
          <span>
            {loading && data ? "刷新中… · " : ""}
            显示 {from}–{to}，共 {total} 篇
          </span>
          <div>
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ‹
            </button>
            <button type="button" className="active">
              {page}
            </button>
            <span style={{ padding: "0 8px", color: "var(--muted)" }}>
              / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {drawer && (
        <div className="drawer-wrap">
          <button
            type="button"
            className="drawer-backdrop"
            aria-label="关闭详情"
            onClick={() => setDrawer(null)}
          />
          <aside className="drawer">
            <div className="drawer-head">
              <span className="eyebrow">文章详情</span>
              <button type="button" onClick={() => setDrawer(null)}>
                ×
              </button>
            </div>
            <h2>{drawer.keyword || drawer.title || drawer.id}</h2>
            <div className="drawer-tags">
              <span>{drawer.status_label || drawer.status}</span>
              <span>
                {drawer.site || "—"} · {drawer.market || "—"}
              </span>
            </div>
            <div className="drawer-metrics">
              <div>
                <small>文章 ID</small>
                <b style={{ fontSize: 13 }}>{drawer.id}</b>
              </div>
              <div>
                <small>批次</small>
                <b style={{ fontSize: 13 }}>{drawer.batch_id}</b>
              </div>
              <div>
                <small>更新</small>
                <b style={{ fontSize: 13 }}>{formatUpdatedAt(drawer.updated_at)}</b>
              </div>
            </div>
            {drawer.snippet ? (
              <div className="answer-card">
                <p>{drawer.snippet}</p>
              </div>
            ) : (
              <p className="competitor-text">暂无摘要</p>
            )}
            <div style={{ marginTop: 16 }}>
              <button
                type="button"
                className="primary-button"
                disabled={!drawer.preview_ready}
                onClick={() => openPreview(drawer)}
              >
                {drawer.preview_ready ? "打开文章预览" : "预览不可用"}
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
