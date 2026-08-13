import type {
  PromptResearchInput,
  PromptResearchResult,
  ResearchPromptItem,
} from "./types";

const INTENTS = ["信息获取", "对比选型", "购买决策", "问题解决", "替代方案"] as const;
const FUNNELS = ["认知", "考虑", "决策"] as const;

function isZh(language: string): boolean {
  return /中文|Chinese|简体|繁體|zh/i.test(language);
}

function hashScore(text: string, base = 70): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return Math.min(98, Math.max(55, base + (h % 35)));
}

function dedupe(items: ResearchPromptItem[]): ResearchPromptItem[] {
  const seen = new Set<string>();
  const out: ResearchPromptItem[] = [];
  for (const item of items) {
    const key = item.text.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function wrapItem(
  text: string,
  intent?: string,
  funnel?: string,
): ResearchPromptItem {
  return {
    text: text.trim(),
    intentScore: hashScore(text),
    intent: intent ?? INTENTS[hashScore(text, 0) % INTENTS.length],
    funnel: funnel ?? FUNNELS[hashScore(text, 1) % FUNNELS.length],
  };
}

/** Deterministic expansion when LLM is unavailable. */
export function heuristicExpand(input: PromptResearchInput): PromptResearchResult {
  const zh = isZh(input.language);
  const items: ResearchPromptItem[] = [];

  if (input.mode === "keywords") {
    const kws = input.keywords ?? [];
    for (const kw of kws) {
      if (zh) {
        items.push(
          wrapItem(`${kw}是什么？有哪些核心能力？`, "信息获取", "认知"),
          wrapItem(`如何选择适合的${kw}？需要注意什么？`, "对比选型", "考虑"),
          wrapItem(`最好的${kw}有哪些？如何对比优劣？`, "对比选型", "考虑"),
          wrapItem(`${kw}适合哪些场景？有没有坑？`, "问题解决", "考虑"),
          wrapItem(`${input.country}市场里${kw}怎么选更靠谱？`, "购买决策", "决策"),
          wrapItem(`${kw}有哪些高性价比替代方案？`, "替代方案", "考虑"),
        );
      } else {
        items.push(
          wrapItem(`What is ${kw} and who is it for?`, "信息获取", "认知"),
          wrapItem(`How do I choose the best ${kw}?`, "对比选型", "考虑"),
          wrapItem(`What are the top ${kw} alternatives in ${input.country}?`, "替代方案", "考虑"),
          wrapItem(`Common mistakes when buying ${kw}?`, "问题解决", "考虑"),
          wrapItem(`Is ${kw} worth it in ${input.country}?`, "购买决策", "决策"),
          wrapItem(`Best ${kw} for beginners vs pros?`, "对比选型", "考虑"),
        );
      }
    }
    // Pad to ≥15 when few seeds
    if (items.length < 15 && kws[0]) {
      const seed = kws[0];
      const extras = zh
        ? [
            `${seed}入门指南：从哪里开始？`,
            `${seed}与竞品的核心差异是什么？`,
            `企业采购${seed}要看哪些指标？`,
            `${seed}的常见失败原因有哪些？`,
            `如何评估${seed}是否适合我的团队？`,
            `2026 年${seed}趋势是什么？`,
            `${seed}有没有免费或低成本方案？`,
            `AI 搜索通常如何推荐${seed}？`,
            `${seed}落地需要哪些前置条件？`,
            `哪些场景不该选${seed}？`,
          ]
        : [
            `Getting started with ${seed}: where to begin?`,
            `Key differences between ${seed} and competitors?`,
            `Enterprise buying criteria for ${seed}?`,
            `Why do ${seed} projects fail?`,
            `How to evaluate ${seed} for my team?`,
            `${seed} trends in 2026?`,
            `Low-cost options related to ${seed}?`,
            `How do AI assistants recommend ${seed}?`,
            `Prerequisites before adopting ${seed}?`,
            `When should I avoid ${seed}?`,
          ];
      for (const t of extras) {
        if (items.length >= 18) break;
        items.push(wrapItem(t));
      }
    }
  } else if (input.mode === "url") {
    const host = (() => {
      try {
        return new URL(input.url || "").hostname.replace(/^www\./, "");
      } catch {
        return input.url || "this site";
      }
    })();
    const topic = host.split(".")[0] || host;
    if (zh) {
      items.push(
        wrapItem(`${topic}官网提供哪些核心产品或服务？`, "信息获取", "认知"),
        wrapItem(`${topic}适合哪些用户场景？`, "信息获取", "认知"),
        wrapItem(`和竞品相比，${topic}有什么优势？`, "对比选型", "考虑"),
        wrapItem(`如何评价${topic}的口碑与可靠性？`, "问题解决", "考虑"),
        wrapItem(`${topic}的定价是否值得？有没有替代方案？`, "购买决策", "决策"),
        wrapItem(`初学者如何快速上手${topic}？`, "问题解决", "认知"),
        wrapItem(`${input.country}用户常用的${topic}类工具有哪些？`, "对比选型", "考虑"),
        wrapItem(`企业选型时为什么会考虑${topic}？`, "购买决策", "决策"),
        wrapItem(`${topic}有哪些常见问题与坑？`, "问题解决", "考虑"),
        wrapItem(`哪些内容页面最能代表${topic}的专业度？`, "信息获取", "认知"),
        wrapItem(`${topic}与同类品牌的差异化是什么？`, "对比选型", "考虑"),
        wrapItem(`如何判断${topic}是否适合我的团队？`, "购买决策", "决策"),
        wrapItem(`${topic}在 AI 搜索回答中常被如何描述？`, "信息获取", "认知"),
        wrapItem(`有没有比${topic}更便宜或更强的替代？`, "替代方案", "考虑"),
        wrapItem(`部署或使用${topic}需要哪些前置条件？`, "问题解决", "决策"),
      );
    } else {
      items.push(
        wrapItem(`What does ${host} offer and who is it for?`),
        wrapItem(`How does ${topic} compare to alternatives in ${input.country}?`),
        wrapItem(`Is ${topic} worth it for beginners?`),
        wrapItem(`What are common complaints about ${topic}?`),
        wrapItem(`Best use cases for ${topic}?`),
        wrapItem(`How reliable is ${topic} for teams?`),
        wrapItem(`What should I know before buying ${topic}?`),
        wrapItem(`Which pages on ${host} are most authoritative?`),
        wrapItem(`Alternatives to ${topic} with better pricing?`),
        wrapItem(`How do experts describe ${topic}?`),
        wrapItem(`Does ${topic} work well in ${input.country}?`),
        wrapItem(`What problems does ${topic} solve best?`),
        wrapItem(`How to evaluate ${topic} vs competitors?`),
        wrapItem(`Onboarding tips for ${topic}?`),
        wrapItem(`When should I not choose ${topic}?`),
      );
    }
  } else {
    const name = input.brandName || "该品牌";
    const industry = input.brandIndustry || (zh ? "所在行业" : "its category");
    const domain = input.brandDomain || "";
    if (zh) {
      items.push(
        wrapItem(`${name}是做什么的？核心业务是什么？`, "信息获取", "认知"),
        wrapItem(`${industry}里最好的品牌有哪些？${name}排第几？`, "对比选型", "考虑"),
        wrapItem(`为什么用户会选择${name}而不是竞品？`, "购买决策", "决策"),
        wrapItem(`${name}适合中小企业还是大型团队？`, "信息获取", "考虑"),
        wrapItem(`${name}的优缺点分别是什么？`, "对比选型", "考虑"),
        wrapItem(`如何开始使用${name}${domain ? `（${domain}）` : ""}？`, "问题解决", "决策"),
        wrapItem(`${name}在${input.country}市场口碑怎么样？`, "信息获取", "认知"),
        wrapItem(`${industry}选型时有哪些关键指标？`, "对比选型", "考虑"),
        wrapItem(`${name}有哪些替代品牌？`, "替代方案", "考虑"),
        wrapItem(`新手如何评估${name}是否值得投入？`, "购买决策", "决策"),
        wrapItem(`${name}常见的失败案例或风险是什么？`, "问题解决", "考虑"),
        wrapItem(`AI 助手通常如何推荐${name}这类产品？`, "信息获取", "认知"),
        wrapItem(`${name}与竞品在功能上的核心差异？`, "对比选型", "考虑"),
        wrapItem(`企业采购${name}需要注意哪些合规与安全点？`, "购买决策", "决策"),
        wrapItem(`哪些场景不适合用${name}？`, "替代方案", "决策"),
        wrapItem(`${name}的客户成功故事有哪些共同点？`, "信息获取", "认知"),
        wrapItem(`如何把${name}融入现有工作流？`, "问题解决", "决策"),
        wrapItem(`${industry}2026 年的选购趋势是什么？`, "信息获取", "认知"),
      );
    } else {
      items.push(
        wrapItem(`What is ${name} and what problem does it solve?`),
        wrapItem(`Best brands in ${industry} and where does ${name} rank?`),
        wrapItem(`Why choose ${name} over competitors?`),
        wrapItem(`Is ${name} better for SMBs or enterprises?`),
        wrapItem(`Pros and cons of ${name}?`),
        wrapItem(`How do I get started with ${name}${domain ? ` (${domain})` : ""}?`),
        wrapItem(`What is ${name}'s reputation in ${input.country}?`),
        wrapItem(`Key criteria when buying in ${industry}?`),
        wrapItem(`What are the best alternatives to ${name}?`),
        wrapItem(`Is ${name} worth the investment for beginners?`),
        wrapItem(`Common risks when adopting ${name}?`),
        wrapItem(`How do AI assistants usually recommend ${name}?`),
        wrapItem(`Core feature differences vs competitors?`),
        wrapItem(`Compliance and security checklist for ${name}?`),
        wrapItem(`When should I avoid ${name}?`),
        wrapItem(`Typical success patterns for ${name} customers?`),
        wrapItem(`How to integrate ${name} into existing workflows?`),
        wrapItem(`What are ${industry} buying trends in 2026?`),
      );
    }
  }

  return { prompts: dedupe(items).slice(0, 40), engine: "heuristic" };
}

async function fetchPageContext(url: string): Promise<string> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "user-agent": "OrbisPromptResearch/1.0",
        accept: "text/html",
      },
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return "";
    const html = (await res.text()).slice(0, 120_000);
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? "";
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, "").trim() ?? "";
    const desc =
      html.match(
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
      )?.[1]?.trim() ??
      html.match(
        /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i,
      )?.[1]?.trim() ??
      "";
    return [title && `Title: ${title}`, h1 && `H1: ${h1}`, desc && `Description: ${desc}`]
      .filter(Boolean)
      .join("\n");
  } catch {
    return "";
  }
}

function buildLlmUserMessage(
  input: PromptResearchInput,
  pageContext: string,
): string {
  const zh = isZh(input.language);
  const langHint = zh
    ? `请用${input.language}生成面向${input.country}用户的自然语言问题（Search Prompts）。`
    : `Generate natural-language Search Prompts in ${input.language} for users in ${input.country}.`;

  if (input.mode === "keywords") {
    return `${langHint}
Seed SEO keywords (one per line):
${(input.keywords ?? []).join("\n")}
Expand each keyword into 1-3 buyer questions people would ask ChatGPT/Perplexity.
Return 15-40 unique prompts total.`;
  }
  if (input.mode === "url") {
    return `${langHint}
Page URL: ${input.url}
Page context:
${pageContext || "(unavailable — infer from URL only)"}
Generate 15-40 prompts that someone researching this page/topic would ask AI search engines.`;
  }
  return `${langHint}
Brand name: ${input.brandName}
Brand domain: ${input.brandDomain || "(n/a)"}
Industry: ${input.brandIndustry || "(n/a)"}
Generate 15-40 prompts covering awareness, comparison, purchase, and alternatives.`;
}

async function callOpenAiCompatible(
  userMessage: string,
): Promise<ResearchPromptItem[] | null> {
  const apiKey = (process.env.OPENAI_API_KEY ?? "").trim();
  if (!apiKey) return null;

  const base = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(
    /\/+$/,
    "",
  );
  const model = (process.env.OPENAI_MODEL ?? "gpt-4o-mini").trim();

  const system = `You are an AI Prompt Research assistant for GEO / AI search visibility.
Return ONLY valid JSON: {"prompts":[{"text":"...","intentScore":0-100,"intent":"...","funnel":"认知|考虑|决策"}]}.
Prompts must be full natural-language questions, not keywords. No markdown.`;

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMessage },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content) as {
      prompts?: Array<{
        text?: string;
        intentScore?: number;
        intent?: string;
        funnel?: string;
      }>;
    };
    const items = (parsed.prompts ?? [])
      .map((p) => {
        const text = String(p.text ?? "").trim();
        if (!text) return null;
        return {
          text,
          intentScore: Math.max(
            1,
            Math.min(100, Number(p.intentScore) || hashScore(text)),
          ),
          intent: p.intent,
          funnel: p.funnel,
        } satisfies ResearchPromptItem;
      })
      .filter(Boolean) as ResearchPromptItem[];
    return items.length >= 8 ? dedupe(items).slice(0, 40) : null;
  } catch {
    return null;
  }
}

export async function generateResearchPrompts(
  input: PromptResearchInput,
): Promise<PromptResearchResult> {
  let pageContext = "";
  if (input.mode === "url" && input.url) {
    pageContext = await fetchPageContext(input.url);
  }

  const llmItems = await callOpenAiCompatible(
    buildLlmUserMessage(input, pageContext),
  );
  if (llmItems?.length) {
    return { prompts: llmItems, engine: "llm" };
  }
  return heuristicExpand(input);
}
