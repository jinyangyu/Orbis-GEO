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

export const DATE_PRESETS: Array<{
  id: Exclude<DatePresetId, "custom">;
  label: string;
}> = [
  { id: "mtd", label: "Month to date" },
  { id: "last_month", label: "Last month" },
  { id: "14", label: "Last 14 days" },
  { id: "30", label: "Last 30 days" },
  { id: "60", label: "Last 60 days" },
  { id: "90", label: "Last 90 days" },
];

export function buildPresetRange(
  id: Exclude<DatePresetId, "custom">,
  today = new Date(),
): DateRangeValue {
  const to = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (id === "mtd") {
    const from = startOfMonth(to);
    return {
      preset: id,
      label: "Month to date",
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
      label: "Last month",
      from: toISODate(from),
      to: toISODate(end),
      days: daysBetween(new Date(from), new Date(end)),
    };
  }
  const n = Number(id);
  const from = addDays(to, -(n - 1));
  return {
    preset: id,
    label: `Last ${n} days`,
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

export const MONTH_NAMES = [
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
