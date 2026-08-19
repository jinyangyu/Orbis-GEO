import assert from "node:assert/strict";
import test from "node:test";
import {
  PLANS,
  defaultBillingState,
  extraPromptAllowed,
  isTrialEnded,
  periodEndForInterval,
  planPromptLimit,
  quotaIncluded,
  trialBannerCopy,
  trialDaysLeft,
} from "../lib/billing/plans.ts";
import { PUBLIC_PLANS } from "../lib/billing/pricing.ts";

test("trial lasts 7 local days and ends after the end date", () => {
  const now = new Date(2026, 7, 18);
  const state = defaultBillingState(now);
  assert.equal(state.plan, "trial");
  assert.equal(state.trialEndsAt, "2026-08-25");
  assert.equal(state.periodEnd, "2026-08-25");
  assert.equal(trialDaysLeft(state, now), 7);
  assert.equal(isTrialEnded(state, now), false);
  assert.equal(isTrialEnded(state, new Date(2026, 7, 25)), false);
  assert.equal(isTrialEnded(state, new Date(2026, 7, 26)), true);
});

test("trial banner copy switches at the end date", () => {
  const now = new Date(2026, 7, 18);
  const state = defaultBillingState(now);
  const active = trialBannerCopy(state, now);
  assert.equal(active.ended, false);
  assert.equal(active.lead, "试用还剩 7 天。");
  assert.match(active.rest, /工作区、Prompt 与报告/);
  const lastDay = trialBannerCopy(state, new Date(2026, 7, 25));
  assert.equal(lastDay.ended, false);
  assert.equal(lastDay.lead, "试用将于今天结束。");
  const ended = trialBannerCopy(state, new Date(2026, 7, 26));
  assert.equal(ended.ended, true);
  assert.equal(ended.lead, "试用已结束。");
});

test("plan quotas match Otterly billing meters", () => {
  assert.equal(PLANS.trial.prompts, 50);
  assert.equal(PLANS.trial.geoAudits, 100);
  assert.equal(PLANS.trial.api, 1000);
  assert.equal(PLANS.trial.mcp, 1000);
  assert.equal(quotaIncluded(PLANS.trial.agentEvents), false);

  assert.equal(PLANS.lite.prompts, 15);
  assert.equal(PLANS.lite.geoAudits, 1000);
  assert.equal(quotaIncluded(PLANS.lite.api), false);

  assert.equal(PLANS.standard.prompts, 100);
  assert.equal(PLANS.standard.geoAudits, 5000);
  assert.equal(PLANS.standard.api, 2000);
  assert.equal(PLANS.standard.mcp, 2000);
  assert.equal(PLANS.standard.agentEvents, 200_000);

  assert.equal(PLANS.premium.prompts, 400);
  assert.equal(PLANS.premium.geoAudits, 10_000);
  assert.equal(PLANS.premium.api, 5000);
  assert.equal(PLANS.premium.agentEvents, 1_000_000);
});

test("prompt packs are only for standard and premium", () => {
  assert.equal(extraPromptAllowed("lite"), false);
  assert.equal(extraPromptAllowed("standard"), true);
  const state = defaultBillingState();
  state.plan = "standard";
  state.extraPrompts = 100;
  assert.equal(planPromptLimit(state), 200);
});

test("paid period end follows billing interval", () => {
  const now = new Date(2026, 7, 18);
  assert.equal(periodEndForInterval("month", now), "2026-09-17");
  assert.equal(periodEndForInterval("year", now), "2027-08-18");
});

test("account cards keep a short scale list and split feature lists", () => {
  const lite = PUBLIC_PLANS.find((p) => p.id === "lite");
  const standard = PUBLIC_PLANS.find((p) => p.id === "standard");
  assert.equal(lite?.scaleHighlights?.length, 2);
  assert.ok((lite?.accountAbove?.length ?? 0) >= 5);
  assert.ok((lite?.accountBelow?.length ?? 0) >= 4);
  assert.equal(standard?.scaleHighlights?.[0], "100 条监测 Prompt");
  assert.equal(
    PUBLIC_PLANS.filter((p) => p.id !== "enterprise").every((p) => p.accountAbove && p.accountBelow),
    true,
  );
});
