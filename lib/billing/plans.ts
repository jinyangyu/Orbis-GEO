export type PlanId = "trial" | "lite" | "standard" | "premium";
export type BillingInterval = "month" | "year";
export type BillingView = "overview" | "plans" | "addons" | "invoices" | "company";

export type BillingState = {
  plan: PlanId;
  interval: BillingInterval;
  extraPrompts: number;
  engines: { aiMode: boolean; gemini: boolean; claude: boolean };
  cancelAtPeriodEnd: boolean;
  periodEnd: string;
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
    workspaces: "不限",
    extras: ["个人 onboarding", "更高审计配额", "可加购 Prompt"],
  },
};

const STORAGE_KEY = "orbis_billing_v1";

function periodEndFromNow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

export function defaultBillingState(): BillingState {
  return {
    plan: "trial",
    interval: "month",
    extraPrompts: 0,
    engines: { aiMode: false, gemini: false, claude: false },
    cancelAtPeriodEnd: false,
    periodEnd: periodEndFromNow(),
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
    return { ...defaultBillingState(), ...parsed, engines: { ...defaultBillingState().engines, ...parsed.engines } };
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

export function invoiceId(): string {
  return `INV-${Date.now().toString(36).toUpperCase()}`;
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
