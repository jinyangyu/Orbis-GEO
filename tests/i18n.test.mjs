import assert from "node:assert/strict";
import test from "node:test";
import { setLocale, t } from "../lib/i18n.ts";

test("t defaults to zh and interpolates", () => {
  setLocale("zh");
  assert.equal(t("action.generateReport"), "生成品牌报告");
  assert.equal(t("report.basedOn", { n: 12 }), "报告基于 12 个 Prompt。");
});

test("t switches to en", () => {
  setLocale("en");
  assert.equal(t("action.generateReport"), "Generate Report");
  assert.equal(t("filter.allEngines"), "All Engines");
  assert.equal(t("overview.brandMentions"), "Your Brand Mentions");
  setLocale("zh");
});

test("overview titles default to Chinese", () => {
  setLocale("zh");
  assert.equal(t("overview.coverageTrend"), "品牌覆盖趋势");
  assert.equal(t("overview.mePlusTop5"), "本品 + Top 5 竞品");
  assert.equal(t("citations.yes"), "是");
  assert.equal(t("bvi.pause"), "暂停");
  assert.equal(t("pricing.mostPopular"), "最受欢迎");
});
