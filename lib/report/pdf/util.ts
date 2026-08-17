export function esc(text: unknown): string {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function todayYmd(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fmtDateZh(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso).slice(0, 10));
  if (!m) return iso || "—";
  return `${m[1]}年${Number(m[2])}月${Number(m[3])}日`;
}

/** Short date like "7 Aug" for chart axis / header meta. */
export function fmtDateShort(iso: string): string {
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
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso).slice(0, 10));
  if (!m) return iso || "—";
  return `${Number(m[3])} ${months[Number(m[2]) - 1]}`;
}

export function localizeFilterLabel(label: string): string {
  const map: Record<string, string> = {
    "All Engines": "全部引擎",
    "All tags": "全部标签",
    "All markets": "全部市场",
    "Month to date": "本月至今",
    "Last month": "上个月",
    "Last 14 days": "过去 14 天",
    "Last 30 days": "过去 30 天",
    "Last 60 days": "过去 60 天",
    "Last 90 days": "过去 90 天",
    全部平台: "全部引擎",
  };
  if (map[label]) return map[label];
  const m = /^Last (\d+) days$/i.exec(label);
  if (m) return `过去 ${m[1]} 天`;
  // Already zh or custom ISO range — pass through
  return label;
}

export function quadrantZh(
  coverage: number,
  likelihood: number,
  midCov = 50,
  midLtb = 50,
): string {
  if (coverage >= midCov && likelihood >= midLtb) return "领导者";
  if (coverage < midCov && likelihood >= midLtb) return "利基";
  if (coverage >= midCov && likelihood < midLtb) return "低转化";
  return "低表现";
}

export function initialMark(name: string): string {
  const s = String(name || "?").trim();
  return (s[0] || "?").toUpperCase();
}
