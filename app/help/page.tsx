import {
  HELP_CATEGORIES,
  articlesForCategory,
  helpArticleHref,
  helpCategoryHref,
  searchHelpArticles,
} from "@/lib/help/catalog";
import { PublicLink } from "../public-link";
import { CategoryIcon } from "./icons";

export default async function HelpHomePage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }> | { q?: string };
}) {
  const params = await Promise.resolve(searchParams ?? {});
  const query = (params.q ?? "").trim();
  const results = query ? searchHelpArticles(query) : null;

  return (
    <main className="help-kb-wrap">
      {results ? (
        <section className="help-kb-results">
          <p className="help-kb-count">
            {results.length === 0 ? "没有匹配的文章。" : `${results.length} 篇匹配`}
          </p>
          {results.map((article) => (
            <PublicLink key={article.id} className="help-kb-article-link" href={helpArticleHref(article.id)}>
              {article.title}
            </PublicLink>
          ))}
        </section>
      ) : (
        <div className="help-kb-grid">
          {HELP_CATEGORIES.map((category) => {
            const articles = articlesForCategory(category);
            const preview = articles.slice(0, category.preview);
            return (
              <section key={category.id} className="help-kb-tile">
                <PublicLink className="help-kb-tile-head" href={helpCategoryHref(category)}>
                  <CategoryIcon id={category.id} />
                  <h2>{category.title}</h2>
                  <p>{category.blurb}</p>
                </PublicLink>
                <ul className="help-kb-tile-list">
                  {preview.map((article) => (
                    <li key={article.id}>
                      <PublicLink className="help-kb-article-link" href={helpArticleHref(article.id)}>
                        {article.title}
                      </PublicLink>
                    </li>
                  ))}
                </ul>
                <PublicLink className="help-kb-more" href={helpCategoryHref(category)}>
                  查看更多
                </PublicLink>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
