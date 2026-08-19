"use client";

import { useEffect, useState, type CSSProperties } from "react";
import PromptHoverText from "../prompt-hover-text";
import { t } from "@/lib/i18n";
import type { PromptMetricRow } from "@/lib/metrics/types";

export function Prompts({
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
    <div className="panel table-panel prompts-panel">
      <div className="table-toolbar">
        <div className="search-box">
          <span>⌕</span>
          <input
            placeholder={t("filter.searchPrompt")}
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
              <th>{t("sentiment.pending")}</th>
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
                      {row.sentiment == null ? (
                        <span className="sentiment-value muted">—</span>
                      ) : (
                        <>
                          <span
                            className={`sentiment-value ${row.sentiment >= 70 ? "good" : "neutral"}`}
                          >
                            {row.sentiment >= 0
                              ? `+${row.sentiment}`
                              : String(row.sentiment)}
                          </span>
                          {bd ? (
                            <span
                              className="prompt-sentiment-stack"
                              title={t("sentiment.breakdown")}
                            >
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
                          ) : null}
                        </>
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
                          style={
                            {
                              "--comp-color":
                                COMP_COLORS[i % COMP_COLORS.length],
                            } as CSSProperties
                          }
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
