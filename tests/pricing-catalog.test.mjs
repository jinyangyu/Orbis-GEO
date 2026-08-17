import assert from "node:assert/strict";
import test from "node:test";
import {
  ENGINE_ADDONS,
  PRICING_FAQS,
  PROMPT_PACK,
  PUBLIC_PLANS,
  publicPlanPrice,
} from "../lib/billing/pricing.ts";

test("public pricing has Otterly's four plans", () => {
  assert.deepEqual(
    PUBLIC_PLANS.map((p) => p.id),
    ["lite", "standard", "premium", "enterprise"],
  );
  assert.equal(PUBLIC_PLANS.find((p) => p.popular)?.id, "standard");
});

test("monthly and annual list prices match Otterly", () => {
  const lite = PUBLIC_PLANS[0];
  const standard = PUBLIC_PLANS[1];
  const premium = PUBLIC_PLANS[2];
  const enterprise = PUBLIC_PLANS[3];
  assert.equal(publicPlanPrice(lite, "month"), "$29");
  assert.equal(publicPlanPrice(lite, "year"), "$25");
  assert.equal(publicPlanPrice(standard, "month"), "$189");
  assert.equal(publicPlanPrice(standard, "year"), "$160");
  assert.equal(publicPlanPrice(premium, "month"), "$489");
  assert.equal(publicPlanPrice(premium, "year"), "$422");
  assert.equal(publicPlanPrice(enterprise, "month"), "Custom");
  assert.equal(enterprise.fromMonthly, 1000);
});

test("prompt packs and engine add-ons match Otterly", () => {
  assert.equal(PROMPT_PACK.month.lite, null);
  assert.equal(PROMPT_PACK.month.standard, 99);
  assert.equal(PROMPT_PACK.year.premium, 1020);
  const mode = ENGINE_ADDONS.find((e) => e.key === "aiMode");
  const claude = ENGINE_ADDONS.find((e) => e.key === "claude");
  assert.equal(mode?.month.lite, 9);
  assert.equal(mode?.month.premium, 149);
  assert.equal(mode?.year.standard, 610);
  assert.equal(claude?.month.standard, 109);
  assert.equal(claude?.year.premium, 4400);
});

test("pricing FAQ count matches Otterly", () => {
  assert.equal(PRICING_FAQS.length, 6);
});
