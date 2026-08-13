/** Otterly-aligned design tokens for brand report PDF. */

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
] as const;

export const PDF_COLORS = {
  ink: "#111827",
  muted: "#6b7280",
  soft: "#9ca3af",
  line: "#e5e7eb",
  softBg: "#f7f8fa",
  white: "#ffffff",
  accent: "#db2777",
  sentimentBg: "#e8f5e9",
  sentimentFg: "#2e7d32",
  leaders: "#8bb84a",
  niche: "#c2783a",
  lowPerf: "#5b8a8a",
  lowConv: "#7c6bc4",
  link: "#db2777",
} as const;

export function brandColor(index: number): string {
  return TREND_PALETTE[index % TREND_PALETTE.length];
}
