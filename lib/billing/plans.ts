export type PlanId = "trial" | "lite" | "standard" | "premium";
export type BillingInterval = "month" | "year";
export type BillingView = "overview" | "addons" | "invoices" | "company";

export type BillingState = {
  plan: PlanId;
  interval: BillingInterval;
  extraPrompts: number;
  engines: { aiMode: boolean; gemini: boolean; claude: boolean };
  cancelAtPeriodEnd: boolean;
  periodEnd: string;
  trialEndsAt: string;
  subscriptionId: string | null;
  companyName: string;
  billingEmail: string;
  vatId: string;
  invoices: BillingInvoice[];
};

export type BillingInvoice = {
  id: string;
  date: string;
  amount: string;
  label: string;
};

export type PlanDef = {
  id: PlanId;
  name: string;
  audience: string;
  monthly: number;
  annualMonthly: number;
  prompts: number;
  geoAudits: number | null;
  api: number | null;
  mcp: number | null;
  agentEvents: number | null;
  workspaces: string;
  extras: string[];
};

export const PLAN_ORDER: PlanId[] = ["trial", "lite", "standard", "premium"];

export const PLANS: Record<PlanId, PlanDef> = {
  trial: {
    id: "trial",
    name: "试用",
    audience: "评估 Orbis，无需绑卡",
    monthly: 0,
    annualMonthly: 0,
    prompts: 50,
    geoAudits: 100,
    api: 1000,
    mcp: 1000,
    agentEvents: null,
    workspaces: "不限",
    extras: ["7 天", "核心 4 引擎", "不限成员"],
  },
  lite: {
    id: "lite",
    name: "轻量 Lite",
    audience: "个人与小团队",
    monthly: 29,
    annualMonthly: 25,
    prompts: 15,
    geoAudits: 1000,
    api: null,
    mcp: null,
    agentEvents: null,
    workspaces: "1 个",
    extras: ["每日监测", "每周 3 条建议", "PDF 导出"],
  },
  standard: {
    id: "standard",
    name: "标准 Standard",
    audience: "中小团队与代理商入门",
    monthly: 189,
    annualMonthly: 160,
    prompts: 100,
    geoAudits: 5000,
    api: 2000,
    mcp: 2000,
    agentEvents: 200_000,
    workspaces: "不限",
    extras: ["不限建议", "API / MCP", "可加购 Prompt"],
  },
  premium: {
    id: "premium",
    name: "专业 Premium",
    audience: "中型公司与代理商",
    monthly: 489,
    annualMonthly: 422,
    prompts: 400,
    geoAudits: 10_000,
    api: 5000,
    mcp: 5000,
    agentEvents: 1_000_000,
    workspaces: "不限",
    extras: ["个人 onboarding", "更高审计配额", "可加购 Prompt"],
  },
};

const STORAGE_KEY = "orbis_billing_v1";

export function dateFromNow(days: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return todayStamp(d);
}

function todayStamp(from = new Date()): string {
  const y = from.getFullYear();
  const m = String(from.getMonth() + 1).padStart(2, "0");
  const d = String(from.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function defaultBillingState(now = new Date()): BillingState {
  const trialEndsAt = dateFromNow(7, now);
  return {
    plan: "trial",
    interval: "month",
    extraPrompts: 0,
    engines: { aiMode: false, gemini: false, claude: false },
    cancelAtPeriodEnd: false,
    periodEnd: trialEndsAt,
    trialEndsAt,
    subscriptionId: null,
    companyName: "",
    billingEmail: "",
    vatId: "",
    invoices: [],
  };
}

export function loadBillingState(): BillingState {
  if (typeof window === "undefined") return defaultBillingState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultBillingState();
    const parsed = JSON.parse(raw) as Partial<BillingState>;
    const base = defaultBillingState();
    return {
      ...base,
      ...parsed,
      engines: { ...base.engines, ...parsed.engines },
      trialEndsAt: parsed.trialEndsAt || parsed.periodEnd || base.trialEndsAt,
      subscriptionId: parsed.subscriptionId ?? null,
    };
  } catch {
    return defaultBillingState();
  }
}

export function saveBillingState(state: BillingState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function planPromptLimit(state: BillingState): number {
  return PLANS[state.plan].prompts + state.extraPrompts;
}

export function planRank(id: PlanId): number {
  return PLAN_ORDER.indexOf(id);
}

export function formatUsd(n: number): string {
  if (n === 0) return "$0";
  return `$${n}`;
}

export function formatQuota(n: number): string {
  return n.toLocaleString("en-US");
}

export function invoiceId(): string {
  return `INV-${Date.now().toString(36).toUpperCase()}`;
}

export function nextSubscriptionId(): string {
  return `sub_${Date.now().toString(36)}`;
}

export function priceFor(plan: PlanId, interval: BillingInterval): number {
  const def = PLANS[plan];
  return interval === "year" ? def.annualMonthly : def.monthly;
}

export function extraPromptAllowed(plan: PlanId): boolean {
  return plan === "standard" || plan === "premium";
}

export function maxExtraPrompts(plan: PlanId): number {
  if (plan === "standard") return 300;
  if (plan === "premium") return 2000;
  return 0;
}

export function isTrialEnded(state: BillingState, now = new Date()): boolean {
  if (state.plan !== "trial") return false;
  return state.trialEndsAt < todayStamp(now);
}

export function trialDaysLeft(state: BillingState, now = new Date()): number {
  const end = Date.parse(`${state.trialEndsAt}T00:00:00`);
  const start = Date.parse(`${todayStamp(now)}T00:00:00`);
  if (Number.isNaN(end) || Number.isNaN(start)) return 0;
  return Math.round((end - start) / 86_400_000);
}

export function trialBannerCopy(
  state: BillingState,
  now = new Date(),
): { ended: boolean; lead: string; rest: string } {
  const rest = "升级套餐后可继续使用 Orbis，并保留工作区、Prompt 与报告。";
  if (isTrialEnded(state, now)) {
    return { ended: true, lead: "试用已结束。", rest };
  }
  const days = trialDaysLeft(state, now);
  if (days <= 0) {
    return { ended: false, lead: "试用将于今天结束。", rest };
  }
  return { ended: false, lead: `试用还剩 ${days} 天。`, rest };
}

export function periodEndForInterval(interval: BillingInterval, now = new Date()): string {
  return dateFromNow(interval === "year" ? 365 : 30, now);
}

export function quotaIncluded(limit: number | null | undefined): limit is number {
  return typeof limit === "number" && limit > 0;
}
