"use client";

export function Sparkline({
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

export function Donut({ value, color = "#5b6cff" }: { value: number; color?: string }) {
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
export const TREND_PALETTE = [
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
export function coverageAxisMax(values: number[]): number {
  const peak = Math.max(0, ...values);
  if (peak <= 0) return 20;
  const padded = peak * 1.12;
  const step = padded <= 25 ? 5 : padded <= 60 ? 10 : 20;
  return Math.min(100, Math.max(step * 2, Math.ceil(padded / step) * step));
}

/** Smooth Catmull-Rom spline → cubic Bezier (Otterly-style curves). */
export function seriesSmoothPath(values: number[], maxY: number): string {
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

export function formatTrendDate(raw: string): string {
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

export function InfoTip({ text, align = "right" }: { text: string; align?: "left" | "right" }) {
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

export function PanelTitle({
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

export function KpiTitle({ title, tip }: { title: string; tip: string }) {
  return (
    <div className="kpi-title">
      <h3>{title}</h3>
      <InfoTip text={tip} />
    </div>
  );
}
