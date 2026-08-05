"use client";

import { useEffect, useMemo, useState } from "react";
import Onboarding, { hasCompletedOnboarding, resetOnboardingStorage } from "./onboarding";

type PageKey = "overview" | "research" | "prompts" | "brands" | "citations" | "audit" | "reports";

const navGroups = [
  { label: "工作台", items: [{ key: "overview", icon: "⌂", label: "总览" }] },
  { label: "AI 搜索", items: [
    { key: "research", icon: "✦", label: "Prompt 研究" },
    { key: "prompts", icon: "◎", label: "搜索监控", badge: "48" },
  ] },
  { label: "分析", items: [
    { key: "brands", icon: "◫", label: "品牌报告" },
    { key: "citations", icon: "↗", label: "引用分析" },
    { key: "audit", icon: "✓", label: "GEO Audit", badge: "6" },
  ] },
  { label: "交付", items: [{ key: "reports", icon: "▤", label: "报告中心" }] },
] as const;

const metrics = [
  { label: "AI 可见度", value: "67.4", suffix: "/100", delta: "+8.2%", tone: "mint", hint: "在目标问题中被推荐的综合表现" },
  { label: "品牌覆盖率", value: "42.8%", delta: "+5.6%", tone: "blue", hint: "206 次回答中出现 88 次" },
  { label: "Share of Voice", value: "24.6%", delta: "+3.1%", tone: "violet", hint: "在所有品牌提及中的占比" },
  { label: "官网引用", value: "126", delta: "+18", tone: "amber", hint: "过去 30 天累计域名引用" },
];

const promptRows = [
  { q: "适合跨境电商团队的最佳项目管理工具", tag: "商业调研", coverage: 78, sentiment: 92, mentions: 18, citations: 12, competitor: "Notion, Asana", status: "增长" },
  { q: "2026 年值得关注的 AI 营销自动化平台", tag: "行业榜单", coverage: 64, sentiment: 87, mentions: 15, citations: 8, competitor: "HubSpot, Jasper", status: "稳定" },
  { q: "中小企业如何选择内容协作软件", tag: "方案选择", coverage: 52, sentiment: 76, mentions: 11, citations: 6, competitor: "ClickUp", status: "机会" },
  { q: "Orbis 和传统 SEO 工具有什么区别", tag: "品牌对比", coverage: 46, sentiment: 84, mentions: 9, citations: 5, competitor: "Semrush", status: "增长" },
  { q: "如何监测品牌在 ChatGPT 中的可见度", tag: "问题解决", coverage: 31, sentiment: 71, mentions: 7, citations: 3, competitor: "OtterlyAI", status: "机会" },
  { q: "面向中国出海品牌的 GEO 服务推荐", tag: "服务推荐", coverage: 24, sentiment: 68, mentions: 5, citations: 2, competitor: "Profound", status: "风险" },
];

const engines = [
  { name: "ChatGPT", mark: "C", coverage: 58, mentions: 38, change: "+12.4%", color: "#111827" },
  { name: "Perplexity", mark: "P", coverage: 52, mentions: 31, change: "+8.1%", color: "#1d8f8a" },
  { name: "Google AI", mark: "G", coverage: 44, mentions: 27, change: "+5.7%", color: "#4285f4" },
  { name: "Gemini", mark: "✦", coverage: 39, mentions: 22, change: "+3.6%", color: "#7559ff" },
  { name: "Copilot", mark: "M", coverage: 28, mentions: 16, change: "-1.2%", color: "#1778d4" },
];

const citationRows = [
  { domain: "orbis.ai", type: "自有官网", citations: 126, prompts: 31, growth: "+18%", authority: 86 },
  { domain: "g2.com", type: "测评平台", citations: 94, prompts: 26, growth: "+11%", authority: 91 },
  { domain: "reddit.com", type: "社区讨论", citations: 78, prompts: 22, growth: "+24%", authority: 88 },
  { domain: "techcrunch.com", type: "行业媒体", citations: 61, prompts: 18, growth: "+7%", authority: 94 },
  { domain: "producthunt.com", type: "产品社区", citations: 43, prompts: 14, growth: "-3%", authority: 82 },
];

const auditItems = [
  { title: "补充高意图产品对比页", category: "内容机会", impact: "高", effort: "中", score: 92, detail: "竞品在 14 个对比型 Prompt 中出现，而品牌仅覆盖 4 个。" },
  { title: "为核心功能页增加 FAQ Schema", category: "技术优化", impact: "高", effort: "低", score: 88, detail: "6 个核心页面缺少可被答案引擎直接解析的结构化问答。" },
  { title: "强化第三方测评与社区声量", category: "数字公关", impact: "高", effort: "高", score: 84, detail: "AI 回答引用 Reddit 与 G2 的频率是品牌官网的 1.4 倍。" },
  { title: "统一品牌实体与产品描述", category: "品牌实体", impact: "中", effort: "低", score: 76, detail: "多个页面对产品类别的描述不一致，可能降低实体识别稳定性。" },
];

function Sparkline({ color = "#39b980", points = "0,42 18,38 36,41 54,28 72,31 90,17 108,22 126,7 144,12 164,3" }: { color?: string; points?: string }) {
  return <svg className="spark" viewBox="0 0 164 48" preserveAspectRatio="none" aria-hidden="true"><polyline points={points} fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function Donut({ value, color = "#5b6cff" }: { value: number; color?: string }) {
  return <div className="donut" style={{ background: `conic-gradient(${color} ${value}%, #edf0f4 0)` }}><span>{value}%</span></div>;
}

export default function Home() {
  const [experience, setExperience] = useState<"checking" | "onboarding" | "dashboard">("checking");
  const [page, setPage] = useState<PageKey>("overview");
  const [range, setRange] = useState("过去 30 天");
  const [engine, setEngine] = useState("全部平台");
  const [query, setQuery] = useState("");
  const [drawer, setDrawer] = useState<(typeof promptRows)[number] | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState("");
  const filteredPrompts = useMemo(() => promptRows.filter(row => row.q.toLowerCase().includes(query.toLowerCase()) || row.tag.includes(query)), [query]);

  useEffect(() => {
    const timer = window.setTimeout(() => setExperience(hasCompletedOnboarding() ? "dashboard" : "onboarding"), 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (experience === "checking") return <div className="experience-check"><div className="brand-orbit"><i /></div><b>ORBIS</b><span>正在准备你的工作区</span></div>;
  if (experience === "onboarding") return <Onboarding onComplete={() => setExperience("dashboard")} />;

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  };

  const changePage = (key: PageKey) => {
    setPage(key);
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const titles: Record<PageKey, [string, string]> = {
    overview: ["AI 搜索可见度总览", "了解品牌在主流答案引擎中的表现、变化与机会。"],
    research: ["AI Prompt 研究", "发现真实用户会向 AI 提出的高价值问题。"],
    prompts: ["搜索监控", "持续追踪每个 Prompt 的品牌提及、情感与引用。"],
    brands: ["品牌报告", "比较品牌和竞品在不同 AI 平台中的影响力。"],
    citations: ["引用分析", "识别影响 AI 回答的网页、媒体与社区来源。"],
    audit: ["GEO Audit", "将可见度数据转化为可以执行的优化优先级。"],
    reports: ["报告中心", "创建面向团队、客户和管理层的周期报告。"],
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="brand"><div className="brand-orbit"><i /></div><div><strong>ORBIS</strong><span>AI SEARCH INTELLIGENCE</span></div></div>
        <button className="workspace-switch" onClick={() => notify("工作区切换将在下一期接入")}><span className="workspace-avatar">N</span><span><b>Nova Labs</b><small>企业工作区</small></span><em>⌄</em></button>
        <nav>
          {navGroups.map(group => <div className="nav-group" key={group.label}><p>{group.label}</p>{group.items.map(item => <button key={item.key} className={page === item.key ? "active" : ""} onClick={() => changePage(item.key as PageKey)}><span className="nav-icon">{item.icon}</span>{item.label}{"badge" in item && item.badge && <small>{item.badge}</small>}</button>)}</div>)}
        </nav>
        <div className="sidebar-bottom"><button onClick={() => notify("帮助中心即将上线")}><span>?</span>帮助与文档</button><button onClick={() => { resetOnboardingStorage(); setExperience("onboarding"); }}><span>↺</span>重新体验首次激活</button><div className="account"><span>YC</span><div><b>Yuki Chen</b><small>yuki@novalabs.co</small></div><button aria-label="账户菜单">•••</button></div></div>
      </aside>
      {mobileNav && <button className="nav-backdrop" aria-label="关闭菜单" onClick={() => setMobileNav(false)} />}

      <main className="main">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileNav(true)} aria-label="打开菜单">☰</button>
          <div className="crumb"><span>Nova Labs</span><i>/</i><b>{titles[page][0]}</b></div>
          <div className="top-actions"><button className="icon-button" aria-label="搜索">⌕</button><button className="icon-button notification" aria-label="通知">♢<i /></button><button className="primary-button" onClick={() => notify("新的监控任务已准备创建")}><span>＋</span>新建监控</button></div>
        </header>

        <section className="content">
          <div className="page-heading"><div><h1>{titles[page][0]}</h1><p>{titles[page][1]}</p></div><div className="heading-actions"><select value={range} onChange={e => setRange(e.target.value)} aria-label="时间范围"><option>过去 7 天</option><option>过去 30 天</option><option>过去 90 天</option></select><select value={engine} onChange={e => setEngine(e.target.value)} aria-label="AI 平台"><option>全部平台</option><option>ChatGPT</option><option>Perplexity</option><option>Google AI</option><option>Gemini</option></select><button className="secondary-button" onClick={() => notify("报告数据已刷新")}>↻ 刷新</button></div></div>

          {page === "overview" && <Overview onOpenPrompts={() => changePage("prompts")} onOpenAudit={() => changePage("audit")} />}
          {page === "research" && <Research notify={notify} />}
          {page === "prompts" && <Prompts query={query} setQuery={setQuery} rows={filteredPrompts} onOpen={setDrawer} notify={notify} />}
          {page === "brands" && <Brands />}
          {page === "citations" && <Citations />}
          {page === "audit" && <Audit notify={notify} />}
          {page === "reports" && <Reports notify={notify} />}
        </section>
      </main>

      {drawer && <div className="drawer-wrap"><button className="drawer-backdrop" aria-label="关闭详情" onClick={() => setDrawer(null)} /><aside className="drawer"><div className="drawer-head"><span className="eyebrow">PROMPT 详情</span><button onClick={() => setDrawer(null)}>×</button></div><h2>{drawer.q}</h2><div className="drawer-tags"><span>{drawer.tag}</span><span>中文 · 中国</span></div><div className="drawer-metrics"><div><small>品牌覆盖率</small><b>{drawer.coverage}%</b></div><div><small>品牌提及</small><b>{drawer.mentions}</b></div><div><small>域名引用</small><b>{drawer.citations}</b></div></div><div className="tabs"><button className="active">概览</button><button>AI 回答</button><button>引用来源</button></div><div className="answer-card"><div className="answer-head"><span className="engine-logo dark">C</span><div><b>ChatGPT</b><small>今天 09:42 · 中国</small></div><span className="positive">已提及品牌</span></div><p>对于希望统一监测传统搜索与 AI 答案引擎表现的团队，<mark>Orbis</mark> 提供了较完整的品牌可见度、竞品提及和引用来源分析能力……</p><div className="source-line"><span>↗</span><div><b>orbis.ai/ai-search-intelligence</b><small>引用位置 #2 · 品牌官网</small></div></div></div><div className="recommendation"><span>✦</span><div><b>优化建议</b><p>该问题中品牌被提及，但推荐位置低于 Notion。建议增加面向跨境团队的行业案例与对比页。</p></div></div></aside></div>}
      {toast && <div className="toast"><span>✓</span>{toast}</div>}
    </div>
  );
}

function Overview({ onOpenPrompts, onOpenAudit }: { onOpenPrompts: () => void; onOpenAudit: () => void }) {
  return <>
    <div className="notice"><span>✦</span><div><b>本周 AI 可见度提升 8.2%</b><p>ChatGPT 与 Perplexity 中的品牌提及增长最明显，3 个高价值 Prompt 仍存在竞品覆盖缺口。</p></div><button onClick={onOpenAudit}>查看建议 →</button></div>
    <div className="metric-grid">{metrics.map((metric, index) => <article className={`metric-card ${metric.tone}`} key={metric.label}><div className="metric-top"><span>{metric.label}</span><button title={metric.hint}>i</button></div><div className="metric-value"><strong>{metric.value}</strong>{metric.suffix && <small>{metric.suffix}</small>}</div><div className="metric-foot"><span>↗ {metric.delta}</span><small>较上周期</small></div><Sparkline color={["#31b981", "#4d7cf3", "#7d6bf2", "#e2a640"][index]} /></article>)}</div>
    <div className="dashboard-grid">
      <article className="panel trend-panel"><div className="panel-head"><div><h3>品牌覆盖趋势</h3><p>被 AI 回答提及的 Prompt 比例</p></div><div className="legend"><span><i className="you" />Nova Labs</span><span><i className="comp" />行业均值</span></div></div><div className="chart-wrap"><div className="y-axis"><span>80%</span><span>60%</span><span>40%</span><span>20%</span><span>0%</span></div><div className="line-chart"><div className="grid-lines" /><svg viewBox="0 0 700 240" preserveAspectRatio="none" aria-label="品牌覆盖趋势图"><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5d6af5" stopOpacity=".22"/><stop offset="1" stopColor="#5d6af5" stopOpacity="0"/></linearGradient></defs><path d="M0 190 C55 176 75 178 118 158 S195 166 235 136 S315 145 360 112 S430 124 472 87 S545 101 580 62 S650 75 700 38 L700 240 L0 240Z" fill="url(#area)"/><path d="M0 190 C55 176 75 178 118 158 S195 166 235 136 S315 145 360 112 S430 124 472 87 S545 101 580 62 S650 75 700 38" fill="none" stroke="#5d6af5" strokeWidth="4" strokeLinecap="round"/><path d="M0 175 C80 168 115 179 175 160 S270 170 330 148 S425 158 480 132 S590 146 700 118" fill="none" stroke="#b7beca" strokeWidth="2" strokeDasharray="6 8"/></svg><div className="x-axis"><span>7月6日</span><span>7月12日</span><span>7月18日</span><span>7月24日</span><span>7月30日</span><span>8月4日</span></div></div></div></article>
      <article className="panel score-panel"><div className="panel-head"><div><h3>AI 平台覆盖</h3><p>各答案引擎中的品牌表现</p></div><button>•••</button></div><div className="engine-list">{engines.map(e => <div className="engine-row" key={e.name}><span className="engine-logo" style={{ background: e.color }}>{e.mark}</span><div className="engine-info"><div><b>{e.name}</b><span>{e.coverage}%</span></div><div className="progress"><i style={{ width: `${e.coverage}%`, background: e.color }} /></div></div><span className={e.change.startsWith("-") ? "down" : "up"}>{e.change}</span></div>)}</div></article>
    </div>
    <div className="dashboard-grid lower">
      <article className="panel competitor-panel"><div className="panel-head"><div><h3>竞品声量对比</h3><p>基于 206 次 AI 回答的品牌提及</p></div><button className="text-button">完整报告 →</button></div><div className="competitor-list">{[["Nova Labs", 24.6, "#5b67f1", "+3.1%"],["Notion", 22.8, "#202531", "+0.8%"],["Asana", 18.4, "#f16d76", "-1.4%"],["ClickUp", 14.2, "#9368ee", "+2.2%"],["Monday", 10.7, "#eeb642", "-0.6%"]].map(([name,value,color,delta], i) => <div className="competitor-row" key={String(name)}><span className="rank">{i+1}</span><span className="comp-dot" style={{ background: String(color) }}>{String(name).slice(0,1)}</span><b>{name}</b><div className="bar"><i style={{ width: `${Number(value) * 3.1}%`, background: String(color) }} /></div><strong>{value}%</strong><small className={String(delta).startsWith("-") ? "down" : "up"}>{delta}</small></div>)}</div></article>
      <article className="panel actions-panel"><div className="panel-head"><div><h3>优先行动</h3><p>按预期影响排序的 GEO 机会</p></div><button onClick={onOpenAudit} className="text-button">查看全部 →</button></div><div className="action-list"><div><span className="priority high">高</span><section><b>创建 3 个竞品对比页面</b><p>预计提升 12 个高意图 Prompt 的覆盖率</p></section><em>内容</em></div><div><span className="priority high">高</span><section><b>完善产品页 FAQ 结构</b><p>6 个页面缺少结构化问答内容</p></section><em>技术</em></div><div><span className="priority medium">中</span><section><b>布局 Reddit 行业讨论</b><p>竞品在社区引用中领先 38%</p></section><em>PR</em></div><div><span className="priority low">低</span><section><b>统一品牌实体描述</b><p>减少 AI 平台中的品类识别偏差</p></section><em>品牌</em></div></div></article>
    </div>
    <div className="panel prompt-preview"><div className="panel-head"><div><h3>需要关注的 Prompt</h3><p>竞品出现但品牌表现偏弱的问题</p></div><button onClick={onOpenPrompts} className="text-button">查看全部 48 个 →</button></div><PromptTable rows={promptRows.slice(2, 6)} onOpen={onOpenPrompts} /></div>
  </>;
}

function Research({ notify }: { notify: (s: string) => void }) {
  const [topic, setTopic] = useState("AI 搜索可见度监控");
  const suggestions = ["如何提升品牌在 ChatGPT 中的推荐率", "企业应该如何开始 GEO 优化", "最佳 AI 搜索监控工具有哪些", "AI 回答通常引用哪些内容来源", "传统 SEO 与 GEO 有什么区别", "出海品牌如何监测 Perplexity 曝光"];
  return <div className="research-layout"><section className="research-hero"><span className="eyebrow">AI-POWERED DISCOVERY</span><h2>找到客户真正会问 AI 的问题</h2><p>输入品牌、网站或核心主题，生成具有搜索意图和商业价值的 Prompt 组合。</p><div className="research-input"><span>✦</span><input value={topic} onChange={e => setTopic(e.target.value)} aria-label="研究主题"/><button onClick={() => notify(`已为「${topic}」生成 Prompt 建议`)}>开始研究</button></div><div className="research-options"><label>市场<select><option>中国大陆</option><option>美国</option><option>英国</option></select></label><label>语言<select><option>简体中文</option><option>English</option></select></label><label>生成数量<select><option>20 个</option><option>50 个</option></select></label></div></section><section className="panel suggestions"><div className="panel-head"><div><h3>推荐 Prompt</h3><p>基于主题、用户意图与行业语境生成</p></div><button className="secondary-button" onClick={() => notify("已选择全部推荐 Prompt")}>全部选择</button></div>{suggestions.map((s,i) => <div className="suggestion-row" key={s}><input type="checkbox" defaultChecked={i < 3} aria-label={`选择 ${s}`}/><div><b>{s}</b><span><em>{["问题解决","教育认知","商业调研","信息查找","教育认知","品牌监控"][i]}</em> · 预估意图量 {[380,260,720,190,440,150][i]}/月</span></div><strong>{[92,88,86,81,78,74][i]}</strong></div>)}<div className="bulk-bar"><span>已选择 3 个 Prompt</span><button onClick={() => notify("3 个 Prompt 已加入监控")}>加入监控 →</button></div></section></div>;
}

function Prompts({ query, setQuery, rows, onOpen, notify }: { query: string; setQuery: (s: string) => void; rows: typeof promptRows; onOpen: (r: typeof promptRows[number]) => void; notify: (s: string) => void }) {
  return <div className="panel table-panel"><div className="table-toolbar"><div className="search-box"><span>⌕</span><input placeholder="搜索 Prompt 或标签" value={query} onChange={e => setQuery(e.target.value)} /></div><button className="filter-button">☷ 筛选 <span>2</span></button><button className="filter-button">⚙ 列设置</button><div className="spacer"/><button className="secondary-button" onClick={() => notify("CSV 导出任务已创建")}>⇩ 导出</button><button className="primary-button" onClick={() => notify("Prompt 创建面板已准备打开")}>＋ 添加 Prompt</button></div><div className="active-filters"><span>地区：中国 ×</span><span>语言：中文 ×</span><button>清除全部</button></div><PromptTable rows={rows} onOpen={onOpen}/><div className="pagination"><span>显示 1–{rows.length}，共 48 个</span><div><button disabled>‹</button><button className="active">1</button><button>2</button><button>3</button><button>›</button></div></div></div>;
}

function PromptTable({ rows, onOpen }: { rows: typeof promptRows; onOpen: (row: typeof promptRows[number]) => void }) {
  return <div className="table-scroll"><table><thead><tr><th><input type="checkbox" aria-label="全选"/></th><th>Prompt</th><th>品牌覆盖率</th><th>情感</th><th>提及</th><th>引用</th><th>主要竞品</th><th>趋势</th><th /></tr></thead><tbody>{rows.map(row => <tr key={row.q} onClick={() => onOpen(row)}><td onClick={e => e.stopPropagation()}><input type="checkbox" aria-label={`选择 ${row.q}`}/></td><td><b className="prompt-name">{row.q}</b><span className="tag">{row.tag}</span></td><td><div className="coverage"><b>{row.coverage}%</b><i><em style={{ width: `${row.coverage}%` }}/></i></div></td><td><span className={`sentiment ${row.sentiment > 80 ? "good" : "neutral"}`}>{row.sentiment}</span></td><td>{row.mentions}</td><td>{row.citations}</td><td><span className="competitor-text">{row.competitor}</span></td><td><span className={`status ${row.status}`}>{row.status}</span></td><td>›</td></tr>)}</tbody></table></div>;
}

function Brands() {
  return <><div className="brand-score-layout"><article className="panel visibility-card"><div><span className="eyebrow">BRAND VISIBILITY INDEX</span><h3>Nova Labs</h3><p>在目标品类中处于 <b>挑战者</b> 象限，品牌覆盖正在快速增长。</p><div className="mini-stats"><span><small>行业排名</small><b>#3</b></span><span><small>较上月</small><b className="up">↑ 2</b></span></div></div><Donut value={67} color="#5968f2"/></article><article className="panel quadrant"><div className="panel-head"><div><h3>品牌竞争象限</h3><p>可见度 × 推荐情感</p></div></div><div className="quadrant-chart"><div className="q-label tl">高潜力</div><div className="q-label tr">领导者</div><div className="q-label bl">待观察</div><div className="q-label br">挑战者</div><span className="bubble notion" title="Notion">N</span><span className="bubble nova" title="Nova Labs">N</span><span className="bubble asana" title="Asana">A</span><span className="bubble clickup" title="ClickUp">C</span></div></article></div><div className="panel matrix-panel"><div className="panel-head"><div><h3>竞品指标矩阵</h3><p>跨平台品牌表现对比</p></div><button className="secondary-button">＋ 添加竞品</button></div><table><thead><tr><th>品牌</th><th>AI 可见度</th><th>Share of Voice</th><th>推荐情感</th><th>品牌提及</th><th>域名引用</th><th>30 天变化</th></tr></thead><tbody>{[["Nova Labs",67.4,24.6,86,88,126,"+8.2%"],["Notion",72.1,22.8,88,82,164,"+2.4%"],["Asana",58.6,18.4,82,69,103,"-1.2%"],["ClickUp",51.2,14.2,78,54,87,"+4.8%"],["Monday",46.8,10.7,75,41,72,"-0.8%"]].map((r,i)=><tr key={String(r[0])}><td><span className={`brand-badge b${i}`}>{String(r[0]).slice(0,1)}</span><b>{r[0]}</b>{i===0&&<small className="you-label">你</small>}</td><td><b>{r[1]}</b></td><td>{r[2]}%</td><td><span className="sentiment good">{r[3]}</span></td><td>{r[4]}</td><td>{r[5]}</td><td className={String(r[6]).startsWith("-")?"down":"up"}>{r[6]}</td></tr>)}</tbody></table></div></>;
}

function Citations() {
  return <><div className="citation-cards"><article className="panel citation-summary"><span className="eyebrow">引用结构</span><div className="citation-donut"><Donut value={34} color="#4f67ef"/><div><h3>371</h3><p>总引用次数</p></div></div><ul><li><i style={{background:"#4f67ef"}}/>自有官网 <b>34%</b></li><li><i style={{background:"#38b98a"}}/>第三方媒体 <b>29%</b></li><li><i style={{background:"#8a6fe8"}}/>测评与社区 <b>25%</b></li><li><i style={{background:"#e4a63e"}}/>竞品官网 <b>12%</b></li></ul></article><article className="panel source-opportunity"><div className="panel-head"><div><h3>引用机会</h3><p>AI 信任但品牌尚未覆盖的来源</p></div></div>{[["capterra.com","竞品出现 24 次","高机会"],["forbes.com","行业内容被引用 18 次","高机会"],["medium.com","主题内容被引用 15 次","中机会"]].map((r,i)=><div className="opportunity-row" key={r[0]}><span className={`site-icon s${i}`}>{r[0].slice(0,1).toUpperCase()}</span><div><b>{r[0]}</b><small>{r[1]}</small></div><em>{r[2]}</em><button>查看 →</button></div>)}</article></div><div className="panel table-panel"><div className="panel-head"><div><h3>主要引用来源</h3><p>跨 AI 平台被引用的域名与页面</p></div><button className="secondary-button">⇩ 导出数据</button></div><table><thead><tr><th>域名</th><th>来源类型</th><th>引用次数</th><th>覆盖 Prompt</th><th>30 天变化</th><th>权威度</th><th /></tr></thead><tbody>{citationRows.map(r=><tr key={r.domain}><td><span className="domain-icon">{r.domain.slice(0,1).toUpperCase()}</span><b>{r.domain}</b></td><td><span className="source-type">{r.type}</span></td><td><b>{r.citations}</b></td><td>{r.prompts}</td><td className={r.growth.startsWith("-")?"down":"up"}>{r.growth}</td><td><div className="authority"><i><em style={{width:`${r.authority}%`}}/></i><b>{r.authority}</b></div></td><td>›</td></tr>)}</tbody></table></div></>;
}

function Audit({ notify }: { notify: (s: string) => void }) {
  return <><section className="audit-hero"><div><span className="eyebrow">LAST AUDIT · 今天 08:30</span><h2>网站 GEO 就绪度 <strong>74</strong><small>/100</small></h2><p>基础表现良好，但在对比内容、结构化问答和第三方权威来源方面仍有增长空间。</p><button onClick={() => notify("新一轮 GEO Audit 已开始")}>↻ 重新运行 Audit</button></div><div className="audit-radar"><div className="radar-shape"/><span className="r1">技术可访问性 <b>88</b></span><span className="r2">内容完整度 <b>72</b></span><span className="r3">品牌实体 <b>76</b></span><span className="r4">第三方权威 <b>58</b></span><span className="r5">引用潜力 <b>79</b></span></div></section><div className="audit-stats">{[["通过检查","26","good"],["建议优化","9","warn"],["高优先级","4","danger"],["预估提升","+18 分","info"]].map(r=><div className="panel" key={r[0]}><span className={r[2]}>●</span><small>{r[0]}</small><b>{r[1]}</b></div>)}</div><div className="panel audit-list"><div className="panel-head"><div><h3>优化建议</h3><p>按照影响程度和实施成本排序</p></div><div className="segmented"><button className="active">全部 13</button><button>高优先级 4</button><button>已完成 2</button></div></div>{auditItems.map((item,i)=><div className="audit-item" key={item.title}><span className="audit-score">{item.score}</span><div className="audit-copy"><div><b>{item.title}</b><span>{item.category}</span></div><p>{item.detail}</p><div className="audit-meta"><span>影响 <b className={item.impact==="高"?"danger-text":"warn-text"}>{item.impact}</b></span><span>工作量 <b>{item.effort}</b></span><span>涉及页面 <b>{[3,6,0,8][i]}</b></span></div></div><button onClick={() => notify(`已打开「${item.title}」执行指南`)}>查看指南 →</button></div>)}</div></>;
}

function Reports({ notify }: { notify: (s: string) => void }) {
  const reports = [{title:"AI 搜索月度表现报告",type:"管理层摘要",date:"2026年8月1日",status:"已生成"},{title:"Nova Labs 竞品可见度分析",type:"品牌报告",date:"2026年7月28日",status:"已生成"},{title:"第三季度 GEO 优化路线图",type:"策略报告",date:"2026年7月22日",status:"草稿"}];
  return <><section className="report-hero"><div><span className="eyebrow">REPORT BUILDER</span><h2>把 AI 可见度数据变成清晰的决策</h2><p>快速生成适合团队周会、客户汇报和管理层审阅的专业报告。</p></div><button onClick={() => notify("报告创建器将在下一期接入真实数据")}>＋ 创建报告</button></section><div className="template-grid">{[["周度可见度简报","核心指标、变化与异常提醒","每周"],["竞品对比报告","声量、覆盖率与机会差距","按需"],["GEO Audit 报告","网站问题与执行优先级","每月"]].map((r,i)=><article className="panel template" key={r[0]}><span className={`template-icon t${i}`}>{["↗","◫","✓"][i]}</span><div><h3>{r[0]}</h3><p>{r[1]}</p><small>{r[2]} · 8–12 页</small></div><button onClick={() => notify(`已选择「${r[0]}」模板`)}>使用模板 →</button></article>)}</div><div className="panel reports-list"><div className="panel-head"><div><h3>最近报告</h3><p>已创建与计划中的报告</p></div></div>{reports.map(r=><div className="report-row" key={r.title}><span className="file-icon">▤</span><div><b>{r.title}</b><small>{r.type} · {r.date}</small></div><span className={r.status==="草稿"?"draft":"generated"}>{r.status}</span><button onClick={()=>notify(`正在打开「${r.title}」`)}>打开</button><button>•••</button></div>)}</div></>;
}
