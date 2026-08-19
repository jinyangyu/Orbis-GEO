"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/auth/fetch";
import type { CitationsMetrics, CitedUrlRow } from "@/lib/metrics/types";
import { BrandLogo } from "./brand-logo";
import { Donut } from "./ui";
import { t } from "@/lib/i18n";

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

async function toggleStarRequest(
  workspaceId: string,
  url: string,
  starred: boolean,
) {
  const headers: HeadersInit = {
    "content-type": "application/json",
  };
  if (starred) {
    const res = await apiFetch("/api/citations/stars", {
      method: "DELETE",
      headers,
      body: JSON.stringify({ workspaceId, url }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? "取消星标失败");
    }
  } else {
    const res = await apiFetch("/api/citations/stars", {
      method: "POST",
      headers,
      body: JSON.stringify({ workspaceId, url }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? "星标失败");
    }
  }
}

export function Citations({
  data,
  workspaceId,
  onOpenPrompts,
  notify,
}: {
  data: CitationsMetrics;
  workspaceId: string | null;
  onOpenPrompts: () => void;
  notify?: (s: string) => void;
}) {
  const own = data.structure[0]?.percent ?? 0;
  const [rows, setRows] = useState(data.urls);
  const [starredOnly, setStarredOnly] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  // Sync when parent reloads metrics
  useEffect(() => {
    setRows(data.urls);
  }, [data.urls]);

  const visible = starredOnly ? rows.filter((r) => r.starred) : rows;

  const onToggle = async (row: CitedUrlRow) => {
    if (!workspaceId) {
      notify?.("请先选择工作区");
      return;
    }
    const next = !row.starred;
    setPending(row.url);
    setRows((prev) =>
      prev.map((r) => (r.url === row.url ? { ...r, starred: next } : r)),
    );
    try {
      await toggleStarRequest(workspaceId, row.url, !!row.starred);
    } catch (e) {
      setRows((prev) =>
        prev.map((r) =>
          r.url === row.url ? { ...r, starred: row.starred } : r,
        ),
      );
      notify?.(e instanceof Error ? e.message : "星标操作失败");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="citations-page">
      <div className="wl-grid">
        <article className="panel">
          <div className="panel-head">
            <div>
              <h3>{t("citations.topWinners")}</h3>
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
              <h3>{t("citations.topLosers")}</h3>
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
            <p>按引用次数排序 · 点击星标收藏</p>
          </div>
          <label className={`star-filter${starredOnly ? " is-on" : ""}`}>
            <input
              type="checkbox"
              checked={starredOnly}
              onChange={(e) => setStarredOnly(e.target.checked)}
            />
            仅星标
          </label>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th />
                <th>URL</th>
                <th>{t("citations.cited")}</th>
                <th>品牌提及</th>
                <th>域名</th>
                <th>类型</th>
                <th>竞品</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.url}>
                  <td className="star-col">
                    <button
                      type="button"
                      className={`star-btn${r.starred ? " on" : ""}`}
                      aria-label={r.starred ? "取消星标" : "加星标"}
                      disabled={pending === r.url || !workspaceId}
                      onClick={() => void onToggle(r)}
                    >
                      {r.starred ? "★" : "☆"}
                    </button>
                  </td>
                  <td className="url-cell">
                    <b>{r.title || r.domain}</b>
                    <small>{r.url}</small>
                  </td>
                  <td>
                    <b>{r.cited}</b>
                  </td>
                  <td>
                    <span
                      className={
                        r.brandMentioned === "yes" ? "mention-yes" : "mention-no"
                      }
                    >
                      {r.brandMentioned === "yes" ? t("citations.yes") : t("citations.no")}
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
                        >
                          <BrandLogo
                            className="comp-pill-logo"
                            domain={c.domain}
                            name={c.name}
                          />
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="bvi-empty">
                    {starredOnly ? "暂无星标引用" : "暂无引用"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="panel table-panel">
        <div className="panel-head">
          <div>
            <h3>{t("overview.topPromptsDomain")}</h3>
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
    </div>
  );
}
