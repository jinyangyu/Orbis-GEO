"use client";

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
      {["AI 可见度", "品牌覆盖率", "Share of Voice", "官网引用"].map((label) => (
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
    <div className="notice sk-notice">
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
      <NoticeSkeleton />
      <MetricCardsSkeleton />
      <div className="dashboard-grid overview-top">
        <ChartSkeleton title="Brand Coverage Over Time" />
        <div className="kpi-column">
          <KpiSkeleton title="Your Brand Mentions" />
          <KpiSkeleton title="Your Average Brand Position" />
        </div>
      </div>
      <div className="twin-tables">
        <TableSkeleton title="品牌排名" cols={4} />
        <TableSkeleton title="Top Prompts" cols={1} />
      </div>
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
