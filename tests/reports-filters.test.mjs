import assert from "node:assert/strict";
import test from "node:test";
import { serializeReportFilters } from "../lib/reports/filters.ts";

test("serializeReportFilters fills defaults", () => {
  const f = serializeReportFilters({
    rangeLabel: "过去 30 天",
    reportType: "presentation",
    visibility: 42.5,
  });
  assert.equal(f.rangeLabel, "过去 30 天");
  assert.equal(f.reportType, "presentation");
  assert.equal(f.days, 30);
  assert.equal(f.engineLabel, "");
  assert.equal(f.visibility, 42.5);
  assert.equal(f.coverage, null);
});
