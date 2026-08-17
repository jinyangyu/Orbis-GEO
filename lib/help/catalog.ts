export type HelpPageKey =
  | "overview"
  | "prompts"
  | "citations"
  | "recommendations"
  | "research"
  | "reports"
  | "content"
  | "brand-settings"
  | "help"
  | "billing";

export type HelpCta =
  | { label: string; article: string }
  | { label: string; page: HelpPageKey };

export type HelpBlock =
  | { t: "p"; v: string }
  | { t: "h"; v: string }
  | { t: "ol"; v: string[] }
  | { t: "ul"; v: string[] }
  | { t: "table"; h: string[]; r: string[][] }
  | { t: "note"; v: string }
  | { t: "cta"; v: HelpCta[] };

export type HelpArticle = {
  id: string;
  title: string;
  summary: string;
  category: string;
  body: HelpBlock[];
};

export type HelpCategory = {
  id: string;
  slug: string;
  title: string;
  blurb: string;
  articleIds: string[];
  /** How many articles the homepage shows before 「查看更多」, matching Otterly. */
  preview: number;
};

function article(
  id: string,
  category: string,
  title: string,
  summary: string,
  body: HelpBlock[],
): HelpArticle {
  return { id, category, title, summary, body };
}

export const HELP_ARTICLES: HelpArticle[] = [
  article("what-is-orbis", "start", "Orbis 是什么，如何工作？", "AI 搜索可见度监测与 GEO 优化平台。", [
    { t: "p", v: "Orbis 帮助品牌监测自己在 ChatGPT、Google AI Overviews、Perplexity、Microsoft Copilot（以及可选的 Gemini、Google AI Mode、Claude）中的提及、推荐与引用表现。" },
    { t: "p", v: "你把真实用户会问 AI 的问题（Prompt）加入监测工作区。Orbis 定期收集各引擎的回答，统计覆盖率、声量份额、位次和引用域名，并生成可执行的优化建议。" },
    { t: "ul", v: ["品牌报告总览：覆盖率、BVI、竞品对比", "Prompts：每一问的提及与情感", "引用：AI 回答引用了哪些网页", "建议：把缺口变成内容与公关动作", "Prompt 研究：发现还没监测的高价值问题"] },
    { t: "cta", v: [{ label: "打开总览", page: "overview" }, { label: "开始首次激活", article: "onboarding-guide" }] },
  ]),
  article("how-orbis-works", "start", "Orbis 三分钟讲解（视频教程）", "用短片走完 Prompt → 答卷 → 报告。", [
    { t: "p", v: "对应 Otterly 的 Explained in Minutes。演示环境请按入门指南 7 步自学，或从侧栏「重新体验首次激活」走一遍向导。" },
    { t: "ol", v: ["什么是 AI 搜索", "如何读总览", "如何加入监测 Prompt", "如何导出品牌报告"] },
    { t: "cta", v: [{ label: "打开入门指南", article: "onboarding-guide" }, { label: "打开总览", page: "overview" }] },
  ]),
  article("best-use-cases", "start", "Orbis 最适合哪些场景？", "品牌监测、竞品对照、代理商多客户、GEO 优化闭环。", [
    { t: "p", v: "Orbis 适合已经有官网或内容资产、需要知道自己在 ChatGPT 等回答里出不出现的团队。" },
    { t: "ul", v: ["品牌方：盯覆盖率、引用与竞品缺口", "内容/SEO：把 Prompt 研究接到选题", "公关：看哪些第三方域名被 AI 引用", "代理商：用工作区隔离多个客户品牌"] },
    { t: "cta", v: [{ label: "入门指南", article: "onboarding-guide" }, { label: "多品牌/工作区", article: "multiple-brands" }] },
  ]),
  article("onboarding-guide", "onboarding", "Orbis 入门指南", "从理解 AI 搜索到第一次读懂品牌报告。", [
    { t: "p", v: "按下面 7 步走完，即可独立使用 Orbis。" },
    { t: "ol", v: ["什么是 AI 搜索，为什么要监测", "熟悉 Orbis 界面", "用 Prompt 研究找到该监测的问题", "读懂品牌报告", "根据建议做优化", "把 GEO 方法落到站点与内容", "资源与支持"] },
    { t: "cta", v: [
      { label: "1. AI 搜索", article: "onboarding-1-ai-search" },
      { label: "2. 界面", article: "onboarding-2-interface" },
      { label: "3. Prompt 研究", article: "onboarding-3-prompt-research" },
      { label: "4. 品牌报告", article: "onboarding-4-brand-report" },
      { label: "5. 优化", article: "onboarding-5-optimize" },
      { label: "6. GEO", article: "onboarding-6-geo" },
      { label: "7. 资源", article: "onboarding-7-resources" },
    ] },
  ]),
  article("onboarding-1-ai-search", "onboarding", "入门 1/7：什么是 AI 搜索", "用户正在向 ChatGPT 等提问，而不是只点十个蓝链。", [
    { t: "p", v: "AI 搜索指用户向 ChatGPT、Perplexity、Google AI Overviews 等提问后，直接得到综合回答。品牌若未被提及或未被引用，就会从这段决策路径中消失。" },
    { t: "p", v: "GEO（Generative Engine Optimization）就是让品牌更频繁、更准确地出现在这些回答里。" },
    { t: "cta", v: [{ label: "下一篇：界面", article: "onboarding-2-interface" }] },
  ]),
  article("onboarding-2-interface", "onboarding", "入门 2/7：熟悉 Orbis 界面", "侧栏、工作区、筛选与账户。", [
    { t: "ul", v: ["左上角 Logo 回到总览；其下切换监测工作区。", "品牌报告：总览 / Prompts / 引用 / 建议 / 品牌设置。", "通用：Prompt 研究、内容生成、报告中心。", "侧栏底部：帮助与文档、账单与套餐。", "面包屑行右上：账户头像与通知（全局）。标题行右侧：齿轮改这份报告，「生成品牌报告」是本页主操作。"] },
    { t: "cta", v: [{ label: "打开总览", page: "overview" }, { label: "下一篇：Prompt 研究", article: "onboarding-3-prompt-research" }] },
  ]),
  article("onboarding-3-prompt-research", "onboarding", "入门 3/7：掌握 Prompt 研究", "先找到用户会问的问题，再加入监测。", [
    { t: "p", v: "Prompt 研究根据品牌、域名或关键词，生成用户可能向 AI 提出的问题，并可一键提升为监测 Prompt。" },
    { t: "ol", v: ["打开「Prompt 研究」。", "输入品牌名或官网。", "选择市场与语言。", "生成列表后，把高价值问题加入监测。"] },
    { t: "cta", v: [{ label: "打开 Prompt 研究", page: "research" }, { label: "下一篇：品牌报告", article: "onboarding-4-brand-report" }] },
  ]),
  article("onboarding-4-brand-report", "onboarding", "入门 4/7：读懂品牌报告", "覆盖率、声量、引用与竞品。", [
    { t: "ul", v: ["覆盖率：有多少监测 Prompt 在回答中提到了你。", "声量份额：相对竞品被提及的比例。", "引用：回答引用了哪些域名，官网占比如何。", "BVI：综合可见度指数。"] },
    { t: "p", v: "首次激活完成后，系统会用你填写的 Prompt 自动生成第一份品牌报告。" },
    { t: "cta", v: [{ label: "打开总览", page: "overview" }, { label: "下一篇：优化", article: "onboarding-5-optimize" }] },
  ]),
  article("onboarding-5-optimize", "onboarding", "入门 5/7：按建议优化可见度", "把缺口变成内容、公关与页面动作。", [
    { t: "p", v: "「建议」页会根据覆盖缺口、弱引用与竞品占优的问题，列出优先动作。建议更新时，若已配置 Webhook，还会推送到你的通知地址。" },
    { t: "cta", v: [{ label: "打开建议", page: "recommendations" }, { label: "下一篇：GEO", article: "onboarding-6-geo" }] },
  ]),
  article("onboarding-6-geo", "onboarding", "入门 6/7：GEO 方法如何落地", "Orbis 用建议 + 品牌设置承接 GEO，而不是单独的站点爬虫审计。", [
    { t: "p", v: "常见 GEO 动作包括：让官方内容直接回答高价值 Prompt、争取权威媒体与评测引用、统一品牌别名、在多市场用当地语言监测。" },
    { t: "p", v: "在品牌设置中维护域名与别名，确保提及匹配准确；在内容生成中把建议变成文章。" },
    { t: "cta", v: [{ label: "GEO 方法说明", article: "geo-methods" }, { label: "下一篇：资源", article: "onboarding-7-resources" }] },
  ]),
  article("onboarding-7-resources", "onboarding", "入门 7/7：资源与支持", "帮助中心、账单与人工支持。", [
    { t: "ul", v: ["本帮助中心：按模块查阅。", "账单与套餐：试用、升级、发票。", "缺陷与需求：通过支持页提交。"] },
    { t: "cta", v: [{ label: "联系支持", article: "contact-support" }, { label: "查看套餐", page: "billing" }] },
  ]),
  article("supported-engines", "general", "Orbis 支持哪些 AI 搜索引擎？", "默认 4 个核心引擎，其余为加购。", [
    { t: "table", h: ["引擎", "默认套餐", "说明"], r: [
      ["ChatGPT", "含", "对话式回答与引用"],
      ["Google AI Overviews", "含", "搜索结果中的 AI 摘要"],
      ["Perplexity", "含", "带引用的问答"],
      ["Microsoft Copilot", "含", "Bing / Copilot 回答"],
      ["Google AI Mode / Gemini / Claude", "加购", "在账单页按引擎开通"],
    ] },
    { t: "cta", v: [{ label: "购买引擎加购", article: "engine-addons" }, { label: "打开账单", page: "billing" }] },
  ]),
  article("supported-countries", "general", "支持多少个国家/市场？", "50+ 市场；同一 Prompt 每个国家占用 1 条配额。", [
    { t: "p", v: "Orbis 按市场监测。同一句 Prompt 若要覆盖英国、爱尔兰与德国，会占用 3 条 Prompt 配额。" },
    { t: "cta", v: [{ label: "配额如何计算", article: "what-is-a-prompt" }] },
  ]),
  article("find-prompts", "research", "如何为品牌找到相关 Prompt？", "用 Prompt 研究生成真实用户问题。", [
    { t: "ol", v: ["进入「Prompt 研究」。", "用品牌名、官网或关键词生成问题。", "按意图与市场筛选。", "将选中项提升为监测 Prompt。"] },
    { t: "note", v: "未配置大模型密钥时，研究页会使用启发式模板，仍可生成可监测的问题列表。" },
    { t: "cta", v: [{ label: "打开 Prompt 研究", page: "research" }] },
  ]),
  article("research-languages", "research", "Prompt 研究支持哪些语言？", "界面中英；研究输出跟随品牌市场语言。", [
    { t: "p", v: "研究任务会尽量使用目标市场语言生成问题（例如英国用英语、德国用德语）。监测语言与研究语言应保持一致，否则覆盖率会失真。" },
  ]),
  article("setup-brand-report", "report", "如何设置品牌报告", "本品、竞品、Prompt 与筛选。", [
    { t: "ol", v: ["完成首次激活或在品牌设置中填写本品域名。", "添加竞品。", "加入监测 Prompt。", "在总览用日期与引擎筛选阅读指标。", "需要时生成 PDF。"] },
    { t: "cta", v: [{ label: "品牌设置", page: "brand-settings" }, { label: "打开总览", page: "overview" }] },
  ]),
  article("add-domains", "report", "如何添加更多域名或域名变体", "主域 + 别名，可选含子域。", [
    { t: "p", v: "在品牌设置中维护主域名与域名别名（如 brand.com、news.brand.com）。开启「包含子域」后，引用匹配会覆盖子域。" },
    { t: "cta", v: [{ label: "打开品牌设置", page: "brand-settings" }] },
  ]),
  article("brand-insights", "report", "品牌报告能读出什么", "可见度、缺口与引用结构。", [
    { t: "ul", v: ["哪些问题提到了你、哪些只提到竞品", "声量是否被竞品压过", "AI 更爱引用官网还是第三方", "建议页对应的优先动作"] },
    { t: "cta", v: [{ label: "打开总览", page: "overview" }] },
  ]),
  article("multiple-brands", "report", "一个账户能管多个品牌/客户吗？", "用工作区隔离；Prompt 配额在账户内共享。", [
    { t: "p", v: "每个监测工作区对应一套品牌报告、Prompt 与成员。Lite 含 1 个工作区，标准版及以上不限工作区。账户级 Prompt 配额可在工作区之间自由分配。" },
    { t: "cta", v: [{ label: "切换工作区", article: "switch-workspace" }, { label: "查看套餐", page: "billing" }] },
  ]),
  article("brand-aliases", "report", "如何添加品牌名与别名", "避免漏匹配或误匹配。", [
    { t: "p", v: "在品牌设置中填写官方名称与别名（缩写、曾用名、当地译名）。匹配规则同时看名称与域名。" },
    { t: "cta", v: [{ label: "打开品牌设置", page: "brand-settings" }] },
  ]),
  article("citation-analysis", "analysis", "为什么要分析 AI 回答中的引用链接？", "引用决定回答的可信来源，也是可攻占的渠道。", [
    { t: "p", v: "即使用户没点开链接，模型也常把引用页当作事实来源。占领高权威评测、文档与媒体页，往往比只做官网首页更有效。" },
    { t: "p", v: "在引用页可按域名查看份额，并把重要 URL 标星，便于持续跟踪。" },
    { t: "cta", v: [{ label: "打开引用", page: "citations" }] },
  ]),
  article("prompt-monitoring", "tracking", "Prompt 监测如何工作？", "按日跟踪同一批问题在各引擎的回答。", [
    { t: "p", v: "加入监测的每一条 Prompt 都会进入品牌报告。你可按引擎、市场、标签筛选，查看覆盖率、提及次数与竞品共现。" },
    { t: "note", v: "配额按「Prompt × 国家」计算，详见「什么是一条 Prompt」。" },
    { t: "cta", v: [{ label: "打开 Prompts", page: "prompts" }, { label: "配额说明", article: "what-is-a-prompt" }] },
  ]),
  article("what-is-a-prompt", "tracking", "什么是一条监测 Prompt？", "一句用户问题，绑定一个市场。", [
    { t: "p", v: "Prompt 是你要求 AI 引擎回答的那句话，例如 “best classifieds site in the UK”。" },
    { t: "ul", v: ["同一句话监测 4 个国家 = 4 条配额", "可在工作区、品牌报告之间自由分配", "试用含 50 条；付费档见套餐表"] },
    { t: "cta", v: [{ label: "购买更多 Prompt", article: "buy-prompts" }, { label: "打开账单", page: "billing" }] },
  ]),
  article("monitoring-languages", "tracking", "监测支持哪些语言？", "跟随 Prompt 文本与目标市场。", [
    { t: "p", v: "请用目标用户的语言书写 Prompt。中文界面也可以监测英语市场——语言以 Prompt 本身为准。" },
  ]),
  article("what-is-geo", "geo", "什么是 GEO？", "面向生成式引擎的可见度优化。", [
    { t: "p", v: "GEO（Generative Engine Optimization）优化品牌在 AI 回答中的提及、推荐与引用，而不是只追求传统十个蓝链排名。" },
    { t: "cta", v: [{ label: "GEO 方法", article: "geo-methods" }] },
  ]),
  article("recs-actionable", "geo", "Orbis 会给出可执行的优化建议吗？", "会。建议来自监测缺口，不是空泛清单。", [
    { t: "p", v: "建议页结合覆盖缺口、弱官网引用和竞品占优 Prompt，输出内容、公关与页面类动作。建议集合变化时会写入通知。" },
    { t: "cta", v: [{ label: "打开建议", page: "recommendations" }] },
  ]),
  article("geo-methods", "geo", "有哪些 GEO 方法？", "内容、引用源、实体一致性、多市场。", [
    { t: "ul", v: ["让官方文章直接回答高价值 Prompt", "争取评测、百科、行业媒体引用", "统一品牌名、域名与别名", "按市场使用当地语言监测与创作", "对比竞品占优的问题，补齐内容"] },
    { t: "cta", v: [{ label: "打开内容生成", page: "content" }] },
  ]),
  article("export-data", "export", "可以导出数据吗？", "CSV、PDF；后续可接 Looker / API。", [
    { t: "ul", v: ["Prompts 页可导出当前筛选的 CSV", "总览可生成品牌报告 PDF", "报告中心可再次下载已保存的 PDF"] },
    { t: "note", v: "API、MCP 与 Looker Studio 在标准版及以上套餐开放，演示环境以页面导出为主。" },
    { t: "cta", v: [{ label: "打开 Prompts", page: "prompts" }, { label: "报告中心", page: "reports" }] },
  ]),
  article("export-pdf", "export", "品牌报告可以导出 PDF 吗？", "可以，并在报告中心再下载。", [
    { t: "ol", v: ["在总览点击「生成品牌报告」。", "选择文档或演示文稿、日期与引擎。", "生成后上传到报告中心。", "之后可随时下载，删除前会确认。"] },
    { t: "cta", v: [{ label: "打开报告中心", page: "reports" }, { label: "打开总览", page: "overview" }] },
  ]),
  article("content-generation", "export", "内容生成页是做什么的？", "查看内容代理产出的文章状态与预览。", [
    { t: "p", v: "「内容生成」列出 seo-generator-agent 的文章。可按状态、站点、市场筛选，并在预览就绪时打开正文。" },
    { t: "cta", v: [{ label: "打开内容生成", page: "content" }] },
  ]),
  article("free-trial", "account", "试用多久，含多少 Prompt？", "7 天，50 条 Prompt，无需信用卡。", [
    { t: "table", h: ["项目", "试用包含"], r: [
      ["时长", "7 天"],
      ["Search prompts", "50"],
      ["工作区", "不限（试用）"],
      ["团队成员", "不限"],
    ] },
    { t: "p", v: "试用结束需选择付费套餐才能继续监测。若同事已有 Orbis 账户，请让管理员邀请你，不要再开一个试用。" },
    { t: "cta", v: [{ label: "开通套餐", page: "billing" }, { label: "申请延长试用", article: "extend-trial" }] },
  ]),
  article("extend-trial", "account", "可以延长试用吗？", "联系支持说明使用场景。", [
    { t: "p", v: "如需更多时间评估，请通过支持渠道说明品牌与监测规模。我们会按个案处理。" },
    { t: "cta", v: [{ label: "联系支持", article: "contact-support" }] },
  ]),
  article("sso", "account", "是否提供 SSO？", "企业套餐提供。", [
    { t: "p", v: "SAML / OIDC 单点登录在企业套餐中提供。自助档位使用会话 Cookie 登录。" },
    { t: "cta", v: [{ label: "企业咨询", article: "contact-support" }] },
  ]),
  article("team-roles", "account", "管理员、成员与只读有何区别？", "账单与成员管理仅管理员可见。", [
    { t: "table", h: ["权限", "管理员", "成员", "只读"], r: [
      ["查看报告与 Prompt", "是", "是", "是"],
      ["编辑 Prompt / 品牌设置", "是", "是", "否"],
      ["导出", "是", "是", "是"],
      ["管理工作区与邀请", "是", "否", "否"],
      ["账单与订阅", "是", "否", "否"],
    ] },
    { t: "note", v: "当前演示会话将登录用户视为工作区成员；邀请流程上线后按上表生效。" },
  ]),
  article("switch-workspace", "account", "如何切换监测工作区？", "侧栏点击工作区名称，在列表中选择。", [
    { t: "p", v: "左上角工作区选择器会展开全部监测工作区。点选后立即加载该工作区的总览数据。" },
  ]),
  article("pricing", "billing", "套餐与价格", "按 Prompt 配额计费，席位不限。", [
    { t: "table", h: ["套餐", "月付", "年付约", "Prompts", "工作区"], r: [
      ["试用", "免费", "—", "50 / 7 天", "不限"],
      ["轻量 Lite", "$29", "$25", "15", "1"],
      ["标准 Standard", "$189", "$160", "100", "不限"],
      ["专业 Premium", "$489", "$422", "400", "不限"],
      ["企业", "定制起 $1,000", "—", "定制", "不限"],
    ] },
    { t: "p", v: "所有付费档均含不限成员、每日监测、核心 4 引擎。年付约 15% 优惠。价格为演示标价（美元，不含税）。" },
    { t: "cta", v: [{ label: "打开账单", page: "billing" }, { label: "如何购买", article: "buy-a-plan" }] },
  ]),
  article("buy-a-plan", "billing", "如何购买套餐", "在账单页选择档位，填写公司与支付信息。", [
    { t: "ol", v: ["登录 Orbis。", "打开「账单与套餐」。", "选择月付或年付，点选 Lite / Standard / Premium。", "填写公司信息。演示环境会生成一张发票，不真实扣款。"] },
    { t: "p", v: "正式环境将通过 Stripe 安全处理信用卡。企业档支持对公与定制合同。" },
    { t: "cta", v: [{ label: "打开账单", page: "billing" }] },
  ]),
  article("upgrade", "billing", "如何升级套餐", "立即生效，剩余时长折抵。", [
    { t: "ol", v: ["打开账单。", "在套餐卡片点「升级」。", "或点「管理订阅」→「升级套餐」。"] },
    { t: "p", v: "升级后立即获得新档配额与功能。未用完的订阅会折抵到新套餐。" },
    { t: "cta", v: [{ label: "打开账单", page: "billing" }] },
  ]),
  article("downgrade", "billing", "如何降级套餐", "先把 Prompt 降到目标档上限，账期结束生效。", [
    { t: "ol", v: ["删除或停用超出目标套餐上限的监测 Prompt。", "打开账单，选择更低档位。", "降级在当前账期结束后生效，此前仍享受原套餐。"] },
    { t: "cta", v: [{ label: "打开账单", page: "billing" }, { label: "打开 Prompts", page: "prompts" }] },
  ]),
  article("cancel", "billing", "如何取消订阅", "账期结束前仍可使用。", [
    { t: "ol", v: ["打开账单。", "点击「管理订阅」。", "选择「取消订阅」并确认。"] },
    { t: "ul", v: ["取消后用到账期结束", "之后停止新的监测写入", "可随时再次升级开通"] },
    { t: "cta", v: [{ label: "打开账单", page: "billing" }] },
  ]),
  article("invoices", "billing", "如何获取发票", "账单页 → 管理订阅 → 查看发票。", [
    { t: "p", v: "正式环境会跳转 Stripe 客户门户，发票在页面底部。演示环境在「发票」页列出本地生成的记录。" },
    { t: "note", v: "无有效订阅时，历史发票请联系支持。" },
    { t: "cta", v: [{ label: "打开发票", page: "billing" }] },
  ]),
  article("billing-email", "billing", "如何添加账单邮箱", "在账单信息中修改，发票将发到该邮箱。", [
    { t: "ol", v: ["打开账单。", "进入「账单信息」。", "修改账单邮箱并保存。"] },
    { t: "cta", v: [{ label: "打开账单", page: "billing" }] },
  ]),
  article("company-invoice", "billing", "如何修改发票上的公司信息", "公司名、地址与税号在账单信息中维护。", [
    { t: "p", v: "正式环境通过 Stripe 门户的 Billing Information 修改。演示环境直接在账单信息表单中编辑。" },
    { t: "cta", v: [{ label: "打开账单", page: "billing" }] },
  ]),
  article("pay-card", "billing", "可以用信用卡支付吗？", "可以。Visa / Mastercard / Amex，经 Stripe 处理。", [
    { t: "p", v: "Orbis 不会保存完整卡号。换卡：账单 → 管理订阅 → 账单信息。" },
  ]),
  article("pay-transfer", "billing", "可以对公转账或 PayPal 吗？", "企业套餐可对公；PayPal 需联系支持。", [
    { t: "p", v: "自助套餐默认信用卡。对公转账、净额条款与定制合同走企业套餐。PayPal 等其他方式请联系支持。" },
    { t: "cta", v: [{ label: "联系支持", article: "contact-support" }] },
  ]),
  article("vat", "billing", "为什么需要税号 / VAT ID？", "用于合规开票与税额计算。", [
    { t: "p", v: "若公司需要增值税发票，请在账单信息中填写税号。演示环境仅保存文本，不校验格式。" },
  ]),
  article("buy-prompts", "billing", "如何购买更多 Prompt？", "标准版与专业版可按 100 条加购。", [
    { t: "ol", v: ["打开账单 → 加购。", "将额外 Prompt 调整为 100 的倍数。", "确认后立即增加账户配额。"] },
    { t: "p", v: "标准版最多再加约 300 条，超出请升级专业版。轻量版不可加购 Prompt。" },
    { t: "cta", v: [{ label: "打开账单", page: "billing" }] },
  ]),
  article("prompt-limits", "billing", "各套餐能加多少 Prompt？", "见套餐表；加购仅标准/专业。", [
    { t: "table", h: ["套餐", "基础配额", "加购"], r: [
      ["试用", "50", "不可加购"],
      ["轻量", "15", "不可加购"],
      ["标准", "100", "+100/包，最多约 +300"],
      ["专业", "400", "+100/包"],
    ] },
    { t: "cta", v: [{ label: "打开账单", page: "billing" }] },
  ]),
  article("engine-addons", "billing", "如何加购 Gemini / AI Mode / Claude？", "在账单加购页按引擎开通。", [
    { t: "p", v: "核心四引擎包含在套餐内。Google AI Mode、Gemini、Claude 按档位加价，可单独或组合开通。" },
    { t: "cta", v: [{ label: "打开账单", page: "billing" }] },
  ]),
  article("contact-support", "support", "如何联系客户支持？", "帮助页留言、邮件 support@orbis.example。", [
    { t: "p", v: "演示环境请使用本页表单，内容会记入浏览器本地，便于联调交互。正式环境将接入在线客服与邮件。" },
    { t: "ul", v: ["产品问题：support@orbis.example", "商务 / 企业：hello@orbis.example"] },
    { t: "cta", v: [{ label: "打开支持表单", article: "contact-support" }] },
  ]),
  article("suggest-feature", "support", "如何提交功能建议？", "发到支持邮箱，或走缺陷反馈表单。", [
    { t: "p", v: "欢迎描述使用场景与预期结果。我们会阅读每一条反馈。" },
  ]),
  article("report-bug", "support", "如何报告缺陷？", "说明步骤、期望与实际结果，尽量附截图。", [
    { t: "ol", v: ["你想做什么", "实际发生了什么", "如何复现", "浏览器与时间"] },
    { t: "cta", v: [{ label: "联系支持", article: "contact-support" }] },
  ]),
  article("demos", "support", "是否提供产品演示？", "提供。可预约或使用首次激活自行体验。", [
    { t: "p", v: "可先走「重新体验首次激活」，或联系 hello@orbis.example 预约演示。" },
  ]),
  article("onboarding-sessions", "support", "是否提供 onboarding 会议？", "轻量/标准为集体场，专业/企业可预约一对一。", [
    { t: "p", v: "专业版与企业套餐含个人 onboarding。轻量与标准可参加集体场。也可随时回看本入门指南。" },
    { t: "cta", v: [{ label: "入门指南", article: "onboarding-guide" }] },
  ]),
  article("terms", "security", "在哪里查看条款？", "演示占位；正式环境将发布服务条款与隐私政策。", [
    { t: "p", v: "使用 Orbis 即表示你同意仅在授权工作区内处理品牌监测数据。完整条款将发布在官网。" },
  ]),
  article("security-compliance", "security", "安全与合规", "会话 Cookie、成员校验、Webhook SSRF 防护。", [
    { t: "ul", v: ["HttpOnly 签名会话 Cookie", "工作区成员校验", "生产环境禁用 DEV claim", "Webhook 拒绝内网地址", "后台默认 noindex"] },
  ]),
  article("gdpr", "security", "如何申请数据删除或导出？", "管理员可导出 CSV/PDF；删除请联系支持。", [
    { t: "p", v: "工作区管理员可导出 Prompt 与报告。删除账户或监测原始答卷请邮件 support@orbis.example，并提供工作区 ID。" },
  ]),
  article("agent-analytics", "agents", "什么是 Agent Analytics？", "跟踪 AI 爬虫与代理如何访问你的站点。", [
    { t: "p", v: "Agent Analytics 统计 GPTBot、ClaudeBot、PerplexityBot 等生成式引擎爬虫对官网的抓取量、状态码与热门路径，用来判断内容是否被模型「看见」。" },
    { t: "p", v: "Orbis 当前版本以答卷监测为主；爬虫日志分析按标准版及以上规划，可先用服务器日志自行核对 robots.txt 是否放行主要 AI 爬虫。" },
    { t: "cta", v: [{ label: "上传日志说明", article: "agent-upload-logs" }, { label: "查看套餐", page: "billing" }] },
  ]),
  article("agent-upload-logs", "agents", "如何向 Agent Analytics 上传日志？", "支持常见访问日志，按月计入事件配额。", [
    { t: "ol", v: ["准备 Nginx / Cloudflare / CDN 的访问日志（脱敏后）。", "在 Agent Analytics 选择工作区并上传。", "系统识别 User-Agent 并归入爬虫类别。", "查看抓取趋势与被拦请求。"] },
    { t: "note", v: "演示环境尚未开放上传。配额与 Otterly 类似：标准约 20 万事件/月，专业约 100 万事件/月。" },
  ]),
  article("geo-audit", "audit", "GEO Audit 是什么、能做什么？", "对官网做面向生成式引擎的技术体检。", [
    { t: "p", v: "GEO Audit 检查页面是否容易被 AI 引擎抓取与引用：可索引性、正文结构、实体一致性、引用友好的标题与 FAQ。" },
    { t: "p", v: "Orbis 现阶段把同类洞察放在「建议」与品牌设置（域名/别名）。独立 URL 审计将按套餐配额推出。" },
    { t: "cta", v: [{ label: "打开建议", page: "recommendations" }, { label: "Readiness 分析", article: "geo-readiness" }] },
  ]),
  article("geo-readiness", "audit", "GEO Audit 里的 Readiness 分析是什么？", "页面被生成式引擎采用的就绪程度。", [
    { t: "p", v: "Readiness 把单个 URL 打成可被 AI 引用的分数：内容是否直接回答问题、是否有清晰实体、是否允许爬虫、是否与品牌名一致。" },
    { t: "p", v: "在独立审计上线前，可用建议页的内容类动作，对照高价值 Prompt 检查官网是否已有对应文章。" },
    { t: "cta", v: [{ label: "GEO 方法", article: "geo-methods" }] },
  ]),
  article("agency-partners", "agency", "可以聘请 Orbis 合作代理商吗？", "代理商目录与 co-marketing 将随企业/代理商计划上线。", [
    { t: "p", v: "对应 Otterly 的 Agency Partner：代理商用一份订阅管理多客户工作区，并出现在合作名录里。" },
    { t: "p", v: "若你是品牌方需要实施团队，或你是代理商想开通多客户账单，请联系 hello@orbis.example。" },
    { t: "cta", v: [{ label: "联系支持", article: "contact-support" }, { label: "多品牌/工作区", article: "multiple-brands" }] },
  ]),
];

export const HELP_CATEGORIES: HelpCategory[] = [
  { id: "start", slug: "getting-started", title: "开始使用", blurb: "了解如何开始，以及用 Orbis 做什么——AI 搜索监测与优化平台。", articleIds: ["what-is-orbis", "how-orbis-works", "best-use-cases"], preview: 2 },
  { id: "onboarding", slug: "onboarding", title: "入门指南", blurb: "从基础概念到可执行的监测与优化步骤。", articleIds: ["onboarding-guide", "onboarding-1-ai-search", "onboarding-2-interface", "onboarding-3-prompt-research", "onboarding-4-brand-report", "onboarding-5-optimize", "onboarding-6-geo", "onboarding-7-resources"], preview: 1 },
  { id: "general", slug: "general", title: "一般问题", blurb: "关于 Orbis 的常见问题。", articleIds: ["supported-engines", "supported-countries"], preview: 2 },
  { id: "research", slug: "prompt-research", title: "Prompt 研究", blurb: "找到客户可能向 AI 搜索提出的问题。", articleIds: ["find-prompts", "research-languages"], preview: 2 },
  { id: "report", slug: "brand-reports-kpis", title: "品牌报告与指标", blurb: "品牌报告里能读到什么？", articleIds: ["setup-brand-report", "add-domains", "brand-insights", "multiple-brands", "brand-aliases"], preview: 5 },
  { id: "analysis", slug: "analysis-insights", title: "分析与洞察", blurb: "如何从监测数据里挖出更多洞察。", articleIds: ["citation-analysis"], preview: 1 },
  { id: "tracking", slug: "tracking-monitoring", title: "跟踪与监测", blurb: "如何跟踪监测 Prompt，衡量 AI 品牌可见度。", articleIds: ["prompt-monitoring", "monitoring-languages", "what-is-a-prompt"], preview: 2 },
  { id: "agents", slug: "agents-analytics", title: "Agent Analytics", blurb: "跟踪 AI 代理与爬虫如何访问你的站点：指标、类别与读数。", articleIds: ["agent-analytics", "agent-upload-logs"], preview: 2 },
  { id: "audit", slug: "geo-audits", title: "GEO Audit", blurb: "面向生成式引擎的站点技术审计，了解它能帮官网做什么。", articleIds: ["geo-audit", "geo-readiness"], preview: 2 },
  { id: "geo", slug: "geo-recommendations", title: "优化与 GEO 建议", blurb: "哪些 GEO 方法能提升你在 ChatGPT 等回答中的表现？", articleIds: ["what-is-geo", "recs-actionable", "geo-methods"], preview: 3 },
  { id: "export", slug: "integrations-export", title: "集成与数据导出", blurb: "可以做哪些集成，可以导出什么。", articleIds: ["export-data", "export-pdf", "content-generation"], preview: 2 },
  { id: "account", slug: "workspace-account", title: "工作区与账户", blurb: "如何管理账户与工作区。", articleIds: ["extend-trial", "free-trial", "sso", "team-roles", "switch-workspace"], preview: 3 },
  { id: "billing", slug: "billing-payment", title: "账单与付款", blurb: "如何购买 Orbis 订阅。", articleIds: ["buy-a-plan", "upgrade", "company-invoice", "invoices", "buy-prompts", "pricing", "downgrade", "cancel", "billing-email", "pay-card", "pay-transfer", "vat", "prompt-limits", "engine-addons"], preview: 5 },
  { id: "agency", slug: "agencies-enterprises", title: "代理商与企业", blurb: "需要企业报价、采购流程，或你是代理商 / 正在找代理商。", articleIds: ["agency-partners"], preview: 1 },
  { id: "security", slug: "security-terms", title: "安全与条款", blurb: "安全、认证与条款。", articleIds: ["terms", "security-compliance", "gdpr"], preview: 3 },
  { id: "support", slug: "customer-support", title: "客户支持、演示与 Onboarding", blurb: "如何联系支持、预约演示与 onboarding。", articleIds: ["contact-support", "suggest-feature", "demos", "onboarding-sessions", "report-bug"], preview: 4 },
];

export const PAGE_HELP_ARTICLE: Partial<Record<HelpPageKey, string>> = {
  overview: "brand-insights",
  prompts: "prompt-monitoring",
  citations: "citation-analysis",
  recommendations: "recs-actionable",
  research: "find-prompts",
  reports: "export-pdf",
  content: "content-generation",
  "brand-settings": "brand-aliases",
  billing: "pricing",
};

export function getHelpArticle(id: string | null | undefined): HelpArticle | undefined {
  if (!id) return undefined;
  return HELP_ARTICLES.find((a) => a.id === id);
}

export function getHelpCategoryById(id: string | null | undefined): HelpCategory | undefined {
  if (!id) return undefined;
  return HELP_CATEGORIES.find((c) => c.id === id);
}

export function getHelpCategoryBySlug(slug: string | null | undefined): HelpCategory | undefined {
  if (!slug) return undefined;
  return HELP_CATEGORIES.find((c) => c.slug === slug);
}

export function helpCategoryHref(category: HelpCategory): string {
  return `/help/${category.slug}`;
}

export function helpArticleHref(articleId: string): string {
  return `/help/${articleId}`;
}

export function helpHomeHref(query = ""): string {
  const q = query.trim();
  return q ? `/help?q=${encodeURIComponent(q)}` : "/help";
}

export function helpCtaHref(cta: HelpCta): string {
  if ("article" in cta) return helpArticleHref(cta.article);
  if (cta.page === "help") return "/help";
  if (cta.page === "overview") return "/";
  return `/#${cta.page}`;
}

export function helpCtaOpensProduct(cta: HelpCta): boolean {
  return "page" in cta && cta.page !== "help";
}

export function articlesForCategory(category: HelpCategory): HelpArticle[] {
  return category.articleIds
    .map((id) => getHelpArticle(id))
    .filter((article): article is HelpArticle => Boolean(article));
}

export function searchHelpArticles(q: string): HelpArticle[] {
  const n = q.trim().toLowerCase();
  if (!n) return HELP_ARTICLES;
  return HELP_ARTICLES.filter(
    (a) =>
      a.title.toLowerCase().includes(n) ||
      a.summary.toLowerCase().includes(n) ||
      a.body.some((b) => "v" in b && String(b.v).toLowerCase().includes(n)),
  );
}
