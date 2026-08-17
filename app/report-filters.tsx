"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import {
  DATE_PRESETS,
  MONTH_NAMES,
  buildCustomRange,
  buildPresetRange,
  monthMatrix,
  parseISODate,
  toISODate,
  type DateRangeValue,
} from "@/lib/report/date-range";
import {
  isAllEnginesLabel,
  isAllMarketsLabel,
  isAllTagsLabel,
} from "@/lib/metrics/filters";

export type EngineOption = { code: string; name: string; mark: string };

type Props = {
  dateRange: DateRangeValue;
  onDateRangeChange: (v: DateRangeValue) => void;
  engine: string;
  onEngineChange: (v: string) => void;
  engines: EngineOption[];
  tag: string;
  onTagChange: (v: string) => void;
  tags: string[];
  market: string;
  onMarketChange: (v: string) => void;
  markets: string[];
  promptTotal: number;
  filteredPromptCount?: number;
  onReset: () => void;
  busy?: boolean;
};

export default function ReportFilters({
  dateRange,
  onDateRangeChange,
  engine,
  onEngineChange,
  engines,
  tag,
  onTagChange,
  tags,
  market,
  onMarketChange,
  markets,
  promptTotal,
  filteredPromptCount,
  onReset,
  busy = false,
}: Props) {
  const [open, setOpen] = useState<"date" | "tag" | "engine" | "market" | null>(
    null,
  );
  const rootRef = useRef<HTMLDivElement | null>(null);
  const allEngines = t("filter.allEngines");
  const allTags = t("filter.allTags");
  const allMarkets = t("filter.allMarkets");
  const showing =
    filteredPromptCount == null ? promptTotal : filteredPromptCount;
  const filtersDirty =
    dateRange.preset !== "30" ||
    !isAllEnginesLabel(engine) ||
    !isAllTagsLabel(tag) ||
    !isAllMarketsLabel(market);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="report-filters" ref={rootRef} aria-busy={busy || undefined}>
      <div className="filter-row">
        <div className="filter-slot">
          <FilterChip
            active={open === "date"}
            label={dateRange.label}
            onClick={() => setOpen((v) => (v === "date" ? null : "date"))}
          />
          {open === "date" && (
            <DatePopover
              value={dateRange}
              onChange={(v) => {
                onDateRangeChange(v);
                if (v.preset !== "custom") setOpen(null);
              }}
              onClose={() => setOpen(null)}
            />
          )}
        </div>
        <div className="filter-slot">
          <FilterChip
            active={open === "tag"}
            label={tag}
            onClick={() => setOpen((v) => (v === "tag" ? null : "tag"))}
          />
          {open === "tag" && (
            <SimpleMenu
              options={[allTags, ...tags]}
              value={tag}
              onPick={(v) => {
                onTagChange(v);
                setOpen(null);
              }}
            />
          )}
        </div>
        <div className="filter-slot">
          <FilterChip
            active={open === "engine"}
            label={engine}
            onClick={() => setOpen((v) => (v === "engine" ? null : "engine"))}
          />
          {open === "engine" && (
            <EngineMenu
              engines={engines}
              value={engine}
              allLabel={allEngines}
              onPick={(v) => {
                onEngineChange(v);
                setOpen(null);
              }}
            />
          )}
        </div>
        <div className="filter-slot">
          <FilterChip
            active={open === "market"}
            label={market || allMarkets}
            onClick={() => setOpen((v) => (v === "market" ? null : "market"))}
          />
          {open === "market" && (
            <SimpleMenu
              options={[allMarkets, ...markets]}
              value={market || allMarkets}
              onPick={(v) => {
                onMarketChange(v === allMarkets ? "" : v);
                setOpen(null);
              }}
            />
          )}
        </div>
      </div>

      <p className="filter-summary">
        {t("report.basedOn", { n: promptTotal })}
        <span className="filter-range">
          {" · "}
          {dateRange.from} ～ {dateRange.to}
        </span>
        {filteredPromptCount != null && (
          <> {t("report.showingFiltered", { n: showing })}</>
        )}
        {filtersDirty && (
          <button type="button" className="reset-filters" onClick={onReset}>
            {t("action.resetFilters")}
          </button>
        )}
      </p>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`filter-chip${active ? " open" : ""}`}
      onClick={onClick}
    >
      <span>{label}</span>
      <em>▾</em>
    </button>
  );
}

function SimpleMenu({
  options,
  value,
  onPick,
}: {
  options: string[];
  value: string;
  onPick: (v: string) => void;
}) {
  return (
    <ul className="filter-menu" role="listbox">
          {options.length ? (
            options.map((opt) => (
              <li key={opt}>
                <button
                  type="button"
                  role="option"
                  aria-selected={opt === value}
                  className={opt === value ? "active" : ""}
                  onClick={() => onPick(opt)}
                >
                  {opt}
                </button>
              </li>
            ))
          ) : (
            <li className="filter-empty">暂无可选项</li>
          )}
    </ul>
  );
}

function EngineMenu({
  engines,
  value,
  allLabel,
  onPick,
}: {
  engines: EngineOption[];
  value: string;
  allLabel: string;
  onPick: (v: string) => void;
}) {
  return (
    <ul className="filter-menu engine-menu" role="listbox">
      <li>
        <button
          type="button"
          className={isAllEnginesLabel(value) ? "active" : ""}
          onClick={() => onPick(allLabel)}
        >
          <i className="engine-mark all">∗</i>
          {allLabel}
        </button>
      </li>
      {engines.map((e) => (
        <li key={e.code}>
          <button
            type="button"
            className={value === e.name || value === e.code ? "active" : ""}
            onClick={() => onPick(e.name)}
          >
            <i className="engine-mark">{e.mark}</i>
            {e.name}
          </button>
        </li>
      ))}
    </ul>
  );
}

function DatePopover({
  value,
  onChange,
  onClose,
}: {
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
  onClose: () => void;
}) {
  const start = parseISODate(value.from);
  const [view, setView] = useState(
    () => new Date(start.getFullYear(), start.getMonth(), 1),
  );
  const [draftStart, setDraftStart] = useState<string | null>(null);

  useEffect(() => {
    const from = parseISODate(value.from);
    setView(new Date(from.getFullYear(), from.getMonth(), 1));
    setDraftStart(null);
  }, [value.from, value.to, value.preset]);
  const left = view;
  const right = useMemo(
    () => new Date(view.getFullYear(), view.getMonth() + 1, 1),
    [view],
  );

  const inRange = (d: Date) => {
    const iso = toISODate(d);
    return iso >= value.from && iso <= value.to;
  };
  const isStart = (d: Date) => toISODate(d) === value.from;
  const isEnd = (d: Date) => toISODate(d) === value.to;

  const pickDay = (d: Date) => {
    const iso = toISODate(d);
    if (!draftStart) {
      setDraftStart(iso);
      return;
    }
    onChange(buildCustomRange(draftStart, iso));
    setDraftStart(null);
    onClose();
  };

  return (
    <div className="date-popover" role="dialog" aria-label={t("date.custom")}>
      <aside className="date-presets">
        {DATE_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={value.preset === p.id ? "active" : ""}
            onClick={() => onChange(buildPresetRange(p.id, new Date(), t(p.labelKey)))}
          >
            {t(p.labelKey)}
          </button>
        ))}
      </aside>
      <div className="date-calendars">
        <div className="cal-nav">
          <button
            type="button"
            aria-label="Previous year"
            onClick={() =>
              setView(new Date(view.getFullYear() - 1, view.getMonth(), 1))
            }
          >
            «
          </button>
          <button
            type="button"
            aria-label="Previous month"
            onClick={() =>
              setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))
            }
          >
            ‹
          </button>
          <span />
          <button
            type="button"
            aria-label="Next month"
            onClick={() =>
              setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))
            }
          >
            ›
          </button>
          <button
            type="button"
            aria-label="Next year"
            onClick={() =>
              setView(new Date(view.getFullYear() + 1, view.getMonth(), 1))
            }
          >
            »
          </button>
        </div>
        <div className="cal-pair">
          <MonthCal
            year={left.getFullYear()}
            month={left.getMonth()}
            inRange={inRange}
            isStart={isStart}
            isEnd={isEnd}
            draftStart={draftStart}
            onPick={pickDay}
          />
          <MonthCal
            year={right.getFullYear()}
            month={right.getMonth()}
            inRange={inRange}
            isStart={isStart}
            isEnd={isEnd}
            draftStart={draftStart}
            onPick={pickDay}
          />
        </div>
        <p className="date-hint">
          {value.from} → {value.to}
          {draftStart
            ? " · 已选起始日，再点结束日"
            : " · 点选两个日期可自定义范围"}
        </p>
      </div>
    </div>
  );
}

function MonthCal({
  year,
  month,
  inRange,
  isStart,
  isEnd,
  draftStart,
  onPick,
}: {
  year: number;
  month: number;
  inRange: (d: Date) => boolean;
  isStart: (d: Date) => boolean;
  isEnd: (d: Date) => boolean;
  draftStart: string | null;
  onPick: (d: Date) => void;
}) {
  const rows = monthMatrix(year, month);
  const monthLabel = t(`month.${month}`) || MONTH_NAMES[month];
  return (
    <div className="month-cal">
      <h4>
        {monthLabel} {year}
      </h4>
      <div className="dow">
        {"日一二三四五六".split("").map((d, i) => (
          <span key={`${d}-${i}`}>{d}</span>
        ))}
      </div>
      {rows.map((row, ri) => (
        <div className="week" key={ri}>
          {row.map((cell, ci) => {
            if (!cell) return <span key={ci} className="day empty" />;
            const iso = toISODate(cell);
            const start = isStart(cell);
            const end = isEnd(cell);
            const mid = inRange(cell) && !start && !end;
            const draft = draftStart === iso;
            return (
              <button
                key={ci}
                type="button"
                className={`day${start || end ? " edge" : ""}${mid ? " mid" : ""}${draft ? " draft" : ""}`}
                onClick={() => onPick(cell)}
              >
                {cell.getDate()}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
