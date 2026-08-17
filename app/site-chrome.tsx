import type { ReactNode } from "react";
import { PublicLink } from "./public-link";

const NAV = [
  { href: "/help", label: "首页", id: "help" },
  { href: "/", label: "产品", id: "product" },
  { href: "/pricing", label: "定价", id: "pricing" },
  { href: "/help/onboarding", label: "指南", id: "guide" },
  { href: "/help/customer-support", label: "公司", id: "company" },
] as const;

export function SiteChrome({
  active,
  children,
}: {
  active?: (typeof NAV)[number]["id"];
  children: ReactNode;
}) {
  return (
    <div className="help-site">
      <header className="help-kb-header">
        <PublicLink className="help-kb-logo" href="/help">
          ORBIS
        </PublicLink>
        <input id="help-nav-toggle" className="help-kb-nav-toggle" type="checkbox" />
        <label className="help-kb-burger" htmlFor="help-nav-toggle">
          <span className="sr-only">打开导航</span>
          <i />
          <i />
          <i />
        </label>
        <nav className="help-kb-nav" aria-label="站点">
          {NAV.map((item) => (
            <PublicLink
              key={item.id}
              href={item.href}
              className={item.id === active ? "is-current" : undefined}
            >
              {item.label}
            </PublicLink>
          ))}
        </nav>
        <a className="help-kb-back" href="/">
          返回工作台
        </a>
      </header>
      {children}
      <footer className="help-kb-footer">
        <span className="help-kb-footer-mark" aria-hidden />
        <p>Copyright Orbis</p>
      </footer>
    </div>
  );
}
