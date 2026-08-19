import type { PageKey } from "./types";

export const brandReportItems: Array<{ key: PageKey; icon: string; label: string }> = [
  { key: "overview", icon: "⌂", label: "总览" },
  { key: "prompts", icon: "◎", label: "Prompts" },
  { key: "citations", icon: "↗", label: "引用" },
  { key: "recommendations", icon: "✓", label: "建议" },
  { key: "brand-settings", icon: "⚙", label: "品牌设置" },
];

export const navGroups: Array<{
  label: string;
  add?: boolean;
  items: Array<{ key: PageKey; icon: string; label: string }>;
}> = [
  {
    label: "品牌报告",
    add: true,
    items: brandReportItems,
  },
  {
    label: "通用",
    items: [
      { key: "research", icon: "✦", label: "Prompt 研究" },
      { key: "content", icon: "✎", label: "内容生成" },
      { key: "reports", icon: "▤", label: "报告中心" },
    ],
  },
];
