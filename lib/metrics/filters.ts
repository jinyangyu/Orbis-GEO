/** Shared filter label ↔ API mapping (locale-agnostic + zh/en aliases). */

export const ALL_ENGINES_LABELS = ["全部引擎", "全部平台", "All Engines"] as const;
export const ALL_TAGS_LABELS = ["全部标签", "All tags"] as const;
export const ALL_MARKETS_LABELS = ["全部市场", "All markets"] as const;

export function isAllEnginesLabel(label: string): boolean {
  return !label || (ALL_ENGINES_LABELS as readonly string[]).includes(label);
}

export function isAllTagsLabel(label: string): boolean {
  return (ALL_TAGS_LABELS as readonly string[]).includes(label);
}

export function isAllMarketsLabel(label: string): boolean {
  return !label || (ALL_MARKETS_LABELS as readonly string[]).includes(label);
}

/** Map date-range UI label → approximate day count for APIs that still use `days`. */
export function daysFromRangeLabel(label: string): number {
  if (/14/.test(label)) return 14;
  if (/60/.test(label)) return 60;
  if (/7\b/.test(label) && !/14|30|60|90/.test(label)) return 7;
  if (/90/.test(label)) return 90;
  if (/月/.test(label) || /month/i.test(label)) return 30;
  if (/30/.test(label)) return 30;
  return 30;
}

/** Map UI engine select label → engine code filter (optional). */
const ENGINE_CODES = [
  "gpt",
  "deepseek",
  "doubao",
  "perplexity",
  "google",
  "gemini",
  "copilot",
  "claude",
] as const;

export function engineFilterFromLabel(label: string): string | undefined {
  if (isAllEnginesLabel(label)) return undefined;
  const asCode = label.trim().toLowerCase();
  if ((ENGINE_CODES as readonly string[]).includes(asCode)) return asCode;
  const map: Record<string, string> = {
    ChatGPT: "gpt",
    DeepSeek: "deepseek",
    Doubao: "doubao",
    豆包: "doubao",
    GPT: "gpt",
    Perplexity: "perplexity",
    "Google AI": "google",
    "Google AI Overview": "google",
    Gemini: "gemini",
    "Google Gemini": "gemini",
    Copilot: "copilot",
    "Microsoft Copilot": "copilot",
    Claude: "claude",
  };
  if (map[label]) return map[label];
  const lower = label.toLowerCase();
  if (lower.includes("chatgpt") || lower === "gpt") return "gpt";
  if (lower.includes("deepseek")) return "deepseek";
  if (lower.includes("doubao") || lower.includes("豆包")) return "doubao";
  if (lower.includes("perplexity")) return "perplexity";
  if (lower.includes("gemini")) return "gemini";
  if (lower.includes("copilot")) return "copilot";
  if (lower.includes("claude")) return "claude";
  if (lower.includes("google")) return "google";
  return undefined;
}
