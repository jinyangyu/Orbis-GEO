import {
  HELP_CATEGORIES,
  articlesForCategory,
  helpArticleHref,
  helpCategoryHref,
  type HelpCategory,
} from "@/lib/help/catalog";
import { PublicLink } from "../public-link";

/** Otterly only expands Brand Reports and Workspace in the accordion. */
const ACCORDION_IDS = new Set(["report", "account"]);

export function HelpSidebar({
  currentCategoryId,
  currentArticleId,
}: {
  currentCategoryId?: string;
  currentArticleId?: string;
}) {
  return (
    <aside className="help-kb-sidebar" aria-label="分类目录">
      <ul className="help-kb-acc" role="menu" aria-label="分类目录">
        {HELP_CATEGORIES.map((category) => {
          const active = category.id === currentCategoryId;
          const children = ACCORDION_IDS.has(category.id) ? articlesForCategory(category) : [];
          return children.length > 0 ? (
            <AccordionItem
              key={category.id}
              category={category}
              active={active}
              currentArticleId={currentArticleId}
              articles={children}
            />
          ) : (
            <li
              key={category.id}
              role="presentation"
              className={active ? "help-kb-acc-item is-active" : "help-kb-acc-item"}
            >
              <PublicLink role="menuitem" className="help-kb-acc-link" href={helpCategoryHref(category)}>
                {category.title}
              </PublicLink>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function AccordionItem({
  category,
  active,
  currentArticleId,
  articles,
}: {
  category: HelpCategory;
  active: boolean;
  currentArticleId?: string;
  articles: { id: string; title: string }[];
}) {
  const panelId = `help-acc-${category.id}`;
  return (
    <li
      role="presentation"
      className={
        active ? "help-kb-acc-item has-children is-active" : "help-kb-acc-item has-children"
      }
    >
      <input
        type="checkbox"
        defaultChecked={active}
        aria-controls={panelId}
        aria-label={`展开 ${category.title}`}
      />
      <div className="help-kb-acc-toggle">
        <PublicLink role="menuitem" className="help-kb-acc-link" href={helpCategoryHref(category)}>
          {category.title}
        </PublicLink>
        <span className="help-kb-acc-chevron" aria-hidden />
      </div>
      <ul id={panelId} className="help-kb-acc" role="menu">
        {articles.map((article) => (
          <li key={article.id} role="presentation" className="help-kb-acc-item">
            <PublicLink
              role="menuitem"
              className={
                article.id === currentArticleId
                  ? "help-kb-acc-link is-current"
                  : "help-kb-acc-link"
              }
              href={helpArticleHref(article.id)}
            >
              {article.title}
            </PublicLink>
          </li>
        ))}
      </ul>
    </li>
  );
}
