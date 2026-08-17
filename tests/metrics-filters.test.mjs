import assert from "node:assert/strict";
import test from "node:test";
import {
  daysFromRangeLabel,
  engineFilterFromLabel,
  isAllEnginesLabel,
  isAllMarketsLabel,
  isAllTagsLabel,
} from "../lib/metrics/filters.ts";

test("daysFromRangeLabel accepts zh and en", () => {
  assert.equal(daysFromRangeLabel("过去 14 天"), 14);
  assert.equal(daysFromRangeLabel("Last 14 days"), 14);
  assert.equal(daysFromRangeLabel("过去 60 天"), 60);
  assert.equal(daysFromRangeLabel("Last 90 days"), 90);
  assert.equal(daysFromRangeLabel("本月至今"), 30);
  assert.equal(daysFromRangeLabel("Month to date"), 30);
  assert.equal(daysFromRangeLabel("过去 30 天"), 30);
});

test("engineFilterFromLabel maps known engines and all-labels", () => {
  assert.equal(engineFilterFromLabel("全部引擎"), undefined);
  assert.equal(engineFilterFromLabel("All Engines"), undefined);
  assert.equal(engineFilterFromLabel("ChatGPT"), "gpt");
  assert.equal(engineFilterFromLabel("豆包"), "doubao");
  assert.equal(engineFilterFromLabel("deepseek"), "deepseek");
  assert.equal(engineFilterFromLabel("gpt"), "gpt");
});

test("all-* label helpers", () => {
  assert.equal(isAllEnginesLabel("全部引擎"), true);
  assert.equal(isAllTagsLabel("全部标签"), true);
  assert.equal(isAllTagsLabel("品牌对比"), false);
  assert.equal(isAllMarketsLabel(""), true);
  assert.equal(isAllMarketsLabel("中国大陆"), false);
});
