import assert from "node:assert/strict";
import test from "node:test";
import {
  applyStarredFlag,
  normalizeCitationUrl,
} from "../lib/citations/url.ts";

test("normalizeCitationUrl trims trailing slash and hash", () => {
  assert.equal(
    normalizeCitationUrl("https://Example.com/a/b/?x=1#frag"),
    "https://example.com/a/b?x=1",
  );
  assert.equal(normalizeCitationUrl("https://a.com/"), "https://a.com/");
  assert.equal(normalizeCitationUrl("  "), "");
});

test("applyStarredFlag matches raw or normalized url", () => {
  const set = new Set(["https://a.com/path"]);
  const rows = applyStarredFlag(
    [
      { url: "https://a.com/path" },
      { url: "https://a.com/path/" },
      { url: "https://b.com" },
    ],
    set,
  );
  assert.equal(rows[0].starred, true);
  assert.equal(rows[1].starred, true);
  assert.equal(rows[2].starred, false);
});
