import assert from "node:assert/strict";
import test from "node:test";
import { agentArticlesURL, buildArticleListSearchParams } from "../lib/seo-agent/query.ts";

test("buildArticleListSearchParams omits empty values", () => {
  const params = buildArticleListSearchParams({
    site: "gumtree",
    market: "",
    status: "CONTENT_REVIEW",
    q: " laptop ",
    page: 2,
    page_size: 20,
  });
  assert.equal(params.get("site"), "gumtree");
  assert.equal(params.get("market"), null);
  assert.equal(params.get("status"), "CONTENT_REVIEW");
  assert.equal(params.get("q"), "laptop");
  assert.equal(params.get("page"), "2");
  assert.equal(params.get("page_size"), "20");
});

test("agentArticlesURL joins base and path", () => {
  assert.equal(
    agentArticlesURL("http://127.0.0.1:8080/", { page: 1 }),
    "http://127.0.0.1:8080/api/orbis/articles?page=1",
  );
});
