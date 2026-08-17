import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { SiteChrome } from "../site-chrome";
import { HelpSearchForm } from "./search-form";

export const metadata: Metadata = {
  title: "帮助中心｜Orbis",
  description: "Orbis 知识库：入门、监测、GEO、账单与支持。",
  robots: { index: false, follow: false },
};

export default function HelpLayout({ children }: { children: ReactNode }) {
  return (
    <SiteChrome>
      <Suspense fallback={<section className="help-kb-search" />}>
        <HelpSearchForm />
      </Suspense>
      {children}
    </SiteChrome>
  );
}
