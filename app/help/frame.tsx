import type { ReactNode } from "react";
import { HelpSidebar } from "./sidebar";

export function HelpSecondaryFrame({
  categoryId,
  articleId,
  crumbs,
  children,
}: {
  categoryId?: string;
  articleId?: string;
  crumbs: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="help-kb-wrap help-kb-secondary">
      <nav className="help-kb-crumbs" aria-label="面包屑">
        <ol>{crumbs}</ol>
      </nav>
      <div className="help-kb-columns">
        <div className="help-kb-content">{children}</div>
        <HelpSidebar
          key={`${categoryId ?? ""}-${articleId ?? ""}`}
          currentCategoryId={categoryId}
          currentArticleId={articleId}
        />
      </div>
    </main>
  );
}
