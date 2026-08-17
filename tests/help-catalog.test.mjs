import assert from "node:assert/strict";
import test from "node:test";
import {
  HELP_ARTICLES,
  HELP_CATEGORIES,
  PAGE_HELP_ARTICLE,
  getHelpArticle,
  getHelpCategoryBySlug,
  helpArticleHref,
  helpCategoryHref,
  helpCtaHref,
} from "../lib/help/catalog.ts";

test("help articles have unique ids", () => {
  const ids = HELP_ARTICLES.map((a) => a.id);
  assert.equal(ids.length, new Set(ids).size);
});

test("categories only reference existing articles", () => {
  for (const cat of HELP_CATEGORIES) {
    for (const id of cat.articleIds) {
      assert.ok(getHelpArticle(id), `missing ${id} in ${cat.id}`);
    }
  }
});

test("every article belongs to a category", () => {
  const listed = new Set(HELP_CATEGORIES.flatMap((c) => c.articleIds));
  for (const a of HELP_ARTICLES) {
    assert.ok(listed.has(a.id), a.id);
  }
});

test("dashboard pages have help targets", () => {
  for (const slug of Object.values(PAGE_HELP_ARTICLE)) {
    assert.ok(getHelpArticle(slug), slug);
  }
});

test("help hub has 16 Otterly-aligned categories", () => {
  assert.equal(HELP_CATEGORIES.length, 16);
  const ids = HELP_CATEGORIES.map((c) => c.id);
  assert.equal(ids.length, new Set(ids).size);
});

test("category slugs are unique and do not collide with article ids", () => {
  const slugs = HELP_CATEGORIES.map((c) => c.slug);
  assert.equal(slugs.length, new Set(slugs).size);
  const articleIds = new Set(HELP_ARTICLES.map((a) => a.id));
  for (const slug of slugs) {
    assert.equal(articleIds.has(slug), false, slug);
  }
});

test("help product CTAs deep-link into workbench views", () => {
  assert.equal(helpCtaHref({ label: "总览", page: "overview" }), "/");
  assert.equal(helpCtaHref({ label: "设置", page: "brand-settings" }), "/#brand-settings");
  assert.equal(helpCtaHref({ label: "账单", page: "billing" }), "/#billing");
  assert.equal(helpCtaHref({ label: "文档", article: "what-is-orbis" }), "/help/what-is-orbis");
});

test("help paths resolve category and article slugs", () => {
  const start = getHelpCategoryBySlug("getting-started");
  assert.ok(start);
  assert.equal(helpCategoryHref(start), "/help/getting-started");
  assert.equal(helpArticleHref("what-is-orbis"), "/help/what-is-orbis");
  assert.ok(getHelpCategoryBySlug("onboarding"));
  assert.ok(getHelpCategoryBySlug("billing-payment"));
  assert.ok(getHelpCategoryBySlug("customer-support"));
  assert.ok(getHelpArticle("onboarding-guide"));
  assert.ok(getHelpArticle("contact-support"));
});

test("article category matches the category that lists it", () => {
  for (const cat of HELP_CATEGORIES) {
    assert.ok(cat.preview >= 1 && cat.preview <= cat.articleIds.length, cat.id);
    for (const id of cat.articleIds) {
      const article = getHelpArticle(id);
      assert.equal(article?.category, cat.id, id);
    }
  }
});
