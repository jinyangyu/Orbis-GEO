"use client";

import { useEffect, useMemo, useState } from "react";

export const ONBOARDING_STORAGE_KEY = "orbis_onboarding_v1";

export type ProfileData = {
  firstName: string;
  lastName: string;
  role: "brand" | "agency";
  source: string;
};

export type BrandData = {
  website: string;
  name: string;
  market: string;
  language: string;
};

export type PromptItem = { id: number; text: string; selected: boolean };
export type CompetitorItem = { id: number; name: string; domain: string; mark: string; color: string };
export type ProcessingStage = "checking" | "querying" | "analyzing" | "building";
type Screen = "profile" | "brand" | "promptLoading" | "prompts" | "competitorLoading" | "competitors" | "processing" | "tourIntro" | "tour" | "ready";

export type OnboardingState = {
  version: 1;
  screen: Screen;
  profile: ProfileData;
  brand: BrandData;
  prompts: PromptItem[];
  competitors: CompetitorItem[];
  processingIndex: number;
  tourIndex: number;
  completedAt: string | null;
};

const defaultPrompts: PromptItem[] = [
  "适合成长型科技团队的最佳项目管理工具有哪些？",
  "中小企业应该如何选择团队协作软件？",
  "2026 年值得关注的 AI 营销自动化平台有哪些？",
  "哪些工具可以统一管理内容、任务和客户反馈？",
  "适合跨境电商团队的协作平台有哪些？",
  "如何比较 Notion、Asana 与新一代项目管理工具？",
  "远程团队最需要哪些项目协作功能？",
  "如何减少团队在多个 SaaS 工具之间切换？",
  "面向中国出海品牌的团队效率工具推荐",
  "哪些项目管理工具内置了 AI 工作流？",
  "初创公司应该选择轻量还是专业项目管理软件？",
  "如何追踪营销项目的执行进度和内容产出？",
  "哪些协作工具更适合中文和英文双语团队？",
  "企业如何评估团队协作平台的投入回报？",
  "Nova Labs 与传统 SEO 工具有什么区别？",
].map((text, index) => ({ id: index + 1, text, selected: true }));

const defaultCompetitors: CompetitorItem[] = [
  { id: 1, name: "Notion", domain: "notion.so", mark: "N", color: "#151b24" },
  { id: 2, name: "Asana", domain: "asana.com", mark: "A", color: "#f06d76" },
  { id: 3, name: "ClickUp", domain: "clickup.com", mark: "C", color: "#7656e8" },
  { id: 4, name: "Monday", domain: "monday.com", mark: "M", color: "#e3a936" },
  { id: 5, name: "Semrush", domain: "semrush.com", mark: "S", color: "#ff6d36" },
  { id: 6, name: "Otterly AI", domain: "otterly.ai", mark: "O", color: "#198f89" },
];

const initialState: OnboardingState = {
  version: 1,
  screen: "profile",
  profile: { firstName: "Yuki", lastName: "Chen", role: "brand", source: "ChatGPT" },
  brand: { website: "novalabs.co", name: "Nova Labs", market: "中国大陆", language: "简体中文" },
  prompts: defaultPrompts,
  competitors: defaultCompetitors,
  processingIndex: 0,
  tourIndex: 0,
  completedAt: null,
};

const processingStages: { key: ProcessingStage; title: string; copy: string; meta: string }[] = [
  { key: "checking", title: "正在检查监测配置", copy: "正在确认品牌、市场、Prompt 与竞争组是否完整。", meta: "验证 15 个 Prompt · 6 个竞争品牌" },
  { key: "querying", title: "正在向主流 AI 引擎发起真实查询", copy: "模拟查询 ChatGPT、Perplexity、Google AI、Gemini 与 Copilot。", meta: "5 个 AI 平台 · 75 次查询" },
  { key: "analyzing", title: "正在解析品牌提及、推荐位置与引用来源", copy: "把原始回答整理成可以比较和持续追踪的指标。", meta: "提取实体 · 情感 · 排名 · 引用" },
  { key: "building", title: "正在生成你的首份 GEO 报告", copy: "品牌覆盖、竞争声量和内容机会正在汇入同一份报告。", meta: "预计还需几秒" },
];

const tourSteps = [
  { eyebrow: "01 · 平台筛选", title: "看清品牌在哪个 AI 平台更有优势", copy: "按 ChatGPT、Perplexity、Google AI、Gemini 或 Copilot 单独查看表现，避免平均值掩盖真实差异。", focus: "filters" },
  { eyebrow: "02 · 覆盖趋势", title: "持续追踪品牌是否正在被更多回答采用", copy: "覆盖趋势显示目标 Prompt 中出现品牌的比例，并与行业平均水平进行对比。", focus: "trend" },
  { eyebrow: "03 · 竞争排名", title: "知道谁正在赢得 AI 的推荐", copy: "排名结合提及次数、Share of Voice 与覆盖率，帮助你发现真正的 AI 搜索竞争者。", focus: "ranking" },
  { eyebrow: "04 · 引用与建议", title: "把监测结果转化为下一步行动", copy: "查看 AI 信任的网页与媒体来源，再按照影响与投入获得清晰的 GEO 优化优先级。", focus: "actions" },
];

function isValidStored(value: unknown): value is OnboardingState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<OnboardingState>;
  return state.version === 1 && typeof state.screen === "string" && !!state.profile && !!state.brand && Array.isArray(state.prompts) && Array.isArray(state.competitors);
}

export function hasCompletedOnboarding() {
  try {
    const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return false;
    const state = JSON.parse(raw);
    return isValidStored(state) && Boolean(state.completedAt);
  } catch {
    return false;
  }
}

export function resetOnboardingStorage() {
  window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
}

function readInitialState(): OnboardingState {
  try {
    const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return initialState;
    const saved = JSON.parse(raw);
    return isValidStored(saved) ? saved : initialState;
  } catch {
    return initialState;
  }
}

export default function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [state, setState] = useState<OnboardingState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setState(readInitialState());
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  useEffect(() => {
    if (!hydrated || (state.screen !== "promptLoading" && state.screen !== "competitorLoading")) return;
    const timer = window.setTimeout(() => {
      setState(current => ({ ...current, screen: current.screen === "promptLoading" ? "prompts" : "competitors" }));
    }, 1250);
    return () => window.clearTimeout(timer);
  }, [hydrated, state.screen]);

  useEffect(() => {
    if (!hydrated || state.screen !== "processing") return;
    const timer = window.setTimeout(() => {
      setState(current => current.processingIndex < processingStages.length - 1
        ? { ...current, processingIndex: current.processingIndex + 1 }
        : { ...current, screen: "tourIntro" });
    }, 1450);
    return () => window.clearTimeout(timer);
  }, [hydrated, state.screen, state.processingIndex]);

  const step = state.screen === "profile" ? 1 : state.screen === "brand" || state.screen === "promptLoading" ? 2 : state.screen === "prompts" || state.screen === "competitorLoading" ? 3 : 4;
  const selectedCount = useMemo(() => state.prompts.filter(item => item.selected).length, [state.prompts]);

  const patch = (changes: Partial<OnboardingState>) => setState(current => ({ ...current, ...changes }));
  const updateProfile = (changes: Partial<ProfileData>) => patch({ profile: { ...state.profile, ...changes } });
  const updateBrand = (changes: Partial<BrandData>) => patch({ brand: { ...state.brand, ...changes } });

  const nextFromProfile = () => {
    if (!state.profile.firstName.trim() || !state.profile.lastName.trim()) return setError("请填写你的姓名后继续。 ");
    setError(""); patch({ screen: "brand" });
  };
  const nextFromBrand = () => {
    const domainPattern = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/.*)?$/i;
    if (!state.brand.name.trim() || !domainPattern.test(state.brand.website.trim())) return setError("请填写品牌名称和有效的网站域名。 ");
    setError(""); patch({ screen: "promptLoading" });
  };
  const nextFromPrompts = () => {
    if (selectedCount < 5) return setError("请至少选择 5 个 Prompt，以形成有效的趋势报告。 ");
    setError(""); patch({ screen: "competitorLoading" });
  };
  const startProcessing = () => {
    if (state.competitors.length < 1) return setError("请至少保留 1 个竞争品牌。 ");
    setError(""); patch({ screen: "processing", processingIndex: 0 });
  };
  const finish = () => {
    const next = { ...state, completedAt: new Date().toISOString() };
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(next));
    setState(next);
    onComplete();
  };

  if (!hydrated) return <div className="onboarding-boot"><BrandLockup /><div className="boot-line" /></div>;

  if (["processing", "tourIntro", "tour", "ready"].includes(state.screen)) {
    return <ReportExperience state={state} setState={setState} onComplete={finish} />;
  }

  const loading = state.screen === "promptLoading" || state.screen === "competitorLoading";

  return <main className="onboarding-shell">
    <section className="onboarding-form-pane">
      <header className="onboarding-head"><BrandLockup /><StepDots step={step} /></header>
      <div className={`onboarding-form ${state.screen === "prompts" || state.screen === "competitors" ? "wide-form" : ""}`}>
        {state.screen === "profile" && <>
          <div className="onboarding-title"><span>开始设置</span><h1>先认识一下你</h1><p>我们会根据你的角色调整工作区与报告方式。</p></div>
          <div className="field-row"><label>名字<input value={state.profile.firstName} onChange={e => updateProfile({ firstName: e.target.value })} /></label><label>姓氏<input value={state.profile.lastName} onChange={e => updateProfile({ lastName: e.target.value })} /></label></div>
          <fieldset className="choice-field"><legend>哪一种描述更符合你？</legend><button className={state.profile.role === "brand" ? "selected" : ""} onClick={() => updateProfile({ role: "brand" })}><i /><span><b>品牌团队</b><small>我负责一个品牌及其增长表现</small></span><em>推荐</em></button><button className={state.profile.role === "agency" ? "selected" : ""} onClick={() => updateProfile({ role: "agency" })}><i /><span><b>代理商</b><small>我管理多个客户或品牌</small></span></button></fieldset>
          <label className="full-field">你是如何了解到 Orbis 的？<select value={state.profile.source} onChange={e => updateProfile({ source: e.target.value })}><option>ChatGPT</option><option>朋友推荐</option><option>搜索引擎</option><option>社交媒体</option><option>行业活动</option></select></label>
          <FormFooter error={error} onNext={nextFromProfile} nextLabel="继续设置品牌" />
        </>}

        {state.screen === "brand" && <>
          <div className="onboarding-title"><span>品牌与市场</span><h1>设置第一个监测品牌</h1><p>告诉我们品牌与目标市场，Orbis 会据此生成监测问题。</p></div>
          <label className="full-field">品牌网站<input value={state.brand.website} onChange={e => { const website = e.target.value; updateBrand({ website, ...(website.includes("nova") ? { name: "Nova Labs" } : {}) }); }} placeholder="example.com" /><small>输入域名即可，我们会自动识别品牌基础信息。</small></label>
          <label className="full-field">品牌名称<div className="brand-input"><input value={state.brand.name} onChange={e => updateBrand({ name: e.target.value })} /><span>{state.brand.name.slice(0, 1) || "N"}</span></div></label>
          <div className="field-row"><label>目标市场<select value={state.brand.market} onChange={e => updateBrand({ market: e.target.value })}><option>中国大陆</option><option>美国</option><option>英国</option><option>新加坡</option></select></label><label>AI 查询语言<select value={state.brand.language} onChange={e => updateBrand({ language: e.target.value })}><option>简体中文</option><option>English</option><option>繁體中文</option></select></label></div>
          <FormFooter error={error} onBack={() => patch({ screen: "profile" })} onNext={nextFromBrand} nextLabel="生成监测问题" />
        </>}

        {loading && <LoadingStep type={state.screen} brand={state.brand.name} />}

        {state.screen === "prompts" && <>
          <div className="onboarding-title list-title"><span>监测范围</span><h1>审核要持续监测的问题</h1><p>建议保留至少 15 个，以获得更稳定的趋势判断。当前已选择 <b>{selectedCount}</b> 个。</p></div>
          <div className="editable-list prompt-edit-list">{state.prompts.map((item, index) => <div className="editable-row" key={item.id}><input className="row-check" type="checkbox" checked={item.selected} onChange={() => patch({ prompts: state.prompts.map(prompt => prompt.id === item.id ? { ...prompt, selected: !prompt.selected } : prompt) })} aria-label={`选择 ${item.text}`} /><span className="row-number">{String(index + 1).padStart(2, "0")}</span><input className="row-input" value={item.text} onChange={e => patch({ prompts: state.prompts.map(prompt => prompt.id === item.id ? { ...prompt, text: e.target.value } : prompt) })} /><button className="row-delete" onClick={() => patch({ prompts: state.prompts.filter(prompt => prompt.id !== item.id) })} aria-label="删除 Prompt">×</button></div>)}</div>
          <button className="add-row" onClick={() => patch({ prompts: [...state.prompts, { id: Date.now(), text: "新的监测问题", selected: true }] })}>＋ 添加 Prompt</button>
          <FormFooter error={error} onBack={() => patch({ screen: "brand" })} onNext={nextFromPrompts} nextLabel="识别竞争品牌" />
        </>}

        {state.screen === "competitors" && <>
          <div className="onboarding-title list-title"><span>竞争格局</span><h1>确认品牌竞争组</h1><p>我们从 AI 推荐语境中发现了这些品牌。你可以修改、删除或补充。</p></div>
          <div className="editable-list competitor-edit-list">{state.competitors.map(item => <div className="editable-row competitor-row-edit" key={item.id}><span className="competitor-mark" style={{ background: item.color }}>{item.mark}</span><input className="row-input" value={item.name} onChange={e => patch({ competitors: state.competitors.map(c => c.id === item.id ? { ...c, name: e.target.value, mark: e.target.value.slice(0, 1).toUpperCase() || "?" } : c) })} /><input className="row-input domain-input" value={item.domain} onChange={e => patch({ competitors: state.competitors.map(c => c.id === item.id ? { ...c, domain: e.target.value } : c) })} /><button className="row-delete" onClick={() => patch({ competitors: state.competitors.filter(c => c.id !== item.id) })} aria-label="删除竞争品牌">×</button></div>)}</div>
          <button className="add-row" onClick={() => patch({ competitors: [...state.competitors, { id: Date.now(), name: "新竞争品牌", domain: "example.com", mark: "新", color: "#5366ea" }] })}>＋ 添加竞争品牌</button>
          <FormFooter error={error} onBack={() => patch({ screen: "prompts" })} onNext={startProcessing} nextLabel="开始首次监测" />
        </>}
      </div>
    </section>
    <OnboardingPreview screen={state.screen} state={state} />
  </main>;
}

function BrandLockup() {
  return <div className="onboarding-brand"><div className="brand-orbit"><i /></div><div><strong>ORBIS</strong><span>AI SEARCH INTELLIGENCE</span></div></div>;
}

function StepDots({ step }: { step: number }) {
  return <div className="step-dots" aria-label={`第 ${step} 步，共 4 步`}>{[1, 2, 3, 4].map(item => <i key={item} className={item <= step ? "active" : ""} />)}<span>{step}/4</span></div>;
}

function FormFooter({ error, onBack, onNext, nextLabel }: { error: string; onBack?: () => void; onNext: () => void; nextLabel: string }) {
  return <div className="form-footer">{error && <p role="alert">{error}</p>}<div>{onBack && <button className="onboarding-back" onClick={onBack}>← 返回</button>}<button className="onboarding-next" onClick={onNext}>{nextLabel} →</button></div></div>;
}

function LoadingStep({ type, brand }: { type: "promptLoading" | "competitorLoading"; brand: string }) {
  const prompt = type === "promptLoading";
  return <div className="inline-loading" role="status"><div className="loading-flask">✦</div><span>{prompt ? "AI Prompt Discovery" : "Competitive Discovery"}</span><h1>{prompt ? "正在寻找客户会问 AI 的问题" : "正在识别与你真正竞争的品牌"}</h1><p>{prompt ? `我们正在结合 ${brand}、目标市场与用户意图，生成一组高价值 Prompt。` : "我们从 AI 推荐语境中发现竞争者，而不仅仅参考传统搜索结果。"}</p><div className="loading-bar"><i /></div><small>{prompt ? "分析网站主题 · 拆解搜索意图 · 生成问题" : "识别品牌实体 · 匹配域名 · 建立竞争组"}</small></div>;
}

function OnboardingPreview({ screen, state }: { screen: Screen; state: OnboardingState }) {
  const competitorMode = screen === "competitors" || screen === "competitorLoading";
  const promptMode = screen === "prompts" || screen === "promptLoading";
  return <aside className="onboarding-preview" aria-hidden="true"><div className="dot-field" /><div className="preview-glow" /><div className="preview-card preview-brand"><span>{state.brand.name.slice(0, 1) || "N"}</span><div><b>{state.brand.name}</b><small>{state.brand.website}</small></div></div><div className="orbit-network"><i /><i /><i /><i /><span>✦</span></div>{promptMode && <div className="preview-card preview-prompts"><em>AI PROMPTS</em>{state.prompts.slice(0, 3).map((p, i) => <p key={p.id}><span>{String(i + 1).padStart(2, "0")}</span>{p.text}</p>)}</div>}{competitorMode && <div className="preview-card preview-ranking"><header><b>竞争品牌预览</b><span>声量</span></header>{state.competitors.slice(0, 5).map((c, i) => <div key={c.id}><small>{i + 1}</small><i style={{ background: c.color }}>{c.mark}</i><b>{c.name}</b><span>{[24, 21, 18, 15, 11][i]}%</span></div>)}</div>}{!promptMode && !competitorMode && <div className="preview-card profile-preview"><em>WORKSPACE PROFILE</em><div><span>{state.profile.firstName.slice(0, 1)}{state.profile.lastName.slice(0, 1)}</span><section><b>{state.profile.firstName} {state.profile.lastName}</b><small>{state.profile.role === "brand" ? "品牌团队" : "代理商工作区"}</small></section></div><hr /><i /><i /><i /></div>}</aside>;
}

function ReportExperience({ state, setState, onComplete }: { state: OnboardingState; setState: React.Dispatch<React.SetStateAction<OnboardingState>>; onComplete: () => void }) {
  if (state.screen === "processing") {
    const stage = processingStages[state.processingIndex];
    const progress = ((state.processingIndex + 1) / processingStages.length) * 100;
    return <main className="report-processing"><MockReport /><div className="processing-scrim" /><section className="processing-modal" role="status"><div className={`processing-orb stage-${stage.key}`}><i /><i /><i /></div><span>{String(state.processingIndex + 1).padStart(2, "0")} / 04</span><h1>{stage.title}</h1><p>{stage.copy}</p><div className="processing-progress"><i style={{ width: `${progress}%` }} /></div><small>{stage.meta}</small></section></main>;
  }

  if (state.screen === "tourIntro") return <main className="report-processing"><MockReport /><div className="processing-scrim" /><section className="processing-modal tour-intro"><div className="ready-symbol">✓</div><span>REPORT PREVIEW</span><h1>报告生成期间，先用 60 秒了解核心指标</h1><p>我们准备了一份可交互的示例报告，真实数据会继续在后台完成。</p><div className="modal-actions"><button className="ghost-action" onClick={() => setState(current => ({ ...current, screen: "ready" }))}>跳过导览</button><button className="main-action" onClick={() => setState(current => ({ ...current, screen: "tour", tourIndex: 0 }))}>开始导览 →</button></div></section></main>;

  if (state.screen === "tour") {
    const tour = tourSteps[state.tourIndex];
    return <main className="tour-shell"><MockReport focus={tour.focus} /><div className={`tour-tip tip-${tour.focus}`}><span>{tour.eyebrow}</span><h2>{tour.title}</h2><p>{tour.copy}</p><footer><button onClick={() => setState(current => ({ ...current, screen: "ready" }))}>跳过</button><em>{state.tourIndex + 1} / {tourSteps.length}</em><button className="main-action" onClick={() => setState(current => current.tourIndex < tourSteps.length - 1 ? { ...current, tourIndex: current.tourIndex + 1 } : { ...current, screen: "ready" })}>{state.tourIndex === tourSteps.length - 1 ? "完成" : "下一步"} →</button></footer></div></main>;
  }

  return <main className="report-processing"><MockReport /><div className="processing-scrim" /><section className="processing-modal complete-modal"><div className="ready-symbol">✓</div><span>FIRST REPORT READY</span><h1>你的首份品牌报告已准备好</h1><p>已完成 75 次 AI 查询，并发现 9 个优先优化机会。</p><div className="completion-stats"><div><b>67.4</b><small>AI 可见度</small></div><div><b>42.8%</b><small>品牌覆盖率</small></div><div><b>126</b><small>官网引用</small></div></div><button className="main-action full-action" onClick={onComplete}>进入品牌报告 →</button></section></main>;
}

function MockReport({ focus = "" }: { focus?: string }) {
  const ranks = [["Nova Labs", "24.6%"], ["Notion", "22.8%"], ["Asana", "18.4%"], ["ClickUp", "14.2%"]];
  return <div className="mock-report"><aside><BrandLockup /><i /><i /><i /><i /><i /></aside><main><header><div><small>Nova Labs / 品牌报告</small><h2>AI 搜索可见度总览</h2></div><button>＋ 新建监控</button></header><div className={`mock-filters ${focus === "filters" ? "tour-focus" : ""}`}><span>过去 30 天⌄</span><span>全部平台⌄</span><span>中国大陆⌄</span></div><section className="mock-metrics"><div><small>AI 可见度</small><b>67.4</b><em>+8.2%</em></div><div><small>品牌覆盖率</small><b>42.8%</b><em>+5.6%</em></div><div><small>Share of Voice</small><b>24.6%</b><em>+3.1%</em></div></section><section className="mock-grid"><article className={focus === "trend" ? "tour-focus" : ""}><h3>品牌覆盖趋势</h3><div className="mock-chart"><i /><i /><i /><svg viewBox="0 0 500 160" preserveAspectRatio="none"><path d="M0 135 C70 120 82 125 135 91 S220 112 275 67 S360 88 405 42 S462 56 500 25" fill="none" stroke="#5968ee" strokeWidth="4" /></svg></div></article><article className={focus === "ranking" ? "tour-focus" : ""}><h3>竞争品牌排名</h3>{ranks.map((rank, i) => <div className="mock-rank" key={rank[0]}><span>{i + 1}</span><b>{rank[0]}</b><em>{rank[1]}</em></div>)}</article></section><section className={`mock-actions ${focus === "actions" ? "tour-focus" : ""}`}><h3>优先行动</h3><div><b>创建 3 个竞品对比页面</b><span>预计提升 12 个高意图 Prompt</span><em>高影响</em></div><div><b>完善产品页 FAQ 结构</b><span>6 个页面缺少结构化问答</span><em>高影响</em></div></section></main></div>;
}
