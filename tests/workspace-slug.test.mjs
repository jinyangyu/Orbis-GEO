import assert from "node:assert/strict";
import test from "node:test";
import { buildWorkspaceSlug } from "../lib/workspace/slug.ts";

test("buildWorkspaceSlug prefers cleaned website host", () => {
  assert.equal(
    buildWorkspaceSlug({ website: "https://www.NovaLabs.co/path", name: "Other" }),
    "novalabs-co",
  );
});

test("buildWorkspaceSlug falls back to name then id", () => {
  assert.equal(buildWorkspaceSlug({ name: "Nova Labs" }), "nova-labs");
  assert.equal(buildWorkspaceSlug({ fallbackId: "abc-123" }), "abc-123");
  assert.equal(buildWorkspaceSlug({}), "workspace");
});
