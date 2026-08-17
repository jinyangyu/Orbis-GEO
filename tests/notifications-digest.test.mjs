import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRecommendationsDigest,
  isValidWebhookUrl,
} from "../lib/notifications/digest.ts";

test("recommendations digest is stable and order-independent", () => {
  const a = [
    {
      priority: "high",
      category: "content",
      title: "写一篇对比文",
      description: "对比本品与竞品",
    },
    {
      priority: "med",
      category: "pr",
      title: "媒体稿",
      description: "投放",
    },
  ];
  const b = [...a].reverse();
  assert.equal(buildRecommendationsDigest(a), buildRecommendationsDigest(b));
  assert.match(buildRecommendationsDigest(a), /^r1_[0-9a-f]{8}$/);
});

test("digest changes when action content changes", () => {
  const base = [
    {
      priority: "high",
      category: "content",
      title: "A",
      description: "x",
    },
  ];
  const changed = [
    {
      priority: "high",
      category: "content",
      title: "B",
      description: "x",
    },
  ];
  assert.notEqual(
    buildRecommendationsDigest(base),
    buildRecommendationsDigest(changed),
  );
});

test("isValidWebhookUrl: empty or http(s) only", () => {
  assert.equal(isValidWebhookUrl(""), true);
  assert.equal(isValidWebhookUrl("  "), true);
  assert.equal(isValidWebhookUrl("https://hooks.example/x"), true);
  assert.equal(isValidWebhookUrl("http://localhost:9/hook"), true);
  assert.equal(isValidWebhookUrl("ftp://x"), false);
  assert.equal(isValidWebhookUrl("not-a-url"), false);
});
