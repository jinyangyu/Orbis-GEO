"use client";

import { useLayoutEffect, useMemo, useState } from "react";
import {
  extraPromptAllowed,
  formatQuota,
  formatUsd,
  invoiceId,
  isTrialEnded,
  maxExtraPrompts,
  nextSubscriptionId,
  periodEndForInterval,
  PLANS,
  planPromptLimit,
  planRank,
  priceFor,
  quotaIncluded,
  trialBannerCopy,
  type BillingInvoice,
  type BillingState,
  type BillingView,
  type PlanId,
} from "@/lib/billing/plans";
import { ENGINE_ADDONS, PROMPT_PACK, engineAddonPrice } from "@/lib/billing/pricing";
import { helpArticleHref } from "@/lib/help/catalog";
import {
  PricingAddons,
  PricingAgencyStrip,
  PricingAnnualSwitch,
  PricingPlanGrid,
} from "../pricing/board";

export type BillingUsage = {
  prompts: number;
  geoAudits: number;
  api: number;
  mcp: number;
  agentEvents: number;
};

export function TrialBanner({
  state,
  onStartSubscription,
}: {
  state: BillingState;
  onStartSubscription: () => void;
}) {
  if (state.plan !== "trial") return null;
  const copy = trialBannerCopy(state);
  return (
    <div className="trial-banner" role="status">
      <div className="trial-banner-inner">
        <p>
          <b>{copy.lead}</b> {copy.rest}
        </p>
        <button type="button" onClick={onStartSubscription}>
          开始订阅
        </button>
      </div>
    </div>
  );
}

export function Billing({
  usage,
  workspaceCount,
  notify,
  manageOpen,
  onManageOpenChange,
  state,
  onStateChange,
  plansFocusTick = 0,
}: {
  usage: BillingUsage;
  workspaceCount: number;
  notify: (s: string) => void;
  manageOpen: boolean;
  onManageOpenChange: (open: boolean) => void;
  state: BillingState;
  onStateChange: (next: BillingState, persist?: boolean) => void;
  plansFocusTick?: number;
}) {
  const [view, setView] = useState<BillingView>("overview");
  const [interval, setInterval] = useState(state.interval);
  const [localFocusTick, setLocalFocusTick] = useState(0);
  const [seenFocus, setSeenFocus] = useState(0);
  const focusTick = plansFocusTick + localFocusTick;

  if (focusTick > seenFocus) {
    setSeenFocus(focusTick);
    if (view !== "overview") setView("overview");
  }

  const persist = (next: BillingState, write = true) => {
    onStateChange(next, write);
  };

  const current = PLANS[state.plan];
  const trialEnded = isTrialEnded(state);
  const copy = trialBannerCopy(state);

  const addInvoice = (label: string, amount: number): BillingInvoice => ({
    id: invoiceId(),
    date: new Date().toISOString().slice(0, 10),
    amount: formatUsd(amount),
    label,
  });

  const goOverview = () => setView("overview");

  const goToPlans = () => {
    onManageOpenChange(false);
    setLocalFocusTick((n) => n + 1);
  };

  useLayoutEffect(() => {
    if (!focusTick) return;
    document.getElementById("billing-plans")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusTick]);

  const buyPlan = (plan: PlanId) => {
    if (plan === "trial") return;
    if (planRank(plan) < planRank(state.plan) && usage.prompts > PLANS[plan].prompts + (extraPromptAllowed(plan) ? state.extraPrompts : 0)) {
      notify(`请先将监测 Prompt 降至 ${PLANS[plan].prompts} 条以内再降级`);
      return;
    }
    if (plan === "lite" && workspaceCount > 1) {
      notify("轻量套餐仅含 1 个工作区。请先减少监测工作区，或选择标准版及以上。");
      return;
    }
    const extra = extraPromptAllowed(plan) ? Math.min(state.extraPrompts, maxExtraPrompts(plan)) : 0;
    const amount = priceFor(plan, interval);
    const next: BillingState = {
      ...state,
      plan,
      interval,
      extraPrompts: extra,
      cancelAtPeriodEnd: false,
      periodEnd: periodEndForInterval(interval),
      subscriptionId: state.subscriptionId || nextSubscriptionId(),
      invoices: [addInvoice(`${PLANS[plan].name}（${interval === "year" ? "年付" : "月付"}）`, amount), ...state.invoices].slice(0, 12),
    };
    persist(next);
    notify(planRank(plan) >= planRank(state.plan) ? `已升级到 ${PLANS[plan].name}` : `已申请降级到 ${PLANS[plan].name}（演示：立即切换）`);
    setView("overview");
  };

  const monthlyEstimate = useMemo(() => {
    let n = priceFor(state.plan, state.interval);
    const packs = state.extraPrompts / 100;
    if (packs) n += state.interval === "year" ? packs * (PROMPT_PACK.year.standard / 12) : packs * PROMPT_PACK.month.standard;
    (Object.keys(state.engines) as Array<keyof BillingState["engines"]>).forEach((k) => {
      if (!state.engines[k]) return;
      const amount = engineAddonPrice(k, state.plan, state.interval);
      n += state.interval === "year" ? amount / 12 : amount;
    });
    return Math.round(n);
  }, [state]);

  const openView = (next: BillingView) => {
    onManageOpenChange(false);
    setView(next);
  };

  return (
    <>
      {view !== "overview" ? (
        <div className="billing-subhead">
          <button type="button" className="billing-back" onClick={goOverview}>
            ← 返回账单概览
          </button>
        </div>
      ) : null}

      {view === "overview" && (
        <div className="billing-stack billing-page">
          <section className="panel">
            <div className="panel-head">
              <div>
                <h3>套餐详情</h3>
                <p>当前档位、续费日与账期。</p>
              </div>
            </div>
            {state.plan === "trial" ? (
              <div className="billing-alert">
                <p>
                  <b>{copy.lead}</b> {copy.rest}
                </p>
                <button type="button" className="primary-button" onClick={goToPlans}>
                  查看套餐
                </button>
              </div>
            ) : state.cancelAtPeriodEnd ? (
              <div className="billing-alert">
                <p>已设置在 {state.periodEnd} 账期结束时取消。此前仍可使用当前套餐。</p>
              </div>
            ) : null}
            <div className="billing-stats">
              <div className="billing-stat">
                <span>当前套餐</span>
                <b>{current.name}</b>
              </div>
              <div className="billing-stat">
                <span>订阅</span>
                <b>{state.subscriptionId || "—"}</b>
              </div>
              <div className="billing-stat">
                <span>续费日</span>
                <b>{state.plan === "trial" ? (trialEnded ? "试用已结束" : state.trialEndsAt) : state.periodEnd}</b>
              </div>
              <div className="billing-stat">
                <span>账期</span>
                <b>{state.plan === "trial" ? "—" : state.interval === "year" ? "年付" : "月付"}</b>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <h3>套餐用量</h3>
                <p>
                  估算 {formatUsd(monthlyEstimate)}/{state.interval === "year" ? "月（年付折算）" : "月"}
                  {state.extraPrompts ? ` · 含加购 Prompt ${state.extraPrompts}` : ""}
                </p>
              </div>
              <button type="button" className="text-button" onClick={() => setView("addons")}>
                加购 Prompt / 引擎
              </button>
            </div>
            <div className="billing-usage">
              <UsageRow label="监测 Prompt" used={usage.prompts} limit={planPromptLimit(state)} />
              <UsageRow label="GEO Audit" used={usage.geoAudits} limit={current.geoAudits} />
              <UsageRow label="API" used={usage.api} limit={current.api} />
              <UsageRow label="MCP" used={usage.mcp} limit={current.mcp} />
              <UsageRow label="Agent 事件" used={usage.agentEvents} limit={current.agentEvents} />
            </div>
            <p className="billing-workspaces">
              你有 {workspaceCount} 个工作区 · 当前套餐{current.workspaces === "不限" ? "不限工作区" : `含 ${current.workspaces}工作区`}
            </p>
          </section>

          <section className="panel billing-scale" id="billing-plans">
            <div className="billing-section-head">
              <div>
                <h3>套餐</h3>
                <p>在这里管理套餐。</p>
              </div>
              <PricingAnnualSwitch interval={interval} onChange={setInterval} />
            </div>
            <PricingPlanGrid
              interval={interval}
              currentPlan={state.plan}
              onBuy={(id) => buyPlan(id)}
              variant="plans"
            />
            <PricingAgencyStrip canApply={state.plan === "standard" || state.plan === "premium"} />
          </section>
        </div>
      )}

      {view === "addons" && (
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>加购</h3>
              <p>额外 Prompt 以 100 条为一包。引擎可单独开通。</p>
            </div>
            <a className="text-button" href={helpArticleHref("buy-prompts")} target="_blank" rel="noreferrer">
              如何加购
            </a>
          </div>
          <div className="price-board">
            <PricingAddons />
          </div>
          <div className="addon-block">
            <div>
              <b>额外监测 Prompt</b>
              <small>
                {extraPromptAllowed(state.plan)
                  ? `当前 +${state.extraPrompts}，上限 ${maxExtraPrompts(state.plan)}`
                  : "请升级到标准版或专业版后再加购"}
              </small>
            </div>
            <label>
              额外条数
              <input
                type="number"
                min={0}
                step={100}
                max={maxExtraPrompts(state.plan)}
                disabled={!extraPromptAllowed(state.plan)}
                value={state.extraPrompts}
                onChange={(e) => {
                  const n = Math.max(0, Math.min(maxExtraPrompts(state.plan), Number(e.target.value) || 0));
                  const rounded = Math.round(n / 100) * 100;
                  persist({ ...state, extraPrompts: rounded });
                }}
              />
            </label>
          </div>
          {ENGINE_ADDONS.map((engine) => (
            <div className="addon-block" key={engine.key}>
              <div>
                <b>{engine.label}</b>
                <small>
                  {formatUsd(engineAddonPrice(engine.key, state.plan, state.interval))}
                  /{state.interval === "year" ? "年" : "月"}（当前档）
                </small>
              </div>
              <button
                type="button"
                className={state.engines[engine.key] ? "secondary-button" : "primary-button"}
                onClick={() => {
                  const on = !state.engines[engine.key];
                  persist({ ...state, engines: { ...state.engines, [engine.key]: on } });
                  notify(on ? `已开通 ${engine.label}` : `已关闭 ${engine.label}`);
                }}
              >
                {state.engines[engine.key] ? "移出套餐" : "加入套餐"}
              </button>
            </div>
          ))}
        </div>
      )}

      {view === "invoices" && (
        <div className="panel invoices-panel">
          <div className="panel-head">
            <div>
              <h3>发票</h3>
              <p>演示发票保存在本机。正式环境将显示 Stripe 门户中的发票。</p>
            </div>
          </div>
          {state.invoices.length === 0 ? (
            <div className="empty-delta" style={{ margin: 18 }}>
              暂无发票。购买或升级套餐后会出现记录。
            </div>
          ) : (
            state.invoices.map((inv) => (
              <div className="report-row" key={inv.id}>
                <span className="file-icon">$</span>
                <div>
                  <b>{inv.label}</b>
                  <small>
                    {inv.id} · {inv.date}
                  </small>
                </div>
                <span className="generated">{inv.amount}</span>
                <button type="button" onClick={() => notify(`已下载 ${inv.id}（演示）`)}>
                  下载
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {view === "company" && (
        <form
          className="panel billing-company"
          onSubmit={(e) => {
            e.preventDefault();
            persist(state);
            notify("账单信息已保存");
          }}
        >
          <div className="panel-head">
            <div>
              <h3>账单信息</h3>
              <p>用于发票抬头与通知邮箱。正式环境对应 Stripe 账单信息。</p>
            </div>
          </div>
          <div className="billing-fields">
            <label>
              公司名称
              <input
                value={state.companyName}
                onChange={(e) => persist({ ...state, companyName: e.target.value }, false)}
              />
            </label>
            <label>
              账单邮箱
              <input
                type="email"
                value={state.billingEmail}
                onChange={(e) => persist({ ...state, billingEmail: e.target.value }, false)}
              />
            </label>
            <label>
              税号 / VAT ID
              <input
                value={state.vatId}
                onChange={(e) => persist({ ...state, vatId: e.target.value }, false)}
              />
            </label>
          </div>
          <div className="help-cta-row" style={{ padding: "0 18px 18px" }}>
            <button type="submit" className="primary-button">
              保存
            </button>
            <a className="text-button" href={helpArticleHref("company-invoice")} target="_blank" rel="noreferrer">
              说明
            </a>
          </div>
        </form>
      )}

      {manageOpen ? (
        <div className="drawer-wrap">
          <button
            type="button"
            className="drawer-backdrop"
            aria-label="关闭"
            onClick={() => onManageOpenChange(false)}
          />
          <aside className="drawer billing-manage">
            <div className="drawer-head">
              <b>管理套餐</b>
              <button type="button" onClick={() => onManageOpenChange(false)} aria-label="关闭">
                ×
              </button>
            </div>
            <p className="help-lead">升级、加购、账单信息、发票与取消。正式环境对应支付门户。</p>
            <button type="button" className="choice-like" onClick={goToPlans}>
              升级 / 降级套餐
            </button>
            <button type="button" className="choice-like" onClick={() => openView("addons")}>
              管理额外 Prompt
            </button>
            <button type="button" className="choice-like" onClick={() => openView("company")}>
              管理账单信息
            </button>
            <button type="button" className="choice-like" onClick={() => openView("invoices")}>
              查看发票
            </button>
            <button
              type="button"
              className="choice-like danger"
              onClick={() => {
                if (state.plan === "trial") {
                  notify("试用无需取消");
                  return;
                }
                if (!window.confirm("确定取消订阅？当前账期结束前仍可使用。")) return;
                persist({ ...state, cancelAtPeriodEnd: true });
                onManageOpenChange(false);
                notify("已设置在账期结束时取消");
              }}
            >
              取消订阅
            </button>
          </aside>
        </div>
      ) : null}
    </>
  );
}

function UsageRow({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number | null;
}) {
  if (!quotaIncluded(limit)) {
    return (
      <div className="usage-meter is-empty">
        <div>
          <b>{label}</b>
          <span>未包含</span>
        </div>
      </div>
    );
  }
  const pct = Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  return (
    <div className="usage-meter">
      <div>
        <b>{label}</b>
        <span>
          {formatQuota(used)} / {formatQuota(limit)}
        </span>
      </div>
      <i>
        <em style={{ width: `${pct}%` }} />
      </i>
    </div>
  );
}
