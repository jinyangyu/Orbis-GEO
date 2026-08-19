import type { BillingInterval, PlanId } from "./plans";

export type PublicPlanId = "lite" | "standard" | "premium" | "enterprise";

export type PublicPlan = {
  id: PublicPlanId;
  name: string;
  popular?: boolean;
  audience: string;
  monthly: number | null;
  annualMonthly: number | null;
  fromMonthly?: number;
  cta: string;
  bullets: string[];
  includes: string[];
  scaleHighlights?: string[];
  accountAbove?: string[];
  accountBelow?: string[];
};

export const CORE_ENGINES = [
  { id: "aio", short: "AIO", label: "Google AI Overviews" },
  { id: "gpt", short: "ChatGPT", label: "ChatGPT" },
  { id: "pplx", short: "Perplexity", label: "Perplexity" },
  { id: "copilot", short: "Copilot", label: "Microsoft Copilot" },
] as const;

const SHARED_PAID_BULLETS = [
  "跟踪 4 个 AI 搜索引擎：ChatGPT、Google AI Overviews、Perplexity、Microsoft Copilot",
  "Claude、Google AI Mode、Gemini 可加购",
  "不限成员",
  "每日监测",
  "ChatGPT Ads 跟踪",
];

const SHARED_INCLUDES_HEAD = [
  "不限品牌报告",
  "不限成员",
];

const SHARED_INCLUDES_TOOLS = [
  "支持 50+ 国家/地区",
  "AI Prompt 研究",
  "品牌可见度指数（BVI）",
  "域名排名",
  "引用分析",
  "生成式引擎优化审计",
  "详细报告与导出",
];

export const PUBLIC_PLANS: PublicPlan[] = [
  {
    id: "lite",
    name: "Lite",
    audience: "个人营销者与小团队",
    monthly: 29,
    annualMonthly: 25,
    cta: "立即开通",
    bullets: ["15 条监测 Prompt", ...SHARED_PAID_BULLETS],
    includes: [
      ...SHARED_INCLUDES_HEAD,
      "1 个工作区",
      "每周 3 条建议",
      ...SHARED_INCLUDES_TOOLS,
      "每月 1,000 次 GEO Audit",
      "集体入门培训",
    ],
    scaleHighlights: ["15 条监测 Prompt", "每月 1,000 次 URL Audit"],
    accountAbove: [
      "15 条监测 Prompt",
      "每月 1,000 次 URL Audit",
      "每周 3 条建议",
      "监测引擎",
      "可加购引擎",
      "每日 AI 可见度跟踪",
      "不限成员",
    ],
    accountBelow: [
      "1 个工作区",
      "不限品牌报告",
      "AI Prompt 研究",
      "引用与链接分析",
      "生成式引擎优化审计",
    ],
  },
  {
    id: "standard",
    name: "Standard",
    popular: true,
    audience: "中小企业与小型营销团队",
    monthly: 189,
    annualMonthly: 160,
    cta: "立即开通",
    bullets: [
      "100 条监测 Prompt",
      ...SHARED_PAID_BULLETS,
      "API 访问",
      "MCP 访问",
      "Agent 分析",
      "可加购 100 条 Prompt，每包 $99",
    ],
    includes: [
      ...SHARED_INCLUDES_HEAD,
      "不限工作区",
      "不限建议",
      ...SHARED_INCLUDES_TOOLS,
      "每月 5,000 次 GEO URL Audit",
      "Google Looker Studio 连接器",
      "每月 2,000 次 API 请求",
      "每月 2,000 次 MCP 请求",
      "每月 20 万 Agent Analytics 事件",
      "集体入门培训",
    ],
    scaleHighlights: ["100 条监测 Prompt", "每月 5,000 次 URL Audit"],
    accountAbove: [
      "100 条监测 Prompt",
      "每月 5,000 次 URL Audit",
      "不限建议",
      "监测引擎",
      "可加购引擎",
      "Google Looker Studio 连接器",
      "每月 2,000 次 API 请求",
      "每月 2,000 次 MCP 请求",
      "每月 20 万 Agent 分析事件",
      "每日 AI 可见度跟踪",
      "不限成员",
      "可加购 100 条 Prompt，每包 $99",
    ],
    accountBelow: [
      "不限工作区",
      "不限品牌报告",
      "AI Prompt 研究",
      "引用与链接分析",
      "生成式引擎优化审计",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    audience: "中型公司与代理商",
    monthly: 489,
    annualMonthly: 422,
    cta: "立即开通",
    bullets: [
      "400 条监测 Prompt",
      ...SHARED_PAID_BULLETS,
      "API 访问",
      "MCP 访问",
      "Agent 分析",
      "可加购 100 条 Prompt，每包 $99",
    ],
    includes: [
      ...SHARED_INCLUDES_HEAD,
      "不限工作区",
      "不限建议",
      ...SHARED_INCLUDES_TOOLS,
      "每月 10,000 次 GEO URL Audit",
      "Google Looker Studio 连接器",
      "每月 5,000 次 API 请求",
      "每月 5,000 次 MCP 请求",
      "每月 100 万 Agent Analytics 事件",
      "一对一 Onboarding",
    ],
    scaleHighlights: ["400 条监测 Prompt", "每月 10,000 次 URL Audit"],
    accountAbove: [
      "400 条监测 Prompt",
      "每月 10,000 次 URL Audit",
      "不限建议",
      "监测引擎",
      "可加购引擎",
      "Google Looker Studio 连接器",
      "每月 5,000 次 API 请求",
      "每月 5,000 次 MCP 请求",
      "每月 100 万 Agent 分析事件",
      "每日 AI 可见度跟踪",
      "不限成员",
      "可加购 100 条 Prompt，每包 $99",
    ],
    accountBelow: [
      "不限工作区",
      "不限品牌报告",
      "AI Prompt 研究",
      "引用与链接分析",
      "生成式引擎优化审计",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    audience: "全球品牌与定制需求",
    monthly: null,
    annualMonthly: null,
    fromMonthly: 1000,
    cta: "联系我们",
    bullets: [
      "包含 Premium 全部能力，并且：",
      "可定制 Prompt 监测",
      "单点登录（SSO）",
      "定制付款方式",
      "季度 GEO 健康检查",
      "定制条款",
      "一对一 Onboarding",
      "专属成功经理",
    ],
    includes: [
      ...SHARED_INCLUDES_HEAD,
      "不限工作区",
      "不限建议",
      ...SHARED_INCLUDES_TOOLS,
      "定制 GEO URL Audit 配额",
      "Google Looker Studio 连接器",
      "定制 API 请求配额",
      "定制 MCP 请求配额",
      "定制 Agent Analytics 事件配额",
      "一对一 Onboarding",
    ],
  },
];

export const AGENCY_POINTS = [
  { title: "更多 Prompt、更多客户", body: "标准版 150 条（对比 100），专业版 500 条（对比 400）。" },
  { title: "不限工作区管理", body: "每个客户独立环境，团队共用一个登录。" },
  { title: "Pitch 工作区", body: "签约前即可为潜在客户做定制审计。" },
  { title: "自有报表", body: "经 Looker Studio 输出带你品牌的报告。" },
  { title: "联合市场", body: "列入 Orbis 代理商名录，参与联合活动。" },
  { title: "简化账单", body: "所有工作区与项目一张发票。" },
];

export const PRICING_FAQS = [
  {
    q: "有月付和年付吗？",
    a: "有。可以按月或按年订阅 Orbis，年付约 15% 优惠。",
  },
  {
    q: "有免费试用吗？",
    a: "有。新用户可免费试用，无需绑卡，便于先走完监测与报告流程。",
  },
  {
    q: "如何取消订阅？",
    a: "随时可在账单页「管理订阅」里取消。取消后用到当前账期结束。需要协助请联系支持。",
  },
  {
    q: "接受哪些付款方式？",
    a: "自助套餐支持主流信用卡，交易经 Stripe 加密处理。对公转账与其他方式请联系支持。",
  },
  {
    q: "有隐藏费用吗？",
    a: "没有。价格均在本页列出（美元，不含税）。不需要额外购买 OpenAI 订阅。",
  },
  {
    q: "我到底需要多少条 Prompt？",
    a: "取决于要覆盖的市场、语言与产品线。同一句话监测多个国家会占用多条配额。可先看帮助里的配额说明。",
  },
];

export type EngineAddonKey = "aiMode" | "gemini" | "claude";

export const ENGINE_ADDONS: Array<{
  key: EngineAddonKey;
  label: string;
  month: Record<"lite" | "standard" | "premium", number>;
  year: Record<"lite" | "standard" | "premium", number>;
}> = [
  {
    key: "aiMode",
    label: "Google AI Mode",
    month: { lite: 9, standard: 59, premium: 149 },
    year: { lite: 93, standard: 610, premium: 1540 },
  },
  {
    key: "gemini",
    label: "Google Gemini",
    month: { lite: 9, standard: 59, premium: 149 },
    year: { lite: 93, standard: 610, premium: 1540 },
  },
  {
    key: "claude",
    label: "Claude",
    month: { lite: 29, standard: 109, premium: 439 },
    year: { lite: 300, standard: 1100, premium: 4400 },
  },
];

export const PROMPT_PACK = {
  month: { lite: null, standard: 99, premium: 99 } as const,
  year: { lite: null, standard: 1020, premium: 1020 } as const,
};

export function publicPlanPrice(plan: PublicPlan, interval: BillingInterval): string {
  if (plan.id === "enterprise") return "Custom";
  const n = interval === "year" ? plan.annualMonthly : plan.monthly;
  return n == null ? "Custom" : `$${n}`;
}

export function formatMoney(n: number | null | undefined): string {
  if (n == null) return "不可用";
  return `$${n.toLocaleString("en-US")}`;
}

export function engineAddonPrice(
  key: EngineAddonKey,
  plan: PlanId,
  interval: BillingInterval,
): number {
  const row = ENGINE_ADDONS.find((item) => item.key === key);
  if (!row) return 0;
  const tier = plan === "premium" ? "premium" : plan === "standard" ? "standard" : "lite";
  return interval === "year" ? row.year[tier] : row.month[tier];
}

export function isBuyablePlan(id: PublicPlanId): id is Exclude<PublicPlanId, "enterprise"> {
  return id !== "enterprise";
}
