import assert from "node:assert/strict";
import test from "node:test";
import {
  estimateSentimentBreakdown,
  likelihoodFromPosition,
  resolveSentiment,
  sentimentFromCoverage,
  visibilityIndex,
} from "../lib/metrics/heuristics.ts";

test("sentimentFromCoverage buckets", () => {
  assert.equal(sentimentFromCoverage(60), 86);
  assert.equal(sentimentFromCoverage(40), 74);
  assert.equal(sentimentFromCoverage(10), 62);
});

test("resolveSentiment prefers DB and defaults to null", () => {
  const prev = process.env.ORBIS_HEURISTIC_SENTIMENT;
  delete process.env.ORBIS_HEURISTIC_SENTIMENT;
  assert.equal(resolveSentiment(72, 10), 72);
  assert.equal(resolveSentiment(null, 80), null);
  process.env.ORBIS_HEURISTIC_SENTIMENT = "1";
  assert.equal(resolveSentiment(null, 80), 86);
  if (prev == null) delete process.env.ORBIS_HEURISTIC_SENTIMENT;
  else process.env.ORBIS_HEURISTIC_SENTIMENT = prev;
});

test("estimateSentimentBreakdown sums to mentions", () => {
  const bd = estimateSentimentBreakdown(100, 86);
  assert.equal(bd.positive + bd.neutral + bd.negative, 100);
  assert.equal(bd.positivePct + bd.neutralPct + bd.negativePct, 100);
  assert.ok(bd.positivePct >= 55);
  assert.equal(bd.label, "Positive");
});

test("visibilityIndex is weighted blend", () => {
  assert.equal(visibilityIndex(100, 0, 0), 45);
  assert.equal(visibilityIndex(0, 100, 0), 35);
  assert.equal(visibilityIndex(0, 0, 100), 20);
  assert.equal(visibilityIndex(100, 100, 100), 100);
});

test("likelihoodFromPosition decreases with worse rank", () => {
  assert.equal(likelihoodFromPosition(null), 0);
  assert.equal(likelihoodFromPosition(1), 100);
  assert.ok(likelihoodFromPosition(3) < likelihoodFromPosition(1));
  assert.equal(likelihoodFromPosition(9), 0);
});
