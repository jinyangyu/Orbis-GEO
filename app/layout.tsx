import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://orbis-ai-search.example"),
  title: "Orbis｜AI 搜索可见度与 GEO 智能增长平台",
  description: "统一监测品牌在 ChatGPT、Perplexity、Google AI、Gemini 与 Copilot 中的提及、推荐和引用表现。",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "Orbis｜搜索增长，不止被看见",
    description: "SEO × GEO 智能增长平台",
    images: [{ url: "/og.png", width: 1792, height: 1024, alt: "Orbis AI 搜索智能平台" }],
  },
  twitter: { card: "summary_large_image", title: "Orbis｜搜索增长，不止被看见", description: "SEO × GEO 智能增长平台", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
