import Link from "next/link";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Link>;

function isPublicHref(href: Props["href"]) {
  const path = typeof href === "string" ? href : href.pathname ?? "";
  return path === "/help" || path.startsWith("/help/") || path === "/pricing" || path.startsWith("/pricing/");
}

/** Client-side navigation for help/pricing; keep a full load for the product app. */
export function PublicLink({ href, prefetch = true, ...props }: Props) {
  if (isPublicHref(href)) {
    return <Link href={href} prefetch={prefetch} {...props} />;
  }
  return <a href={typeof href === "string" ? href : href.pathname ?? "/"} {...props} />;
}
