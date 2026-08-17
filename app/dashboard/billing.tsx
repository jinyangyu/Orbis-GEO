"use client";

import { useMemo, useState } from "react";
import {
  extraPromptAllowed,
  formatUsd,
  invoiceId,
  loadBillingState,
  maxExtraPrompts,
  PLANS,
  planPromptLimit,
  planRank,
  priceFor,
  saveBillingState,
  type BillingInvoice,
  type BillingState,
  type BillingView,
  type PlanId,
} from "@/lib/billing/plans";
import { ENGINE_ADDONS, PROMPT_PACK, engineAddonPrice } from "@/lib/billing/pricing";
import { helpArticleHref } from "@/lib/help/catalog";
import {
  PricingAddons,
  PricingIncludes,
  PricingPlanGrid,
  PricingToggle,
} from "../pricing/board";

export function Billing({
  promptUsed,
  workspaceCount,
  notify,
}: {
  promptUsed: number;
  workspaceCount: number;
  notify: (s: string) => void;
}) {
  const [state, setState] = useState<BillingState>(() => loadBillingState());
  const [view, setView] = useState<BillingView>("overview");
  const [interval, setInterval] = useState(state.interval);
  const [manageOpen, setManageOpen] = useState(false);

  const persist = (next: BillingState) => {
    setState(next);
    saveBillingState(next);
  };

  const limit = planPromptLimit(state);
  const usedPct = Math.min(100, Math.round((promptUsed / Math.max(limit, 1)) * 100));
  const current = PLANS[state.plan];

  const addInvoice = (label: string, amount: number): BillingInvoice => ({
    id: invoiceId(),
    date: new Date().toISOString().slice(0, 10),
    amount: formatUsd(amount),
    label,
  });

  const buyPlan = (plan: PlanId) => {
    if (plan === "trial") {
      persist({ ...state, plan: "trial", extraPrompts: 0, cancelAtPeriodEnd: false });
      notify("已回到试用（演示）");
      setView("overview");
      return;
    }
    if (planRank(plan) < planRank(state.plan) && promptUsed > PLANS[plan].prompts + (extraPromptAllowed(plan) ? state.extraPrompts : 0)) {
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
      invoices: [addInvoice(`${PLANS[plan].name}（${interval === "year" ? "年付" : "月付"}）`, amount), ...state.invoices].slice(0, 12),
    };
    persist(next);
    notify(planRank(plan) >= planRank(state.plan) ? `已升级到 ${PLANS[plan].name}` : `已申请降级到 ${PLANS[plan].name}（演示：立即切换）`);
    setView("overview");
  };

  const tabs: Array<{ id: BillingView; label: string }> = [
    { id: "overview", label: "概览" },
    { id: "plans", label: "套餐" },
    { id: "addons", label: "加购" },
    { id: "invoices", label: "发票" },
    { id: "company", label: "账单信息" },
  ];

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

  return (
    <>
      <section className="report-hero">
        <div>
          <span className="eyebrow">BILLING · ORBIS</span>
          <h2>账单与套餐</h2>
          <p>
            按监测 Prompt 计费，席位不限。演示环境不会真实扣款，升级、发票与公司抬头都会保存在本机。
          </p>
        </div>
        <button type="button" onClick={() => setManageOpen(true)}>
          管理订阅
        </button>
      </section>

      <div className="billing-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={view === tab.id ? "active" : ""}
            onClick={() => setView(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {view === "overview" && (
        <div className="billing-overview">
          <div className="panel">
            <div className="panel-head">
              <div>
                <h3>当前套餐 · {current.name}</h3>
                <p>
                  {state.interval === "year" ? "年付" : "月付"}
                  {state.cancelAtPeriodEnd ? " · 将在账期结束后取消" : ""}
                  {" · "}账期至 {state.periodEnd}
                </p>
              </div>
              <a className="text-button" href="/pricing" target="_blank" rel="noreferrer">
                完整定价页
              </a>
            </div>
            <div className="usage-meter">
              <div>
                <b>监测 Prompt</b>
                <span>
                  {promptUsed} / {limit}
                </span>
              </div>
              <i>
                <em style={{ width: `${usedPct}%` }} />
              </i>
              <small>工作区 {workspaceCount} · 估算 {formatUsd(monthlyEstimate)}/{state.interval === "year" ? "月（年付折算）" : "月"}</small>
            </div>
            <div className="help-cta-row" style={{ padding: "0 18px 16px" }}>
              <button type="button" className="primary-button" onClick={() => setView("plans")}>
                更改套餐
              </button>
              <button type="button" className="secondary-button" onClick={() => setView("addons")}>
                加购 Prompt / 引擎
              </button>
            </div>
          </div>
        </div>
      )}

      {view === "plans" && (
        <div className="price-board">
          <PricingToggle interval={interval} onChange={setInterval} />
          <PricingPlanGrid
            interval={interval}
            currentPlan={state.plan}
            onBuy={(id) => buyPlan(id)}
          />
          <PricingIncludes />
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
                <button
                  type="button"
                  onClick={() => notify(`已下载 ${inv.id}（演示）`)}
                >
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
              <p>用于发票抬头与通知邮箱。正式环境对应 Stripe Billing Information。</p>
            </div>
          </div>
          <div className="billing-fields">
            <label>
              公司名称
              <input
                value={state.companyName}
                onChange={(e) => setState({ ...state, companyName: e.target.value })}
              />
            </label>
            <label>
              账单邮箱
              <input
                type="email"
                value={state.billingEmail}
                onChange={(e) => setState({ ...state, billingEmail: e.target.value })}
              />
            </label>
            <label>
              税号 / VAT ID
              <input
                value={state.vatId}
                onChange={(e) => setState({ ...state, vatId: e.target.value })}
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
            onClick={() => setManageOpen(false)}
          />
          <aside className="drawer billing-manage">
            <div className="drawer-head">
              <b>管理订阅</b>
              <button type="button" onClick={() => setManageOpen(false)} aria-label="关闭">
                ×
              </button>
            </div>
            <p className="help-lead">对应 Otterly 的 Manage Plan：升级、账单信息、发票与取消。</p>
            <button
              type="button"
              className="choice-like"
              onClick={() => {
                setManageOpen(false);
                setView("plans");
              }}
            >
              升级 / 降级套餐
            </button>
            <button
              type="button"
              className="choice-like"
              onClick={() => {
                setManageOpen(false);
                setView("addons");
              }}
            >
              管理额外 Prompt
            </button>
            <button
              type="button"
              className="choice-like"
              onClick={() => {
                setManageOpen(false);
                setView("company");
              }}
            >
              管理账单信息
            </button>
            <button
              type="button"
              className="choice-like"
              onClick={() => {
                setManageOpen(false);
                setView("invoices");
              }}
            >
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
                setManageOpen(false);
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
