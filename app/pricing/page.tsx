import type { Metadata } from "next";
import { SiteChrome } from "../site-chrome";
import { PricingView } from "./view";

export const metadata: Metadata = {
  title: "定价｜Orbis",
  description:
    "Lite $29/月（15 条 Prompt），Standard $189/月（100 条），Premium $489/月（400 条）。企业套餐定制，起步 $1,000/月。",
  robots: { index: false, follow: false },
};

export default function PricingPage() {
  return (
    <SiteChrome active="pricing">
      <PricingView />
    </SiteChrome>
  );
}
