import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSafeOutboundUrl,
  isSafeOutboundUrl,
} from "../lib/http/safe-url.ts";

test("rejects non-http(s) schemes", () => {
  assert.throws(() => assertSafeOutboundUrl("ftp://example.com/x"));
  assert.throws(() => assertSafeOutboundUrl("javascript:alert(1)"));
});

test("rejects localhost and loopback", () => {
  assert.throws(() =>
    assertSafeOutboundUrl("http://127.0.0.1/hook", {
      productionHttpsOnly: false,
    }),
  );
  assert.throws(() =>
    assertSafeOutboundUrl("http://localhost:8080/hook", {
      productionHttpsOnly: false,
    }),
  );
});

test("rejects private, link-local, and cloud metadata", () => {
  assert.throws(() =>
    assertSafeOutboundUrl("http://10.0.0.8/hook", {
      productionHttpsOnly: false,
    }),
  );
  assert.throws(() =>
    assertSafeOutboundUrl("http://192.168.1.1/hook", {
      productionHttpsOnly: false,
    }),
  );
  assert.throws(() =>
    assertSafeOutboundUrl("http://169.254.169.254/latest/meta-data", {
      productionHttpsOnly: false,
    }),
  );
  assert.throws(() =>
    assertSafeOutboundUrl("http://metadata.google.internal/", {
      productionHttpsOnly: false,
    }),
  );
});

test("production requires https", () => {
  assert.throws(() =>
    assertSafeOutboundUrl("http://hooks.example.com/wh", {
      productionHttpsOnly: true,
    }),
  );
  assert.doesNotThrow(() =>
    assertSafeOutboundUrl("https://hooks.example.com/wh", {
      productionHttpsOnly: true,
    }),
  );
});

test("isSafeOutboundUrl matches assertSafeOutboundUrl", () => {
  assert.equal(
    isSafeOutboundUrl("https://hooks.example.com/wh"),
    true,
  );
});
