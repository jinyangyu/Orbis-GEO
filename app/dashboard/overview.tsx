"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PromptHoverText from "../prompt-hover-text";
import { SentimentCell } from "../sentiment-cell";
import { t } from "@/lib/i18n";
import type { OverviewMetrics, PromptCountRow } from "@/lib/metrics/types";
import { BrandLogo } from "./brand-logo";
import { BrandVisibilityIndexPanel } from "./bvi-panel";
import { TrendCoverageChart, trendSeries } from "./trend-chart";
import { FilterEmptyStage } from "./filter-empty";
import {
  ChartSkeleton,
  KpiPanelSkeleton,
  MetricCardsSkeleton,
  NoticeSkeleton,
  TablePanelSkeleton,
} from "./skeleton";
import {
  InfoTip,
  KpiTitle,
  PanelTitle,
  Sparkline,
  TREND_PALETTE,
} from "./ui";

export function Overview({
  data,
  loadingCore = false,
  topPromptRows = [],
  loadingPrompts = false,
  onOpenPrompts,
  onOpenRecs,
  onOpenCitations,
  onOpenDetected,
}: {
  data: OverviewMetrics | null;
  loadingCore?: boolean;
  topPromptRows?: PromptCountRow[];
  loadingPrompts?: boolean;
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

  const ranking = data?.ranking ?? [];

  const colorByBrand = useMemo(() => {
    const map = new Map<string, string>();
    ranking.forEach((row, i) => {
      map.set(row.brandId, TREND_PALETTE[i % TREND_PALETTE.length]);
    });
    return map;
  }, [ranking]);

  const visibleBrandIds = useMemo(() => {
    const primary = ranking.find((r) => r.isPrimary);
    const competitors = ranking.filter((r) => !r.isPrimary);
    const picked =
      mePlus === "all"
        ? [primary, ...competitors]
        : [primary, ...competitors.slice(0, 5)];
    return new Set(
      picked.filter(Boolean).map((r) => r!.brandId),
    );
  }, [ranking, mePlus]);

  const series = useMemo(() => {
    if (!data) return [];
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
  }, [data, visibleBrandIds]);

  const colors = series.map(
    (s) => colorByBrand.get(s.brandId) || TREND_PALETTE[0],
  );
  const mePlusLabel =
    mePlus === "all" ? t("overview.mePlusAll") : t("overview.mePlusTop5");
  const coreReady = Boolean(data) && !loadingCore;
  const mentionPrompts = topPromptRows;
  const filterEmpty = Boolean(data && !loadingCore && data.observationCount === 0);

  return (
    <FilterEmptyStage empty={filterEmpty}>
      <div className="dashboard-grid overview-top overview-chart-row">
        {!coreReady ? (
          <ChartSkeleton title={t("overview.coverageTrend")} />
        ) : (
        <article className="panel trend-panel">
          <div className="panel-head">
            <PanelTitle
              title={t("overview.coverageTrend")}
              tip={t("overview.coverageTrendTip")}
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
                      {t("overview.mePlusAll")}
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
                      {t("overview.mePlusTop5")}
                    </button>
                  </li>
                </ul>
              )}
            </div>
          </div>
          <div className="trend-body">
            <TrendCoverageChart trend={data!.trend} series={series} colors={colors} />
          </div>
        </article>
        )}
        <div className="kpi-column">
          {!coreReady ? (
            <>
              <KpiPanelSkeleton title={t("overview.brandMentions")} />
              <KpiPanelSkeleton title={t("overview.avgPosition")} />
            </>
          ) : (
          <>
          <article className="panel kpi-stack">
            <KpiTitle
              title={t("overview.brandMentions")}
              tip={t("overview.brandMentionsTip")}
            />
            <div className="kpi-hero">{data!.primaryMentions}</div>
            <div className="kpi-list">
              {data!.competitorMentions.map((c) => {
                const brand = data!.ranking.find((r) => r.name === c.name);
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
              title={t("overview.avgPosition")}
              tip={t("overview.avgPositionTip")}
            />
            <div className="kpi-hero">
              {data!.avgPosition == null ? "—" : data!.avgPosition.toFixed(2)}
            </div>
            <div className="kpi-list">
              {data!.competitorPositions.map((c) => {
                const brand = data!.ranking.find((r) => r.name === c.name);
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
          </>
          )}
        </div>
      </div>

      <div className="twin-tables">
        {!coreReady ? (
          <TablePanelSkeleton title="品牌排名" cols={4} />
        ) : (
        <article className="panel table-panel">
          <div className="panel-head">
            <PanelTitle
              title="品牌排名"
              tip="按提及次数、覆盖率与声量份额汇总的品牌竞争榜。情感取自答卷标注；无数据时显示「—」。"
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
                  <th>{t("sentiment.pending")}</th>
                  <th>提及</th>
                  <th>覆盖率</th>
                  <th>SOV</th>
                </tr>
              </thead>
              <tbody>
                {ranking.slice(0, 6).map((r, i) => (
                  <tr key={r.brandId}>
                    <td>{i + 1}</td>
                    <td>
                      <span className="comp-dot">
                        <BrandLogo
                          className="comp-dot-logo"
                          domain={r.domain}
                          name={r.name}
                        />
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
        )}
        {loadingPrompts ? (
          <TablePanelSkeleton title={t("overview.topPromptsMentions")} cols={1} />
        ) : (
        <article className="panel table-panel">
          <div className="panel-head">
            <PanelTitle
              title={t("overview.topPromptsMentions")}
              tip={t("overview.topPromptsMentionsTip")}
            />
            <button className="text-button" onClick={onOpenPrompts}>
              {t("action.viewFullReport")}
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
                {mentionPrompts.map((p, i) => (
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
        )}
      </div>

      {!coreReady ? (
        <NoticeSkeleton />
      ) : (
      <div className="notice notice-insight">
        <span>✦</span>
        <div>
          <b>{data!.notice.title}</b>
          <p>
            基于 {data!.promptTotal} 个 Prompt、{data!.observationCount} 条答卷。
            {data!.notice.body}
          </p>
        </div>
        <button onClick={onOpenRecs}>查看建议 →</button>
      </div>
      )}
      {!coreReady ? (
        <MetricCardsSkeleton />
      ) : (
      <div className="metric-grid">
        {data!.metrics.map((metric, index) => (
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
      )}

      {!coreReady ? (
        <TablePanelSkeleton title={t("bvi.title")} cols={3} rows={4} />
      ) : (
      <BrandVisibilityIndexPanel
        bvi={data!.bvi ?? { coverageMid: 50, likelihoodMid: 50, frames: [] }}
        colorByBrand={colorByBrand}
      />
      )}

      {!coreReady ? (
        <div className="dashboard-grid overview-top">
          <ChartSkeleton title={t("overview.domainCoverage")} />
          <div className="kpi-column">
            <KpiPanelSkeleton title={t("overview.domainCitation")} />
            <KpiPanelSkeleton title={t("overview.citationShare")} />
          </div>
        </div>
      ) : (
      <div className="dashboard-grid overview-top">
        <article className="panel trend-panel">
          <div className="panel-head">
            <PanelTitle
              title={t("overview.domainCoverage")}
              tip={`各 AI 引擎答卷中，本品官网域名被引用的覆盖率（当前 ${data!.domainCoverage}%）。品牌被提及但官网未被引用时，说明存在可引用性缺口。`}
            />
            <button className="text-button" onClick={onOpenCitations}>
              {t("overview.fullCitations")}
            </button>
          </div>
          <div className="trend-body">
            <div className="engine-list">
              {data!.engines.map((e) => (
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
              title={t("overview.domainCitation")}
              tip={t("overview.domainCitationTip")}
            />
            <div className="kpi-hero">{data!.domainCitations}</div>
            <div className="kpi-list">
              {data!.competitorDomainCites.map((c) => (
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
              title={t("overview.citationShare")}
              tip={t("overview.citationShareTip")}
            />
            <div className="kpi-hero">{data!.citationShare}%</div>
            <div className="kpi-list">
              {data!.topCitedUrls.slice(0, 3).map((u) => (
                <div className="kpi-mini" key={u.url}>
                  <span title={u.url}>{u.title || u.url}</span>
                  <b>{u.cited}</b>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
      )}

      {!coreReady ? (
        <div className="twin-tables">
          <TablePanelSkeleton title="域名引用" cols={3} />
          <TablePanelSkeleton title={t("overview.topPromptsDomain")} cols={1} />
        </div>
      ) : (
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
                {data!.domainCitationTable.map((d, i) => (
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
              title={t("overview.topPromptsDomain")}
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
                {data!.topPromptsByDomainCites.map((p, i) => (
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
      )}
    </FilterEmptyStage>
  );
}
