import type { Metadata } from "next";
import {
  HELP_ARTICLES,
  HELP_CATEGORIES,
  articlesForCategory,
  getHelpArticle,
  getHelpCategoryById,
  getHelpCategoryBySlug,
  helpArticleHref,
} from "@/lib/help/catalog";
import { PublicLink } from "../../public-link";
import { ArticleBlocks } from "../article-blocks";
import { ArticleFeedback } from "../article-feedback";
import { SupportForm } from "../support-form";
import HelpNotFound from "../not-found";

type Params = { slug: string };

async function readSlug(params: Promise<Params> | Params): Promise<string> {
  const { slug } = await Promise.resolve(params);
  return slug;
}

export function generateStaticParams() {
  return [
    ...HELP_CATEGORIES.map((c) => ({ slug: c.slug })),
    ...HELP_ARTICLES.map((a) => ({ slug: a.id })),
  ];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params> | Params;
}): Promise<Metadata> {
  const slug = await readSlug(params);
  const article = getHelpArticle(slug);
  if (article) return { title: `${article.title}｜Orbis 帮助` };
  const category = getHelpCategoryBySlug(slug);
  if (category) return { title: `${category.title}｜Orbis 帮助` };
  return { title: "帮助中心｜Orbis" };
}

export default async function HelpSlugPage({
  params,
}: {
  params: Promise<Params> | Params;
}) {
  const slug = await readSlug(params);
  const category = getHelpCategoryBySlug(slug);
  if (category) {
    const articles = articlesForCategory(category);
    return (
      <section className="help-kb-cat">
        <h1>{category.title}</h1>
        <p>{category.blurb}</p>
        <ul className="help-kb-cat-list">
          {articles.map((article) => (
            <li key={article.id}>
              <PublicLink href={helpArticleHref(article.id)}>{article.title}</PublicLink>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  const article = getHelpArticle(slug);
  if (!article) return <HelpNotFound />;

  const parent = getHelpCategoryById(article.category);
  const related = parent
    ? articlesForCategory(parent).filter((item) => item.id !== article.id)
    : [];

  return (
    <>
      <article className="help-doc">
        <h1>{article.title}</h1>
        <ArticleBlocks blocks={article.body} />
        {article.id === "contact-support" ? <SupportForm /> : null}
      </article>
      <ArticleFeedback articleId={article.id} />
      {related.length > 0 ? (
        <section className="help-kb-related">
          <h3>相关文章</h3>
          <ul>
            {related.map((item) => (
              <li key={item.id}>
                <PublicLink href={helpArticleHref(item.id)}>{item.title}</PublicLink>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
