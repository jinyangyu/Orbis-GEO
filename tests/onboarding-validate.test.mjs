import assert from "node:assert/strict";
import test from "node:test";
import { isValidOnboardingState } from "../lib/onboarding/validate.ts";

const valid = {
  version: 1,
  screen: "brand",
  profile: {
    firstName: "Yuki",
    lastName: "Chen",
    role: "brand",
    source: "ChatGPT",
  },
  brand: {
    website: "novalabs.co",
    name: "Nova Labs",
    market: "中国大陆",
    language: "简体中文",
  },
  prompts: [{ id: 1, text: "q", selected: true }],
  competitors: [{ id: 1, name: "Notion", domain: "notion.so", mark: "N", color: "#000" }],
  processingIndex: 0,
  tourIndex: 0,
  completedAt: null,
};

test("isValidOnboardingState accepts a complete draft", () => {
  assert.equal(isValidOnboardingState(valid), true);
});

test("isValidOnboardingState rejects bad version or screen", () => {
  assert.equal(isValidOnboardingState({ ...valid, version: 2 }), false);
  assert.equal(isValidOnboardingState({ ...valid, screen: "nope" }), false);
  assert.equal(isValidOnboardingState(null), false);
});
