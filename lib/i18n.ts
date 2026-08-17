export type Locale = "zh" | "en";

export const ORBIS_LOCALE_KEY = "orbis_locale";

export const zhMessages: Record<string, string> = {
  "app.name": "ORBIS",
  "nav.brandReport": "品牌报告",
  "nav.overview": "总览",
  "nav.prompts": "Prompts",
  "nav.citations": "引用分析",
  "nav.recommendations": "优化建议",
  "nav.research": "AI Prompt 研究",
  "nav.reports": "报告中心",
  "nav.content": "内容生成",
  "nav.settings": "品牌设置",
  "action.generateReport": "生成品牌报告",
  "action.exportCsv": "导出 CSV",
  "action.viewFullReport": "查看完整报告",
  "action.resetFilters": "重置筛选",
  "action.settings": "品牌设置",
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
  "sentiment.estimated": "情感（估算）",
  "sentiment.pending": "情感",
  "sentiment.breakdown": "情感分布",
  "visibility.hint":
    "0–100 综合指数：综合品牌覆盖率、Share of Voice 与官网引用份额。",
  "reports.emptyTitle": "报告中心",
  "reports.emptyBody":
    "历史报告列表将接入数据库持久化。当前请从品牌报告页使用「生成品牌报告」导出 PDF。",
  "reports.cta": "前往总览生成报告",
  "help.comingSoon": "帮助中心即将上线",
  "detected.demoSeed": "演示数据",
  "research.engine.heuristic": "生成引擎：启发式模板（未配置 OPENAI_API_KEY）",
  "research.engine.llm": "生成引擎：大模型",
  "bvi.title": "AI 搜索品牌可见度指数（BVI）",
  "bvi.likelihood": "购买可能性（估算）",
};

export const enMessages: Record<string, string> = {
  "app.name": "ORBIS",
  "nav.brandReport": "Brand Report",
  "nav.overview": "Overview",
  "nav.prompts": "Prompts",
  "nav.citations": "Citations",
  "nav.recommendations": "Recommendations",
  "nav.research": "AI Prompt Research",
  "nav.reports": "Reports",
  "nav.content": "Content",
  "nav.settings": "Brand settings",
  "action.generateReport": "Generate Report",
  "action.exportCsv": "Export as CSV",
  "action.viewFullReport": "View full report",
  "action.resetFilters": "Reset filters",
  "action.settings": "Brand settings",
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
  "bvi.title": "Brand Visibility Index on AI Search",
  "bvi.likelihood": "Likelihood to buy (est.)",
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
