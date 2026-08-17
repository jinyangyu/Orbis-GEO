"use client";

import { useState } from "react";
import type { BillingInterval } from "@/lib/billing/plans";
import {
  PricingAddons,
  PricingAgency,
  PricingCalcNote,
  PricingFaq,
  PricingIncludes,
  PricingPlanGrid,
  PricingToggle,
} from "./board";

export function PricingView() {
  const [interval, setInterval] = useState<BillingInterval>("month");
  return (
    <div className="price-page">
      <header className="price-hero">
        <p className="price-tag">选择套餐，开始跟踪 AI 搜索可见度。</p>
        <h1>Orbis 定价</h1>
        <p className="price-trust">深受营销团队与代理商信赖</p>
      </header>
      <PricingToggle interval={interval} onChange={setInterval} />
      <PricingPlanGrid interval={interval} />
      <PricingIncludes />
      <PricingCalcNote />
      <PricingAgency />
      <PricingAddons />
      <PricingFaq />
      <section className="price-cta">
        <h2>
          开始为 AI 搜索做优化。<em>It&apos;s Orbis.</em>
        </h2>
        <p>ChatGPT、Gemini、AI Overviews、AI Mode、Perplexity 与 Copilot，都在一个工作台。</p>
        <a className="price-btn is-light" href="/" target="_blank" rel="noreferrer">
          开始免费试用
        </a>
      </section>
    </div>
  );
}
