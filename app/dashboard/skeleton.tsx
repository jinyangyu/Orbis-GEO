"use client";

import { t } from "@/lib/i18n";

function Bar({
  width,
  height = 10,
  radius = 6,
}: {
  width: number | string;
  height?: number;
  radius?: number;
}) {
  return (
    <i
      className="sk"
      style={{ width, height, borderRadius: radius }}
      aria-hidden
    />
  );
}

function ChartMark() {
  return (
    <svg className="sk-chart-mark" viewBox="0 0 48 48" aria-hidden>
      <rect x="6" y="10" width="36" height="28" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 30l8-8 6 5 10-12" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function KpiSkeleton({ title }: { title: string }) {
  return (
    <article className="panel kpi-stack">
      <h3>{title}</h3>
      <Bar width={72} height={28} />
      <div className="kpi-list">
        {[72, 88, 64, 80, 70].map((w, i) => (
          <div className="kpi-mini" key={i}>
            <span>
              <i className="sk sk-dot" />
              <Bar width={w} height={10} />
            </span>
            <Bar width={36} height={10} />
          </div>
        ))}
      </div>
    </article>
  );
}

function TableSkeleton({
  title,
  cols,
  rows = 6,
}: {
  title: string;
  cols: number;
  rows?: number;
}) {
  return (
    <article className="panel table-panel">
      <div className="panel-head">
        <h3>{title}</h3>
      </div>
      <div className="sk-table">
        {Array.from({ length: rows }, (_, i) => (
          <div className="sk-row" key={i}>
            <i className="sk sk-avatar" />
            <Bar width={`${56 + ((i * 13) % 30)}%`} height={10} />
            {Array.from({ length: Math.max(0, cols - 1) }, (__, j) => (
              <Bar key={j} width={40} height={10} />
            ))}
          </div>
        ))}
      </div>
    </article>
  );
}

export function ChartSkeleton({ title }: { title: string }) {
  return (
    <article className="panel trend-panel">
      <div className="panel-head">
        <h3>{title}</h3>
      </div>
      <div className="trend-body">
        <div className="sk-chart">
          <ChartMark />
        </div>
      </div>
    </article>
  );
}

export function MetricCardsSkeleton() {
  return (
    <div className="metric-grid">
      {[t("metric.aiVisibility"), t("metric.brandCoverage"), t("metric.sov"), t("metric.domainCite")].map((label) => (
        <article className="metric-card" key={label}>
          <span>{label}</span>
          <Bar width={92} height={28} />
          <Bar width="100%" height={36} />
        </article>
      ))}
    </div>
  );
}

export function NoticeSkeleton() {
  return (
    <div className="notice notice-insight sk-notice">
      <i className="sk sk-icon" />
      <div>
        <Bar width={200} height={12} />
        <Bar width={280} height={10} />
      </div>
    </div>
  );
}

export function KpiPanelSkeleton({ title }: { title: string }) {
  return <KpiSkeleton title={title} />;
}

export function TablePanelSkeleton({
  title,
  cols,
  rows = 6,
}: {
  title: string;
  cols: number;
  rows?: number;
}) {
  return <TableSkeleton title={title} cols={cols} rows={rows} />;
}

export function OverviewSkeleton() {
  return (
    <div className="page-skeleton" aria-busy="true" aria-label="正在加载监测数据">
      <div className="dashboard-grid overview-top overview-chart-row">
        <ChartSkeleton title={t("overview.coverageTrend")} />
        <div className="kpi-column">
          <KpiSkeleton title={t("overview.brandMentions")} />
          <KpiSkeleton title={t("overview.avgPosition")} />
        </div>
      </div>
      <div className="twin-tables">
        <TableSkeleton title="品牌排名" cols={4} />
        <TableSkeleton title={t("overview.topPromptsMentions")} cols={1} />
      </div>
      <NoticeSkeleton />
      <MetricCardsSkeleton />
    </div>
  );
}

export function TablePageSkeleton({
  title,
  rows = 8,
}: {
  title: string;
  rows?: number;
}) {
  return (
    <div className="page-skeleton" aria-busy="true" aria-label={`正在加载${title}`}>
      <article className="panel table-panel">
        <div className="panel-head">
          <h3>{title}</h3>
        </div>
        <div className="sk-table">
          {Array.from({ length: rows }, (_, i) => (
            <div className="sk-row" key={i}>
              <Bar width={`${48 + ((i * 11) % 40)}%`} height={12} />
              <Bar width={48} height={10} />
              <Bar width={36} height={10} />
              <Bar width={40} height={10} />
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}

export function RecommendationsSkeleton() {
  return (
    <div
      className="recommendations-page"
      aria-busy="true"
      aria-label="正在加载优化建议"
    >
      <section className="audit-hero">
        <div>
          <Bar width={148} height={11} />
          <Bar width={240} height={18} />
          <Bar width="72%" height={12} />
        </div>
      </section>
      <div className="panel audit-list">
        <div className="panel-head">
          <h3>优化建议</h3>
        </div>
        {Array.from({ length: 4 }, (_, i) => (
          <div className="audit-item" key={i}>
            <i className="sk audit-score" />
            <div className="audit-copy">
              <Bar width={`${58 + ((i * 9) % 22)}%`} height={12} />
              <Bar width="86%" height={11} />
              <Bar width={72} height={10} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReportsListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="正在加载报告列表">
      {Array.from({ length: rows }, (_, i) => (
        <div className="report-row" key={i}>
          <i className="sk file-icon" />
          <div>
            <Bar width={`${52 + ((i * 11) % 24)}%`} height={12} />
            <Bar width="42%" height={10} />
          </div>
        </div>
      ))}
    </div>
  );
}
