export type Locale = "zh" | "en";

export const ORBIS_LOCALE_KEY = "orbis_locale";

export const zhMessages: Record<string, string> = {
  "app.name": "ORBIS",
  "app.tagline": "AI 搜索情报",
  "nav.brandReport": "品牌报告",
  "nav.overview": "总览",
  "nav.prompts": "Prompts",
  "nav.citations": "引用分析",
  "nav.recommendations": "优化建议",
  "nav.research": "AI Prompt 研究",
  "nav.reports": "报告中心",
  "nav.content": "内容生成",
  "nav.settings": "品牌设置",
  "nav.billing": "账单与套餐",
  "nav.general": "通用",
  "nav.citationShort": "引用",
  "nav.recsShort": "建议",
  "action.generateReport": "生成品牌报告",
  "action.exportCsv": "导出 CSV",
  "action.viewFullReport": "查看完整报告",
  "action.resetFilters": "重置筛选",
  "action.settings": "品牌设置",
  "action.search": "搜索",
  "filter.allEngines": "全部引擎",
  "filter.allTags": "全部标签",
  "filter.allMarkets": "全部市场",
  "filter.searchPrompt": "按 Prompt 搜索",
  "empty.filters": "当前筛选条件下暂无数据",
  "date.mtd": "本月至今",
  "date.last_month": "上个月",
  "date.14": "过去 14 天",
  "date.30": "过去 30 天",
  "date.60": "过去 60 天",
  "date.90": "过去 90 天",
  "date.custom": "自定义",
  "month.0": "1月",
  "month.1": "2月",
  "month.2": "3月",
  "month.3": "4月",
  "month.4": "5月",
  "month.5": "6月",
  "month.6": "7月",
  "month.7": "8月",
  "month.8": "9月",
  "month.9": "10月",
  "month.10": "11月",
  "month.11": "12月",
  "report.basedOn": "报告基于 {n} 个 Prompt。",
  "report.showingFiltered": "当前筛选显示 {n} 个。",
  "prompts.title": "Prompts",
  "prompts.subtitle": "查看哪些问题提及本品，哪些提及竞品。",
  "metric.estimated": "估算",
  "metric.aiVisibility": "AI 可见度",
  "metric.brandCoverage": "品牌覆盖率",
  "metric.sov": "声量份额",
  "metric.domainCite": "官网引用",
  "sentiment.estimated": "情感（估算）",
  "sentiment.pending": "情感",
  "sentiment.breakdown": "情感分布",
  "visibility.hint":
    "0–100 综合指数：综合品牌覆盖率、声量份额与官网引用份额。",
  "reports.emptyTitle": "报告中心",
  "reports.emptyBody":
    "历史报告列表将接入数据库持久化。当前请从品牌报告页使用「生成品牌报告」导出 PDF。",
  "reports.cta": "前往总览生成报告",
  "help.comingSoon": "帮助中心即将上线",
  "detected.demoSeed": "演示数据",
  "research.engine.heuristic": "生成引擎：启发式模板（未配置 OPENAI_API_KEY）",
  "research.engine.llm": "生成引擎：大模型",
  "overview.coverageTrend": "品牌覆盖趋势",
  "overview.coverageTrendTip":
    "选定时间范围内，本品与竞品在 AI 答卷中的日覆盖率走势。可用右上角切换 Top 5 / 全部竞品；点击图例可显隐曲线。",
  "overview.brandMentions": "本品品牌提及",
  "overview.brandMentionsTip":
    "监测周期内，本品在 AI 答卷中被提及的总次数。下方列出主要竞品的提及量，便于对比声量规模。",
  "overview.avgPosition": "本品平均位次",
  "overview.avgPositionTip":
    "本品在答卷品牌列表中的平均出现位次。1 表示最常被首先提到；数值越小越好，反映推荐优先级而非仅是否出现。",
  "overview.topPromptsMentions": "品牌提及 Top Prompts",
  "overview.topPromptsMentionsTip":
    "本品被提及次数最多的监测问题。可用于识别高可见话题，并下钻到具体答卷。",
  "overview.domainCitation": "域名引用次数",
  "overview.domainCitationTip":
    "本品官网域名在答卷引用中出现的总次数。下方为主要竞品域名的引用量对比。",
  "overview.citationShare": "引用份额",
  "overview.citationShareTip":
    "本品引用次数占全部引用的份额。下方列出高引用 URL，可识别 AI 搜索中的「赢家页面」。",
  "overview.mePlusAll": "本品 + 全部竞品",
  "overview.mePlusTop5": "本品 + Top 5 竞品",
  "overview.coverageAxis": "品牌覆盖率 %",
  "overview.brandRanking": "品牌排名",
  "overview.domainCoverage": "域名覆盖",
  "overview.domainCiteTable": "域名引用",
  "overview.topPromptsDomain": "按官网引用的 Top Prompts",
  "overview.fullCitations": "完整引用 →",
  "citations.topWinners": "上升来源",
  "citations.topLosers": "下降来源",
  "citations.cited": "引用次数",
  "citations.yes": "是",
  "citations.no": "否",
  "bvi.title": "AI 搜索品牌可见度指数（BVI）",
  "bvi.likelihood": "购买可能性（估算）",
  "bvi.play": "播放时序",
  "bvi.pause": "暂停",
  "bvi.brand": "品牌",
  "bvi.coverage": "品牌覆盖率",
  "bvi.axisCoverage": "品牌覆盖率 %",
  "bvi.timelapseAria": "品牌可见度指数时序",
  "bvi.scatterAria": "品牌可见度指数散点图",
  "bvi.q.niche": "利基",
  "bvi.q.leaders": "领先",
  "bvi.q.lowPerf": "低表现",
  "bvi.q.lowConv": "低转化",
  "pricing.mostPopular": "最受欢迎",
  "pricing.addons": "加购项",
  "pricing.availableAddons": "可用加购",
  "pricing.availableEngines": "可用 AI 搜索引擎",
  "pricing.faqs": "常见问题",
};

export const enMessages: Record<string, string> = {
  "app.name": "ORBIS",
  "app.tagline": "AI Search Intelligence",
  "nav.brandReport": "Brand Report",
  "nav.overview": "Overview",
  "nav.prompts": "Prompts",
  "nav.citations": "Citations",
  "nav.recommendations": "Recommendations",
  "nav.research": "AI Prompt Research",
  "nav.reports": "Reports",
  "nav.content": "Content",
  "nav.settings": "Brand settings",
  "nav.billing": "Billing",
  "nav.general": "General",
  "nav.citationShort": "Citations",
  "nav.recsShort": "Recommendations",
  "action.generateReport": "Generate Report",
  "action.exportCsv": "Export as CSV",
  "action.viewFullReport": "View full report",
  "action.resetFilters": "Reset filters",
  "action.settings": "Brand settings",
  "action.search": "Search",
  "filter.allEngines": "All Engines",
  "filter.allTags": "All tags",
  "filter.allMarkets": "All markets",
  "filter.searchPrompt": "Search by prompt",
  "empty.filters": "No data is available with your current filters",
  "date.mtd": "Month to date",
  "date.last_month": "Last month",
  "date.14": "Last 14 days",
  "date.30": "Last 30 days",
  "date.60": "Last 60 days",
  "date.90": "Last 90 days",
  "date.custom": "Custom",
  "month.0": "Jan",
  "month.1": "Feb",
  "month.2": "Mar",
  "month.3": "Apr",
  "month.4": "May",
  "month.5": "Jun",
  "month.6": "Jul",
  "month.7": "Aug",
  "month.8": "Sep",
  "month.9": "Oct",
  "month.10": "Nov",
  "month.11": "Dec",
  "report.basedOn": "Report based on {n} prompts.",
  "report.showingFiltered": "Showing {n} filtered prompts.",
  "prompts.title": "Prompts",
  "prompts.subtitle":
    "See which AI prompts mention your brand, and which mention your competitors.",
  "metric.estimated": "Estimated",
  "metric.aiVisibility": "AI Visibility",
  "metric.brandCoverage": "Brand Coverage",
  "metric.sov": "Share of Voice",
  "metric.domainCite": "Domain Citations",
  "sentiment.estimated": "Sentiment (est.)",
  "sentiment.pending": "Sentiment",
  "sentiment.breakdown": "Sentiment breakdown",
  "visibility.hint":
    "0–100 composite index: coverage, share of voice, and owned-domain citation share.",
  "reports.emptyTitle": "Reports",
  "reports.emptyBody":
    "Saved report history will be persisted soon. For now, export a PDF from Brand Report → Generate Report.",
  "reports.cta": "Go to Overview to export",
  "help.comingSoon": "Help center coming soon",
  "detected.demoSeed": "Demo data",
  "research.engine.heuristic":
    "Engine: heuristic templates (OPENAI_API_KEY not set)",
  "research.engine.llm": "Engine: LLM",
  "overview.coverageTrend": "Brand Coverage Over Time",
  "overview.coverageTrendTip":
    "Daily brand coverage for you and competitors in the selected range. Use Me+ for Top 5 / all competitors; click the legend to show or hide series.",
  "overview.brandMentions": "Your Brand Mentions",
  "overview.brandMentionsTip":
    "Total times your brand was mentioned in AI answers in the selected period. Competitors below for comparison.",
  "overview.avgPosition": "Your Average Brand Position",
  "overview.avgPositionTip":
    "Average rank of your brand in answer brand lists. 1 means most often mentioned first; lower is better.",
  "overview.topPromptsMentions": "Top Prompts by Brand Mentions",
  "overview.topPromptsMentionsTip":
    "Monitored prompts where your brand is mentioned most. Use them to spot high-visibility topics.",
  "overview.domainCitation": "Domain Citation",
  "overview.domainCitationTip":
    "Times your owned domain appears in answer citations. Competitor domains below for comparison.",
  "overview.citationShare": "Citations Share",
  "overview.citationShareTip":
    "Your citation count as a share of all citations. Top URLs help identify winning pages in AI search.",
  "overview.mePlusAll": "Me + all competitors",
  "overview.mePlusTop5": "Me + Top 5 competitors",
  "overview.coverageAxis": "Brand Coverage %",
  "overview.brandRanking": "Brand Ranking",
  "overview.domainCoverage": "Domain Coverage",
  "overview.domainCiteTable": "Domain Citations",
  "overview.topPromptsDomain": "Top Prompts by Owned-Domain Citations",
  "overview.fullCitations": "Full citations →",
  "citations.topWinners": "Top Winners",
  "citations.topLosers": "Top Losers",
  "citations.cited": "Cited",
  "citations.yes": "Yes",
  "citations.no": "No",
  "bvi.title": "Brand Visibility Index on AI Search",
  "bvi.likelihood": "Likelihood to buy (est.)",
  "bvi.play": "Play time-lapse",
  "bvi.pause": "Pause",
  "bvi.brand": "Brand",
  "bvi.coverage": "Brand Coverage",
  "bvi.axisCoverage": "Brand Coverage %",
  "bvi.timelapseAria": "Brand Visibility Index time-lapse",
  "bvi.scatterAria": "Brand Visibility Index scatter",
  "bvi.q.niche": "Niche",
  "bvi.q.leaders": "Leaders",
  "bvi.q.lowPerf": "Low Performance",
  "bvi.q.lowConv": "Low Conversion",
  "pricing.mostPopular": "Most Popular",
  "pricing.addons": "Add-Ons",
  "pricing.availableAddons": "Available Add-ons",
  "pricing.availableEngines": "Available AI search engines",
  "pricing.faqs": "FAQs",
};

const catalogs: Record<Locale, Record<string, string>> = {
  zh: { ...zhMessages },
  en: { ...enMessages },
};

let locale: Locale = "zh";

export function registerMessages(loc: Locale, messages: Record<string, string>) {
  catalogs[loc] = { ...catalogs[loc], ...messages };
}

export function getLocale(): Locale {
  return locale;
}

export function setLocale(next: Locale) {
  locale = next;
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ORBIS_LOCALE_KEY, next);
      document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
    }
  } catch {
    /* ignore */
  }
}

export function initLocaleFromStorage(): Locale {
  try {
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem(ORBIS_LOCALE_KEY);
      if (raw === "en" || raw === "zh") {
        locale = raw;
        document.documentElement.lang = raw === "zh" ? "zh-CN" : "en";
        return locale;
      }
    }
  } catch {
    /* ignore */
  }
  locale = "zh";
  return locale;
}

export function t(
  key: string,
  vars?: Record<string, string | number>,
): string {
  const msg =
    catalogs[locale][key] ?? catalogs.zh[key] ?? catalogs.en[key] ?? key;
  if (!vars) return msg;
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v)),
    msg,
  );
}
