"use client";

import { useEffect, useRef, useState } from "react";
import type { BrandMatrixRow } from "@/lib/metrics/types";

export function SentimentCell({ row }: { row: BrandMatrixRow }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const cellRef = useRef<HTMLTableCellElement>(null);
  const bd = row.sentimentBreakdown;
  const hasValue = row.sentiment != null;
  const display = hasValue
    ? row.sentiment! >= 0
      ? `+${row.sentiment}`
      : String(row.sentiment)
    : "—";

  useEffect(() => {
    if (!open || !cellRef.current) return;
    const rect = cellRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 8,
      left: Math.min(rect.left, window.innerWidth - 320),
    });
  }, [open]);

  return (
    <td
      ref={cellRef}
      className="sentiment-cell"
      onMouseEnter={() => hasValue && setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => hasValue && setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span
        className={`sentiment-value ${
          !hasValue
            ? "muted"
            : row.sentiment! >= 70
              ? "good"
              : "neutral"
        }`}
      >
        {display}
      </span>
      {open && bd ? (
        <div
          className="sentiment-popover"
          style={{ top: pos.top, left: pos.left }}
          role="tooltip"
        >
          <div className="sentiment-popover-head">
            <div className="sentiment-popover-brand">
              <i style={{ background: row.color }}>{row.name.slice(0, 1)}</i>
              <b>{row.name}</b>
            </div>
            <span className="sentiment-pill">
              {display} (
              {bd.label === "Positive"
                ? "正面"
                : bd.label === "Negative"
                  ? "负面"
                  : bd.label === "Neutral"
                    ? "中性"
                    : "混合"}
              )
            </span>
          </div>
          <div className="sentiment-popover-body">
            <h4>情感分布</h4>
            <div className="sentiment-stack">
              <i style={{ width: `${bd.negativePct}%`, background: "#ef4444" }} />
              <i style={{ width: `${bd.neutralPct}%`, background: "#f59e0b" }} />
              <i style={{ width: `${bd.positivePct}%`, background: "#22c55e" }} />
            </div>
            <div className="sentiment-stack-labels">
              <span>{bd.negativePct}%</span>
              <span>{bd.neutralPct}%</span>
              <span>{bd.positivePct}%</span>
            </div>
            <div className="sentiment-rows">
              <div>
                <span>正面</span>
                <b>{bd.positive}</b>
              </div>
              <div>
                <span>中性</span>
                <b>{bd.neutral}</b>
              </div>
              <div>
                <span>负面</span>
                <b>{bd.negative}</b>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </td>
  );
}
