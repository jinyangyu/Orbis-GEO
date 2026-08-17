import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCustomRange,
  buildPresetRange,
  toISODate,
} from "../lib/report/date-range.ts";

test("buildPresetRange 30 days inclusive", () => {
  const today = new Date(2026, 7, 13); // Aug 13
  const r = buildPresetRange("30", today);
  assert.equal(r.preset, "30");
  assert.equal(r.days, 30);
  assert.equal(r.to, "2026-08-13");
  assert.equal(r.from, "2026-07-15");
  assert.equal(r.label, "过去 30 天");
});

test("buildPresetRange mtd", () => {
  const today = new Date(2026, 7, 13);
  const r = buildPresetRange("mtd", today);
  assert.equal(r.from, "2026-08-01");
  assert.equal(r.to, "2026-08-13");
  assert.equal(r.days, 13);
});

test("buildPresetRange last_month", () => {
  const today = new Date(2026, 7, 13);
  const r = buildPresetRange("last_month", today);
  assert.equal(r.from, "2026-07-01");
  assert.equal(r.to, "2026-07-31");
  assert.equal(r.days, 31);
});

test("buildCustomRange normalizes order", () => {
  const r = buildCustomRange("2026-08-10", "2026-08-01");
  assert.equal(r.from, "2026-08-01");
  assert.equal(r.to, "2026-08-10");
  assert.equal(r.preset, "custom");
  assert.equal(r.days, 10);
});

test("toISODate pads", () => {
  assert.equal(toISODate(new Date(2026, 0, 5)), "2026-01-05");
});
