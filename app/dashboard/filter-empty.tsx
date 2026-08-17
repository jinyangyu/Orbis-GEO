"use client";

import type { ReactNode } from "react";
import { t } from "@/lib/i18n";

export function FilterEmptyStage({
  empty,
  children,
}: {
  empty: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`filter-empty-stage${empty ? " is-empty" : ""}`}>
      <div
        className="filter-empty-body"
        aria-hidden={empty}
        inert={empty ? true : undefined}
      >
        {children}
      </div>
      {empty ? (
        <div className="filter-empty-veil" role="status">
          <p className="filter-empty-msg">{t("empty.filters")}</p>
        </div>
      ) : null}
    </div>
  );
}
