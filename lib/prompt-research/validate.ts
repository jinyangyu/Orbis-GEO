import type { PromptResearchInput, PromptResearchMode } from "./types";

export class PromptResearchValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromptResearchValidationError";
  }
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function parseKeywords(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((k) => asString(k))
      .filter(Boolean)
      .slice(0, 20);
  }
  if (typeof raw === "string") {
    return raw
      .split(/\r?\n/)
      .map((k) => k.trim())
      .filter(Boolean)
      .slice(0, 20);
  }
  return [];
}

export function parsePromptResearchBody(body: unknown): PromptResearchInput {
  if (!body || typeof body !== "object") {
    throw new PromptResearchValidationError("无效请求体");
  }
  const o = body as Record<string, unknown>;
  const mode = asString(o.mode) as PromptResearchMode;
  if (mode !== "keywords" && mode !== "url" && mode !== "brand") {
    throw new PromptResearchValidationError("mode 必须是 keywords / url / brand");
  }

  const language = asString(o.language) || "简体中文";
  const country = asString(o.country) || "中国大陆";
  const workspaceId = asString(o.workspaceId) || undefined;

  if (mode === "keywords") {
    const keywords = parseKeywords(o.keywords ?? o.keywordsText);
    if (!keywords.length) {
      throw new PromptResearchValidationError("请至少输入 1 个关键词（最多 20 个，一行一个）");
    }
    if (keywords.length > 20) {
      throw new PromptResearchValidationError("关键词最多 20 个");
    }
    return { mode, language, country, workspaceId, keywords };
  }

  if (mode === "url") {
    const url = asString(o.url);
    if (!url) throw new PromptResearchValidationError("请输入 URL");
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new PromptResearchValidationError("URL 格式无效");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new PromptResearchValidationError("URL 必须以 http(s) 开头");
    }
    return { mode, language, country, workspaceId, url: parsed.toString() };
  }

  const brandName = asString(o.brandName);
  if (!brandName) throw new PromptResearchValidationError("请输入品牌名称");
  return {
    mode,
    language,
    country,
    workspaceId,
    brandName,
    brandDomain: asString(o.brandDomain),
    brandIndustry: asString(o.brandIndustry),
  };
}
