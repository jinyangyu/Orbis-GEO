"use client";

import { useEffect, useRef, useState } from "react";
import type { TrendPoint } from "@/lib/metrics/types";
import {
  TREND_PALETTE,
  coverageAxisMax,
  formatTrendDate,
  seriesSmoothPath,
} from "./ui";

export function trendSeries(trend: TrendPoint[]) {
  const first = trend[0]?.series ?? [];
  return first.map((s) => ({
    brandId: s.brandId,
    name: s.name,
    values: trend.map(
      (t) => t.series.find((x) => x.brandId === s.brandId)?.coverage ?? 0,
    ),
  }));
}

/** Pick sparse axis ticks like Otterly: "15 Jul", "13 Aug". */
function trendAxisTicks(trend: TrendPoint[], maxTicks = 5) {
  if (!trend.length) return [{ date: "—", label: "—", index: 0 }];
  const n = trend.length;
  const count = Math.min(Math.max(3, maxTicks), n);
  const indexes =
    count <= 1
      ? [0]
      : Array.from({ length: count }, (_, i) =>
          Math.round((i * (n - 1)) / (count - 1)),
        );
  const uniq = [...new Set(indexes)];
  return uniq.map((index) => {
    const raw = String(trend[index]?.date ?? "").slice(0, 10);
    return {
      date: raw || "—",
      label: formatTrendDate(raw || "—"),
      index,
    };
  });
}

export function TrendCoverageChart({
  trend,
  series,
  colors,
}: {
  trend: TrendPoint[];
  series: Array<{ brandId: string; name: string; values: number[] }>;
  colors: string[];
}) {
  const plotRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<{
    index: number;
    xPct: number;
  } | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const seriesKey = series.map((s) => s.brandId).join("|");
  useEffect(() => {
    setHidden(new Set());
  }, [seriesKey]);

  const axisTicks = trendAxisTicks(trend);
  const trendLen = Math.max(trend.length - 1, 1);
  const activeSeries = series.filter((s) => !hidden.has(s.brandId));
  const maxY = coverageAxisMax(activeSeries.flatMap((s) => s.values));

  const updateHover = (clientX: number) => {
    const el = plotRef.current;
    if (!el || trend.length === 0) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const index = Math.round(ratio * (trend.length - 1));
    setHover({
      index,
      xPct: (index / trendLen) * 100,
    });
  };

  const tip = hover
    ? {
        date: formatTrendDate(trend[hover.index]?.date ?? ""),
        rows: activeSeries.map((s) => {
          const i = series.findIndex((x) => x.brandId === s.brandId);
          return {
            name: s.name,
            color: colors[i] || TREND_PALETTE[0],
            value: s.values[hover.index] ?? 0,
          };
        }),
      }
    : null;

  const yTicks = [1, 0.75, 0.5, 0.25, 0].map((r) => Math.round(maxY * r));

  const toggleBrand = (brandId: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(brandId)) next.delete(brandId);
      else {
        // Keep at least one series visible.
        if (series.length - next.size <= 1) return prev;
        next.add(brandId);
      }
      return next;
    });
  };

  return (
    <>
      <div className="chart-wrap">
        <div className="y-axis-block" aria-hidden>
          <span className="y-axis-title">Brand Coverage %</span>
          <div className="y-axis">
            {yTicks.map((v, i) => (
              <span key={`${v}-${i}`}>{v}%</span>
            ))}
          </div>
        </div>
        <div
          className="line-chart"
          ref={plotRef}
          onMouseMove={(e) => updateHover(e.clientX)}
          onMouseLeave={() => setHover(null)}
        >
          <div className="grid-lines" />
          <svg
            viewBox="0 0 700 240"
            preserveAspectRatio="none"
            aria-label="品牌覆盖趋势图"
          >
            {activeSeries.map((s) => {
              const i = series.findIndex((x) => x.brandId === s.brandId);
              const color = colors[i] || TREND_PALETTE[0];
              return (
                <path
                  key={s.brandId}
                  d={seriesSmoothPath(s.values, maxY)}
                  fill="none"
                  stroke={color}
                  strokeWidth={2.1}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
            {hover &&
              activeSeries.map((s) => {
                const i = series.findIndex((x) => x.brandId === s.brandId);
                const color = colors[i] || TREND_PALETTE[0];
                const v = s.values[hover.index] ?? 0;
                const x = (hover.index / trendLen) * 700;
                const y = 220 - (v / maxY) * 180;
                return (
                  <g key={`dot-${s.brandId}`}>
                    <circle
                      cx={x}
                      cy={y}
                      r={6}
                      fill={color}
                      opacity={0.18}
                      vectorEffect="non-scaling-stroke"
                    />
                    <circle
                      cx={x}
                      cy={y}
                      r={3.2}
                      fill="#fff"
                      stroke={color}
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                );
              })}
          </svg>
          {hover && (
            <>
              <div className="chart-guide" style={{ left: `${hover.xPct}%` }} />
              <div
                className={`chart-tooltip${hover.xPct > 62 ? " chart-tooltip-left" : ""}`}
                style={{ left: `${hover.xPct}%` }}
              >
                <b>{tip?.date}</b>
                <ul>
                  {tip?.rows.map((row) => (
                    <li key={row.name}>
                      <i style={{ background: row.color }} />
                      <span>{row.name}</span>
                      <strong>{row.value}%</strong>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
          <div className="x-axis">
            {axisTicks.map((tick, i) => {
              const isFirst = i === 0;
              const isLast = i === axisTicks.length - 1;
              return (
                <span
                  key={`${tick.date}-${tick.index}`}
                  style={{
                    left: `${(tick.index / trendLen) * 100}%`,
                    transform: isFirst
                      ? "none"
                      : isLast
                        ? "translateX(-100%)"
                        : "translateX(-50%)",
                  }}
                  title={tick.date}
                >
                  {tick.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>
      <div className="chart-legend">
        {series.map((s, i) => {
          const on = !hidden.has(s.brandId);
          const color = colors[i] || TREND_PALETTE[0];
          return (
            <button
              key={s.brandId}
              type="button"
              className={`legend-item${on ? "" : " off"}`}
              onClick={() => toggleBrand(s.brandId)}
            >
              <span
                className="legend-check"
                style={{ background: on ? color : "#d1d5db" }}
                aria-hidden
              >
                {on ? "✓" : ""}
              </span>
              {s.name}
            </button>
          );
        })}
      </div>
    </>
  );
}
