import assert from "node:assert/strict";
import test from "node:test";
import {
  brandLetter,
  brandLogoFallbackUrl,
  brandLogoHost,
  brandLogoUrl,
} from "../lib/brand-logo.ts";

test("brandLogoHost strips protocol, www, and path", () => {
  assert.equal(brandLogoHost("https://www.Gumtree.com/foo?x=1"), "gumtree.com");
  assert.equal(brandLogoHost("www.58.com"), "58.com");
  assert.equal(brandLogoHost("gumtree.co.uk"), "gumtree.co.uk");
});

test("brandLogoHost rejects empty or non-host input", () => {
  assert.equal(brandLogoHost(""), null);
  assert.equal(brandLogoHost("   "), null);
  assert.equal(brandLogoHost("赶集"), null);
  assert.equal(brandLogoHost("localhost"), null);
});

test("brand logo urls encode a public host", () => {
  assert.equal(
    brandLogoUrl("gumtree.com", 64),
    "https://www.google.com/s2/favicons?sz=64&domain=gumtree.com",
  );
  assert.equal(
    brandLogoFallbackUrl("gumtree.com"),
    "https://icons.duckduckgo.com/ip3/gumtree.com.ico",
  );
  assert.equal(brandLetter("赶集网"), "赶");
  assert.equal(brandLetter("  gumtree"), "G");
});
