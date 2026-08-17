import assert from "node:assert/strict";
import test from "node:test";
import {
  isPageKey,
  pageFromHash,
  workbenchHref,
} from "../app/dashboard/types.ts";

test("workbench home is slash, other views are hashes", () => {
  assert.equal(workbenchHref("overview"), "/");
  assert.equal(workbenchHref("brand-settings"), "/#brand-settings");
  assert.equal(workbenchHref("billing"), "/#billing");
});

test("hash maps back to a workbench page", () => {
  assert.equal(pageFromHash(""), "overview");
  assert.equal(pageFromHash("#"), "overview");
  assert.equal(pageFromHash("#prompts"), "prompts");
  assert.equal(pageFromHash("citations"), "citations");
  assert.equal(pageFromHash("#nope"), "overview");
  assert.equal(isPageKey("brand-settings"), true);
  assert.equal(isPageKey("help"), false);
});
