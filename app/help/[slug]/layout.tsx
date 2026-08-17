import type { ReactNode } from "react";
import {
  getHelpArticle,
  getHelpCategoryById,
  getHelpCategoryBySlug,
  helpCategoryHref,
} from "@/lib/help/catalog";
import { PublicLink } from "../../public-link";
import { HelpSecondaryFrame } from "../frame";

type Params = { slug: string };

async function readSlug(params: Promise<Params> | Params): Promise<string> {
  const { slug } = await Promise.resolve(params);
  return slug;
}

export default async function HelpSlugLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<Params> | Params;
}) {
  const slug = await readSlug(params);
  const category = getHelpCategoryBySlug(slug);
  const article = category ? undefined : getHelpArticle(slug);
  const parent = article ? getHelpCategoryById(article.category) : category;
  const crumbCategory = category ?? parent;

  return (
    <HelpSecondaryFrame
      categoryId={parent?.id ?? category?.id}
      articleId={article?.id}
      crumbs={
        <>
          <li>
            <PublicLink href="/help">Orbis 帮助中心</PublicLink>
          </li>
          {crumbCategory ? (
            <li>
              <PublicLink href={helpCategoryHref(crumbCategory)}>{crumbCategory.title}</PublicLink>
            </li>
          ) : null}
          {article ? <li>{article.title}</li> : null}
        </>
      }
    >
      {children}
    </HelpSecondaryFrame>
  );
}
