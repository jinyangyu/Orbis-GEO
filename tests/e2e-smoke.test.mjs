import assert from "node:assert/strict";
import test from "node:test";

/**
 * HTTP smoke against a running deployment / local server.
 * Set ORBIS_E2E_BASE_URL (e.g. http://127.0.0.1:3000) to enable.
 * Without it, tests are skipped so CI unit jobs stay DB-free.
 */
const base = (process.env.ORBIS_E2E_BASE_URL ?? "").replace(/\/$/, "");

async function getJson(path) {
  const res = await fetch(`${base}${path}`, { redirect: "manual" });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* ignore */
  }
  return { res, text, json };
}

test("e2e: homepage shell responds", { skip: !base }, async () => {
  const res = await fetch(`${base}/`, { redirect: "manual" });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /ORBIS|Orbis|品牌报告|总览/i);
});

test("e2e: health liveness (?ready=0)", { skip: !base }, async () => {
  const { res, json } = await getJson("/api/health?ready=0");
  assert.equal(res.status, 200);
  assert.equal(json?.ok, true);
  assert.equal(json?.checks?.db, "skipped");
});

test("e2e: health readiness includes db check", { skip: !base }, async () => {
  const { res, json } = await getJson("/api/health");
  assert.ok([200, 503].includes(res.status));
  assert.ok(json?.checks?.db === "ok" || json?.checks?.db === "fail");
  if (res.status === 200) assert.equal(json.ok, true);
});

test("e2e: client-error rejects unauthenticated reports", { skip: !base }, async () => {
  const res = await fetch(`${base}/api/client-error`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      message: "e2e smoke",
      name: "SmokeError",
      context: { source: "tests/e2e-smoke" },
    }),
  });
  assert.equal(res.status, 401);
});

test("e2e: content articles rejects unauthenticated requests", { skip: !base }, async () => {
  const res = await fetch(`${base}/api/content/articles`, { redirect: "manual" });
  assert.equal(res.status, 401);
});
