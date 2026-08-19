"use client";

import type { BillingInterval, PlanId } from "@/lib/billing/plans";
import {
  AGENCY_POINTS,
  CORE_ENGINES,
  ENGINE_ADDONS,
  PRICING_FAQS,
  PROMPT_PACK,
  PUBLIC_PLANS,
  formatMoney,
  publicPlanPrice,
  type PublicPlan,
  type PublicPlanId,
} from "@/lib/billing/pricing";
import { getHelpCategoryBySlug, helpArticleHref, helpCategoryHref } from "@/lib/help/catalog";
import { t } from "@/lib/i18n";

function PriceCheck() {
  return (
    <svg className="price-check" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#FF2D81"
        d="M9.55 15.15 18.03 6.68c.2-.2.43-.3.7-.3.26 0 .5.1.7.3.2.2.3.44.3.71 0 .28-.1.52-.3.71l-9.18 9.2c-.2.2-.43.3-.7.3s-.5-.1-.7-.3L4.55 13c-.2-.2-.3-.44-.29-.71.01-.28.11-.51.32-.71.2-.2.44-.3.71-.3.28 0 .51.1.71.3l3.55 3.57Z"
      />
    </svg>
  );
}

export function PricingToggle({
  interval,
  onChange,
}: {
  interval: BillingInterval;
  onChange: (value: BillingInterval) => void;
}) {
  return (
    <div className="price-toggle" role="tablist" aria-label="计费周期">
      <button
        type="button"
        role="tab"
        aria-selected={interval === "month"}
        className={interval === "month" ? "is-on" : ""}
        onClick={() => onChange("month")}
      >
        月付
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={interval === "year"}
        className={interval === "year" ? "is-on" : ""}
        onClick={() => onChange("year")}
      >
        年付 <span>15% off</span>
      </button>
    </div>
  );
}

export function PricingAnnualSwitch({
  interval,
  onChange,
}: {
  interval: BillingInterval;
  onChange: (value: BillingInterval) => void;
}) {
  const annual = interval === "year";
  return (
    <div className="billing-annual-switch">
      <span>年付（省 15%）</span>
      <button
        type="button"
        role="switch"
        aria-checked={annual}
        className={annual ? "is-on" : ""}
        onClick={() => onChange(annual ? "month" : "year")}
      >
        <i />
      </button>
    </div>
  );
}

export type PlanGridVariant = "marketing" | "scale" | "plans";

export function PricingPlanGrid({
  interval,
  currentPlan,
  onBuy,
  variant = "marketing",
}: {
  interval: BillingInterval;
  currentPlan?: PlanId;
  onBuy?: (id: Exclude<PublicPlanId, "enterprise">) => void;
  variant?: PlanGridVariant;
}) {
  const plans =
    variant === "marketing" ? PUBLIC_PLANS : PUBLIC_PLANS.filter((plan) => plan.id !== "enterprise");
  return (
    <div className={variant === "marketing" ? "price-plans" : "price-plans is-account"}>
      {plans.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          interval={interval}
          current={plan.id === currentPlan}
          currentPlan={currentPlan}
          onBuy={onBuy}
          variant={variant}
        />
      ))}
    </div>
  );
}

function accountCtaLabel(plan: PublicPlan, current: boolean, currentPlan?: PlanId): string {
  if (current) return "当前套餐";
  if (!currentPlan || currentPlan === "trial") return "升级";
  const ranks: Record<string, number> = { trial: 0, lite: 1, standard: 2, premium: 3, enterprise: 4 };
  return (ranks[plan.id] ?? 0) < (ranks[currentPlan] ?? 0) ? "降级" : "升级";
}

function PlanCard({
  plan,
  interval,
  current,
  currentPlan,
  onBuy,
  variant,
}: {
  plan: PublicPlan;
  interval: BillingInterval;
  current: boolean;
  currentPlan?: PlanId;
  onBuy?: (id: Exclude<PublicPlanId, "enterprise">) => void;
  variant: PlanGridVariant;
}) {
  const price = publicPlanPrice(plan, interval);
  const cta =
    variant === "marketing" ? (current ? "当前套餐" : plan.cta) : accountCtaLabel(plan, current, currentPlan);
  const cardClass = [
    "price-card",
    plan.popular ? "is-popular" : "",
    current && variant !== "marketing" ? "is-current" : "",
    variant === "scale" ? "is-scale" : "",
    variant === "plans" ? "is-split" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (variant === "scale") {
    return (
      <article className={cardClass}>
        <div className="price-card-top">
          <h3>{plan.name}</h3>
          <p className="price-amount">
            {price}
            <small>/月</small>
          </p>
        </div>
        <BulletList items={plan.scaleHighlights ?? plan.bullets.slice(0, 2)} />
        <PlanCta plan={plan} current={current} label={cta} onBuy={onBuy} solid={false} />
      </article>
    );
  }

  if (variant === "plans") {
    return (
      <article className={cardClass}>
        <div className="price-card-top">
          <h3>{plan.name}</h3>
          <p className="price-amount">
            {price}
            <small>/月</small>
          </p>
        </div>
        <BulletList
          className="is-above"
          items={plan.accountAbove ?? plan.bullets}
          enginesOn="监测引擎"
          addonsOn="可加购引擎"
        />
        <PlanCta plan={plan} current={current} label={cta} onBuy={onBuy} solid />
        <BulletList items={plan.accountBelow ?? plan.includes.slice(0, 5)} />
      </article>
    );
  }

  return (
    <article className={cardClass}>
      {plan.popular ? <p className="price-popular">{t("pricing.mostPopular")}</p> : null}
      <h3>{plan.name}</h3>
      <p className="price-amount">
        {price}
        {plan.id !== "enterprise" ? <small>/月</small> : null}
      </p>
      <p className="price-audience">
        {plan.id === "enterprise" && plan.fromMonthly
          ? `起步 $${plan.fromMonthly.toLocaleString("en-US")}/月`
          : plan.audience}
      </p>
      <PlanCta plan={plan} current={current} label={cta} onBuy={onBuy} />
      <hr />
      <BulletList items={plan.bullets} enginesOnFirst={plan.id !== "enterprise"} />
    </article>
  );
}

function EngineRow() {
  return (
    <span className="price-engine-row" aria-label="核心引擎">
      {CORE_ENGINES.map((engine) => (
        <em key={engine.id} title={engine.label}>
          {engine.short}
        </em>
      ))}
    </span>
  );
}

function BulletList({
  items,
  enginesOnFirst,
  enginesOn,
  addonsOn,
  className,
}: {
  items: string[];
  enginesOnFirst?: boolean;
  enginesOn?: string;
  addonsOn?: string;
  className?: string;
}) {
  return (
    <ul className={className ? `price-bullets ${className}` : "price-bullets"}>
      {items.map((item, i) => (
        <li key={`${item}-${i}`}>
          <span className="price-bullet-row">
            <PriceCheck />
            {item}
          </span>
          {enginesOnFirst && i === 0 ? <EngineRow /> : null}
          {enginesOn && item === enginesOn ? <EngineRow /> : null}
          {addonsOn && item === addonsOn ? (
            <span className="price-engine-row" aria-label="可加购引擎">
              <em title="Google AI Mode">AI Mode</em>
              <em title="Google Gemini">Gemini</em>
              <em title="Claude">Claude</em>
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function PlanCta({
  plan,
  current,
  label,
  onBuy,
  solid,
}: {
  plan: PublicPlan;
  current: boolean;
  label: string;
  onBuy?: (id: Exclude<PublicPlanId, "enterprise">) => void;
  solid?: boolean;
}) {
  const className = solid ? "price-btn is-solid is-block" : "price-btn";
  if (plan.id === "enterprise") {
    return (
      <a className={className} href={helpArticleHref("contact-support")}>
        {label}
      </a>
    );
  }
  if (onBuy) {
    return (
      <button type="button" className={className} disabled={current} onClick={() => onBuy(plan.id)}>
        {label}
      </button>
    );
  }
  return (
    <a className={className} href="/" target="_blank" rel="noreferrer">
      {label}
    </a>
  );
}

export function PricingIncludes() {
  return (
    <div className="price-plans price-includes">
      {PUBLIC_PLANS.map((plan) => (
        <section key={plan.id} className="price-card">
          <h3 className="price-includes-title">{plan.name} Includes:</h3>
          <ul className="price-bullets">
            {plan.includes.map((item) => (
              <li key={item}>
                <span className="price-bullet-row">
                  <PriceCheck />
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function PricingAddons() {
  const cols = ["lite", "standard", "premium"] as const;
  return (
    <section className="price-addons">
      <header className="price-section-head">
        <h2>{t("pricing.addons")}</h2>
        <p>
          可叠加到现有套餐。价格为美元、不含税。可单独或组合购买。
        </p>
      </header>
      <AddonTable
        title={t("pricing.availableAddons")}
        rows={[
          {
            label: "+100 条监测 Prompt（月付）",
            values: cols.map((col) => formatMoney(PROMPT_PACK.month[col])),
          },
          {
            label: "+100 条监测 Prompt（年付）",
            values: cols.map((col) => formatMoney(PROMPT_PACK.year[col])),
          },
        ]}
      />
      <p className="price-note">
        额外引擎按最多 1,000 条 Prompt 的固定包计价；更多请联系支持。标准版最多再加约 300
        条 Prompt，超出需升级到专业版。
      </p>
      <AddonTable
        title={t("pricing.availableEngines")}
        rows={ENGINE_ADDONS.flatMap((engine) => [
          {
            label: `${engine.label}（月付）`,
            values: cols.map((col) => formatMoney(engine.month[col])),
          },
          {
            label: `${engine.label}（年付）`,
            values: cols.map((col) => formatMoney(engine.year[col])),
          },
        ])}
      />
    </section>
  );
}

function AddonTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; values: string[] }>;
}) {
  return (
    <div className="price-table-wrap">
      <div className="price-table-row is-head">
        <div>{title}</div>
        <div>Lite</div>
        <div>Standard</div>
        <div>Premium</div>
      </div>
      {rows.map((row) => (
        <div className="price-table-row" key={row.label}>
          <div>{row.label}</div>
          {row.values.map((value, i) => (
            <div key={i}>{value}</div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function PricingAgency() {
  const category = getHelpCategoryBySlug("agencies-enterprises");
  return (
    <section className="price-agency">
      <h2>
        <em>For Agencies:</em> 用 GEO 服务拿下新客户
      </h2>
      <hr />
      <p>
        客户在问 AI 搜索可见度。Orbis 代理商合作计划在标准版 / 专业版之上，提供面向客户组合的能力：
      </p>
      <ul className="price-bullets">
        {AGENCY_POINTS.map((item) => (
          <li key={item.title}>
            <span className="price-bullet-row">
              <PriceCheck />
              <span>
                <b>{item.title}：</b>
                {item.body}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p>先订阅标准版或专业版，再申请代理商身份即可解锁上述权益。</p>
      <a className="price-btn is-solid" href={category ? helpCategoryHref(category) : "/help"}>
        成为代理商合作伙伴
      </a>
    </section>
  );
}

export function PricingAgencyStrip({ canApply }: { canApply: boolean }) {
  const category = getHelpCategoryBySlug("agencies-enterprises");
  return (
    <section className="billing-agency-strip">
      <div>
        <h3>代理商合作计划</h3>
        <p>服务多个客户时，可先订阅标准版或专业版，再申请专属权益。</p>
      </div>
      {canApply ? (
        <a className="secondary-button" href={category ? helpCategoryHref(category) : "/help"}>
          申请成为代理商
        </a>
      ) : (
        <button type="button" className="secondary-button" disabled>
          申请成为代理商
        </button>
      )}
    </section>
  );
}

export function PricingFaq() {
  return (
    <section className="price-faq">
      <h2>{t("pricing.faqs")}</h2>
      <p>关于价格与订阅管理的常见问题。</p>
      <div className="price-faq-list">
        {PRICING_FAQS.map((item) => (
          <details key={item.q} className="price-faq-item">
            <summary>
              {item.q}
              <span aria-hidden />
            </summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function PricingCalcNote() {
  return (
    <p className="price-note">
      不确定该买多少条 Prompt？先看
      <a href={helpArticleHref("prompt-limits")}> 配额说明 </a>
      与
      <a href={helpArticleHref("pricing")}> 套餐对照</a>
      。演示环境不扣款。
    </p>
  );
}
