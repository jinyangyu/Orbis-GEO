import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server renders the Orbis application shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /Orbis｜AI 搜索可见度与 GEO 智能增长平台/);
  assert.match(html, /ORBIS/);
  assert.match(html, /AI 搜索可见度总览/);
  assert.match(html, /重新体验首次激活/);
  assert.doesNotMatch(html, /Your site is taking shape|Codex is building/);
});

test("onboarding includes the complete activation state machine", async () => {
  const source = await readFile(new URL("app/onboarding.tsx", root), "utf8");
  for (const marker of [
    "先认识一下你",
    "设置第一个监测品牌",
    "审核要持续监测的问题",
    "确认品牌竞争组",
    "正在向主流 AI 引擎发起真实查询",
    "报告生成期间，先用 60 秒了解核心指标",
    "你的首份品牌报告已准备好",
  ]) assert.match(source, new RegExp(marker));
  assert.match(source, /orbis_onboarding_v1/);
  assert.match(source, /selectedCount < 5/);
  assert.match(source, /competitors\.length < 1/);
  assert.match(source, /prefers-reduced-motion|tourIndex/);
});

test("dashboard exposes a safe onboarding reset", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  assert.match(page, /resetOnboardingStorage/);
  assert.match(page, /重新体验首次激活/);
  assert.match(page, /fetchWorkspace/);
  // First visit must open dashboard directly; onboarding is manual-only.
  assert.doesNotMatch(page, /hasCompletedOnboarding\(\)\s*\?\s*"dashboard"\s*:\s*"onboarding"/);
  assert.match(page, /useState<"onboarding" \| "dashboard">\("dashboard"\)/);
});

test("onboarding persists drafts to MySQL APIs", async () => {
  const source = await readFile(new URL("app/onboarding.tsx", root), "utf8");
  assert.match(source, /saveOnboardingDraft/);
  assert.match(source, /completeOnboardingRemote/);
  assert.match(source, /fetchOnboardingDraft/);
  assert.match(source, /orbis_onboarding_v1/);
});
