"use client";

import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import type { BviMetrics } from "@/lib/metrics/types";
import { PanelTitle } from "./ui";

function formatBviDate(raw: string): string {
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
  return `${Number(m[3])} ${months[Number(m[2]) - 1]} ${m[1]}`;
}

export function BrandVisibilityIndexPanel({
  bvi,
  colorByBrand,
}: {
  bvi: BviMetrics;
  colorByBrand: Map<string, string>;
}) {
  const frames = bvi.frames;
  const last = Math.max(0, frames.length - 1);
  const [idx, setIdx] = useState(last);
  const [playing, setPlaying] = useState(false);
  const [sortKey, setSortKey] = useState<"coverage" | "likelihood">("coverage");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const frameKey = `${frames[0]?.date ?? ""}|${frames[last]?.date ?? ""}|${frames.length}`;

  useEffect(() => {
    setIdx(last);
    setPlaying(false);
  }, [frameKey, last]);

  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const timer = window.setInterval(() => {
      setIdx((prev) => {
        if (prev >= frames.length - 1) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 420);
    return () => window.clearInterval(timer);
  }, [playing, frames.length]);

  const frame = frames[Math.min(idx, last)];
  const brands = frame?.brands ?? [];
  const sorted = [...brands].sort((a, b) => {
    const av = sortKey === "coverage" ? a.coverage : a.likelihoodToBuy;
    const bv = sortKey === "coverage" ? b.coverage : b.likelihoodToBuy;
    return sortDir === "desc" ? bv - av : av - bv;
  });

  const toggleSort = (key: "coverage" | "likelihood") => {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const startDate = frames[0]?.date ?? "";
  const endDate = frames[last]?.date ?? "";
  const progress = last === 0 ? 100 : (idx / last) * 100;

  return (
    <article className="panel bvi-panel">
      <div className="bvi-head">
        <PanelTitle
          title={t("bvi.title")}
          tip="横轴为品牌覆盖率，纵轴购买可能性由平均出现位次换算（估算；位次越靠前分数越高）。四象限：领导者 / 利基 / 低转化 / 低表现。可用时间轴回放每日位置变化。"
        />
        <div className="bvi-lapse">
          <span className="bvi-date">{formatBviDate(startDate)}</span>
          <div className="bvi-slider-wrap">
            <input
              className="bvi-slider"
              type="range"
              min={0}
              max={last}
              step={1}
              value={Math.min(idx, last)}
              disabled={frames.length < 2}
              aria-label="Brand Visibility Index time-lapse"
              onChange={(e) => {
                setPlaying(false);
                setIdx(Number(e.target.value));
              }}
              style={{ ["--bvi-progress" as string]: `${progress}%` }}
            />
          </div>
          <span className="bvi-date">{formatBviDate(frame?.date || endDate)}</span>
          <button
            type="button"
            className={`bvi-play${playing ? " playing" : ""}`}
            disabled={frames.length < 2}
            onClick={() => {
              if (playing) {
                setPlaying(false);
                return;
              }
              if (idx >= last) setIdx(0);
              setPlaying(true);
            }}
          >
            <em aria-hidden>{playing ? "❚❚" : "▶"}</em>
            {playing ? "Pause" : "Play time-lapse"}
          </button>
        </div>
      </div>

      <div className="bvi-body">
        <div className="bvi-chart" aria-label="Brand Visibility Index scatter">
          <div className="bvi-y-axis" aria-hidden>
            <span>100</span>
            <span>75</span>
            <span>50</span>
            <span>25</span>
            <span>0</span>
          </div>
          <div className="bvi-plot">
            <div
              className="bvi-mid-x"
              style={{ left: `${bvi.coverageMid}%` }}
            />
            <div
              className="bvi-mid-y"
              style={{ top: `calc(${100 - bvi.likelihoodMid}% - 14px)` }}
            />
            <span
              className="bvi-q niche"
              style={{
                left: 12,
                top: 12,
                maxWidth: `calc(${bvi.coverageMid}% - 16px)`,
              }}
            >
              Niche
            </span>
            <span
              className="bvi-q leaders"
              style={{ right: 12, top: 12 }}
            >
              Leaders
            </span>
            <span
              className="bvi-q low-perf"
              style={{ left: 12, bottom: 36 }}
            >
              Low Performance
            </span>
            <span
              className="bvi-q low-conv"
              style={{ right: 12, bottom: 36 }}
            >
              Low Conversion
            </span>
            {brands.map((b) => {
              const color = colorByBrand.get(b.brandId) || "#3F3D89";
              const left = Math.max(2, Math.min(96, b.coverage));
              const top = Math.max(2, Math.min(96, 100 - b.likelihoodToBuy));
              return (
                <div
                  key={b.brandId}
                  className={`bvi-point${b.isPrimary ? " primary" : ""}`}
                  style={{ left: `${left}%`, top: `${top}%` }}
                  title={`${b.name}: coverage ${b.coverage}%, LTB ${b.likelihoodToBuy}`}
                >
                  <i style={{ background: color }} />
                  <span>{b.name}</span>
                </div>
              );
            })}
            <div className="bvi-x-axis" aria-hidden>
              <span>0</span>
              <span>Brand Coverage %</span>
              <span>100</span>
            </div>
          </div>
        </div>

        <div className="bvi-table-wrap">
          <table className="bvi-table">
            <thead>
              <tr>
                <th>Brand</th>
                <th>
                  <button type="button" onClick={() => toggleSort("coverage")}>
                    Brand Coverage
                    <em>{sortKey === "coverage" ? (sortDir === "desc" ? "↓" : "↑") : "↕"}</em>
                  </button>
                </th>
                <th>
                  <button type="button" onClick={() => toggleSort("likelihood")}>
                    {t("bvi.likelihood")}
                    <em>{sortKey === "likelihood" ? (sortDir === "desc" ? "↓" : "↑") : "↕"}</em>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((b) => (
                <tr key={b.brandId} className={b.isPrimary ? "primary" : ""}>
                  <td>
                    <i
                      className="kpi-dot"
                      style={{
                        background: colorByBrand.get(b.brandId) || "#3F3D89",
                      }}
                    />
                    <b>{b.name}</b>
                    {b.isPrimary ? <small className="you-label">你</small> : null}
                  </td>
                  <td>{b.coverage}%</td>
                  <td>{b.likelihoodToBuy}</td>
                </tr>
              ))}
              {!sorted.length ? (
                <tr>
                  <td colSpan={3} className="bvi-empty">
                    当前时间窗暂无 BVI 数据
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </article>
  );
}
