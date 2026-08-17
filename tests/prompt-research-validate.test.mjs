import assert from "node:assert/strict";
import test from "node:test";
import {
  PromptResearchValidationError,
  parsePromptResearchBody,
} from "../lib/prompt-research/validate.ts";

test("parsePromptResearchBody keywords mode", () => {
  const input = parsePromptResearchBody({
    mode: "keywords",
    keywordsText: "二手车\n租房\n",
  });
  assert.equal(input.mode, "keywords");
  assert.deepEqual(input.keywords, ["二手车", "租房"]);
  assert.equal(input.language, "简体中文");
  assert.equal(input.country, "中国大陆");
});

test("parsePromptResearchBody url mode validates protocol", () => {
  const ok = parsePromptResearchBody({
    mode: "url",
    url: "https://example.com/a",
  });
  assert.equal(ok.url, "https://example.com/a");

  assert.throws(
    () => parsePromptResearchBody({ mode: "url", url: "ftp://x" }),
    PromptResearchValidationError,
  );
  assert.throws(
    () => parsePromptResearchBody({ mode: "url", url: "not-a-url" }),
    PromptResearchValidationError,
  );
});

test("parsePromptResearchBody brand requires name", () => {
  assert.throws(
    () => parsePromptResearchBody({ mode: "brand" }),
    PromptResearchValidationError,
  );
  const input = parsePromptResearchBody({
    mode: "brand",
    brandName: "Gumtree",
    brandDomain: "gumtree.com",
  });
  assert.equal(input.brandName, "Gumtree");
  assert.equal(input.brandDomain, "gumtree.com");
});

test("parsePromptResearchBody rejects bad mode", () => {
  assert.throws(
    () => parsePromptResearchBody({ mode: "other" }),
    /mode/,
  );
});
