/** Otterly-style date range presets and calendar helpers. */

export type DatePresetId =
  | "mtd"
  | "last_month"
  | "14"
  | "30"
  | "60"
  | "90"
  | "custom";

export type DateRangeValue = {
  preset: DatePresetId;
  /** Display label (locale-dependent; prefer resolving via i18n in UI). */
  label: string;
  from: string;
  to: string;
  days: number;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(raw: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.slice(0, 10));
  if (!m) return new Date();
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function daysBetween(from: Date, to: Date): number {
  const ms = to.setHours(0, 0, 0, 0) - from.setHours(0, 0, 0, 0);
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

/** Default labels are zh (China market). EN aliases remain accepted by filter helpers. */
export const DATE_PRESETS: Array<{
  id: Exclude<DatePresetId, "custom">;
  labelKey: string;
  label: string;
}> = [
  { id: "mtd", labelKey: "date.mtd", label: "本月至今" },
  { id: "last_month", labelKey: "date.last_month", label: "上个月" },
  { id: "14", labelKey: "date.14", label: "过去 14 天" },
  { id: "30", labelKey: "date.30", label: "过去 30 天" },
  { id: "60", labelKey: "date.60", label: "过去 60 天" },
  { id: "90", labelKey: "date.90", label: "过去 90 天" },
];

const PRESET_LABEL: Record<Exclude<DatePresetId, "custom">, string> = {
  mtd: "本月至今",
  last_month: "上个月",
  "14": "过去 14 天",
  "30": "过去 30 天",
  "60": "过去 60 天",
  "90": "过去 90 天",
};

export function buildPresetRange(
  id: Exclude<DatePresetId, "custom">,
  today = new Date(),
  labelOverride?: string,
): DateRangeValue {
  const label = labelOverride ?? PRESET_LABEL[id];
  const to = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (id === "mtd") {
    const from = startOfMonth(to);
    return {
      preset: id,
      label,
      from: toISODate(from),
      to: toISODate(to),
      days: daysBetween(new Date(from), new Date(to)),
    };
  }
  if (id === "last_month") {
    const ref = new Date(to.getFullYear(), to.getMonth() - 1, 15);
    const from = startOfMonth(ref);
    const end = endOfMonth(ref);
    return {
      preset: id,
      label,
      from: toISODate(from),
      to: toISODate(end),
      days: daysBetween(new Date(from), new Date(end)),
    };
  }
  const n = Number(id);
  const from = addDays(to, -(n - 1));
  return {
    preset: id,
    label,
    from: toISODate(from),
    to: toISODate(to),
    days: n,
  };
}

export function buildCustomRange(from: string, to: string): DateRangeValue {
  const a = parseISODate(from);
  const b = parseISODate(to);
  const start = a <= b ? a : b;
  const end = a <= b ? b : a;
  return {
    preset: "custom",
    label: `${toISODate(start)} → ${toISODate(end)}`,
    from: toISODate(start),
    to: toISODate(end),
    days: daysBetween(new Date(start), new Date(end)),
  };
}

export function monthMatrix(year: number, month: number): Array<Array<Date | null>> {
  const first = new Date(year, month, 1);
  const startPad = first.getDay(); // Sun=0
  const days = endOfMonth(first).getDate();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: Array<Array<Date | null>> = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

/** zh month names (default market). Use i18n `month.N` in UI when locale is en. */
export const MONTH_NAMES = [
  "1月",
  "2月",
  "3月",
  "4月",
  "5月",
  "6月",
  "7月",
  "8月",
  "9月",
  "10月",
  "11月",
  "12月",
];
