"use client";

import { useEffect, useMemo, useState } from "react";
import {
  brandLetter,
  brandLogoFallbackUrl,
  brandLogoHost,
  brandLogoUrl,
} from "@/lib/brand-logo";

export function BrandLogo({
  domain,
  name,
  className,
}: {
  domain?: string | null;
  name: string;
  className?: string;
}) {
  const host = useMemo(() => brandLogoHost(domain), [domain]);
  const [stage, setStage] = useState(0);
  const letter = brandLetter(name);
  const cls = className || "brand-nav-logo";

  useEffect(() => {
    setStage(0);
  }, [host]);

  if (!host || stage >= 2) {
    return (
      <span className={`${cls} is-fallback`} aria-hidden>
        {letter}
      </span>
    );
  }

  const src = stage === 0 ? brandLogoUrl(host, 128) : brandLogoFallbackUrl(host);
  return (
    <img
      className={`${cls} is-image`}
      src={src}
      alt=""
      width={32}
      height={32}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setStage((current) => current + 1)}
    />
  );
}
