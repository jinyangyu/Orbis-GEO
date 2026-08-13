"use client";

import { useEffect, useMemo, useState } from "react";
import type { WorkspacePayload } from "@/lib/onboarding/types";
import {
  appendMonitoringPrompts,
  fetchLatestPromptResearch,
  startPromptResearch,
} from "@/lib/prompt-research/client";
import type {
  PromptResearchMode,
  ResearchPromptItem,
} from "@/lib/prompt-research/types";

const LANGUAGES = ["简体中文", "English", "繁體中文"] as const;
const COUNTRIES = ["中国大陆", "美国", "英国", "新加坡"] as const;

const MODES: Array<{
  id: PromptResearchMode;
  title: string;
}> = [
  {
    id: "keywords",
    title: "我已有 SEO 关键词，希望转换成 Search Prompts",
  },
  {
    id: "url",
    title: "我有一个具体 URL，想发现可能驱动流量的 Prompts",
  },
  {
    id: "brand",
    title: "我想基于品牌头脑风暴新的 Search Prompts",
  },
];

function Tip({ text }: { text: string }) {
  return (
    <span className="pr-tip" title={text} aria-label={text}>
      ?
    </span>
  );
}

function keywordCount(text: string): number {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean).length;
}

export function PromptResearch({
  workspace,
  workspaceId,
  notify,
  onPromoted,
}: {
  workspace: WorkspacePayload | null;
  workspaceId: string | null;
  notify: (s: string) => void;
  onPromoted?: () => void;
}) {
  const brand = workspace?.brand;
  const [phase, setPhase] = useState<"form" | "processing" | "results" | "error">(
    "form",
  );
  const [mode, setMode] = useState<PromptResearchMode>("keywords");
  const [keywordsText, setKeywordsText] = useState("");
  const [url, setUrl] = useState("");
  const [brandName, setBrandName] = useState(brand?.name ?? "");
  const [brandDomain, setBrandDomain] = useState(brand?.website ?? "");
  const [brandIndustry, setBrandIndustry] = useState("");
  const [language, setLanguage] = useState(brand?.language || "简体中文");
  const [country, setCountry] = useState(brand?.market || "中国大陆");
  const [error, setError] = useState("");
  const [items, setItems] = useState<ResearchPromptItem[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [jobId, setJobId] = useState<string | null>(null);
  const [promoting, setPromoting] = useState(false);

  useEffect(() => {
    if (brand?.name) setBrandName((v) => v || brand.name);
    if (brand?.website) setBrandDomain((v) => v || brand.website);
    if (brand?.language) setLanguage(brand.language);
    if (brand?.market) setCountry(brand.market);
  }, [brand?.name, brand?.website, brand?.language, brand?.market]);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    void fetchLatestPromptResearch(workspaceId)
      .then((job) => {
        if (cancelled || !job || job.status !== "succeeded" || !job.result) return;
        setJobId(job.id);
        setMode(job.mode);
        setItems(job.result.prompts);
        const sel: Record<number, boolean> = {};
        job.result.prompts.forEach((_, i) => {
          sel[i] = i < 8;
        });
        setSelected(sel);
        setPhase("results");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const kwCount = useMemo(() => keywordCount(keywordsText), [keywordsText]);

  const processingCopy =
    mode === "keywords"
      ? "正在处理你的关键词研究…"
      : mode === "url"
        ? "正在分析 URL 并生成 Prompts…"
        : "正在基于品牌头脑风暴 Prompts…";

  const resetForm = () => {
    setPhase("form");
    setError("");
    setItems([]);
    setSelected({});
    setJobId(null);
  };

  const start = async () => {
    setError("");
    if (mode === "keywords" && kwCount === 0) {
      setError("请至少输入 1 个关键词（一行一个，最多 20 个）");
      return;
    }
    if (mode === "keywords" && kwCount > 20) {
      setError("关键词最多 20 个");
      return;
    }
    if (mode === "url" && !url.trim()) {
      setError("请输入 URL");
      return;
    }
    if (mode === "brand" && !brandName.trim()) {
      setError("请输入品牌名称");
      return;
    }

    setPhase("processing");
    try {
      const job = await startPromptResearch({
        mode,
        workspaceId: workspaceId ?? undefined,
        language,
        country,
        keywords:
          mode === "keywords"
            ? keywordsText
                .split(/\r?\n/)
                .map((l) => l.trim())
                .filter(Boolean)
                .slice(0, 20)
            : undefined,
        url: mode === "url" ? url.trim() : undefined,
        brandName: mode === "brand" ? brandName.trim() : undefined,
        brandDomain: mode === "brand" ? brandDomain.trim() : undefined,
        brandIndustry: mode === "brand" ? brandIndustry.trim() : undefined,
      });
      setJobId(job.id);
      if (job.status === "failed") {
        setError(job.error || "生成失败");
        setPhase("error");
        return;
      }
      const prompts = job.result?.prompts ?? [];
      setItems(prompts);
      const sel: Record<number, boolean> = {};
      prompts.forEach((_, i) => {
        sel[i] = i < 8;
      });
      setSelected(sel);
      setPhase("results");
    } catch (e) {
      setError(e instanceof Error ? e.message : "研究失败");
      setPhase("error");
    }
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  const toggleAll = (on: boolean) => {
    const next: Record<number, boolean> = {};
    items.forEach((_, i) => {
      next[i] = on;
    });
    setSelected(next);
  };

  const promote = async () => {
    const texts = items.filter((_, i) => selected[i]).map((p) => p.text);
    if (!texts.length) {
      notify("请先勾选要加入监测的 Prompt");
      return;
    }
    setPromoting(true);
    try {
      const intentByText: Record<string, string> = {};
      items.forEach((p, i) => {
        if (selected[i]) intentByText[p.text] = String(p.intentScore);
      });
      const res = await appendMonitoringPrompts({
        workspaceId: workspaceId ?? undefined,
        texts,
        market: country,
        intentByText,
      });
      notify(
        `已加入监测：新增 ${res.added} 条${res.skipped ? `，跳过重复 ${res.skipped} 条` : ""}`,
      );
      onPromoted?.();
    } catch (e) {
      notify(e instanceof Error ? e.message : "加入监测失败");
    } finally {
      setPromoting(false);
    }
  };

  if (phase === "processing") {
    return (
      <div className="pr-shell">
        <h2 className="pr-title">Prompt 研究</h2>
        <div className="pr-processing" role="status">
          <div className="pr-dots" aria-hidden>
            <i />
            <i />
            <i />
            <i />
          </div>
          <b>{processingCopy}</b>
          <p>这可能需要一段时间</p>
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="pr-shell">
        <h2 className="pr-title">Prompt 研究</h2>
        <div className="pr-processing">
          <b>研究失败</b>
          <p>{error || "请重试"}</p>
          <div className="pr-actions" style={{ justifyContent: "center" }}>
            <button type="button" className="pr-primary" onClick={start}>
              重试
            </button>
            <button type="button" className="pr-cancel" onClick={resetForm}>
              返回
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "results") {
    return (
      <div className="pr-shell">
        <div className="pr-results-head">
          <div>
            <h2 className="pr-title">Prompt 研究</h2>
            <p className="pr-sub">
              共 {items.length} 条建议
              {jobId ? ` · 任务 ${jobId.slice(0, 8)}` : ""}
            </p>
          </div>
          <div className="pr-actions">
            <button type="button" className="pr-cancel" onClick={resetForm}>
              重新研究
            </button>
            <button
              type="button"
              className="pr-primary"
              disabled={promoting || selectedCount === 0}
              onClick={() => void promote()}
            >
              {promoting ? "加入中…" : `加入监测（${selectedCount}）`}
            </button>
          </div>
        </div>
        <div className="pr-results-toolbar">
          <button type="button" className="text-button" onClick={() => toggleAll(true)}>
            全选
          </button>
          <button type="button" className="text-button" onClick={() => toggleAll(false)}>
            清空
          </button>
        </div>
        <section className="panel pr-results">
          {items.map((item, i) => (
            <label className="pr-result-row" key={`${i}-${item.text}`}>
              <input
                type="checkbox"
                checked={!!selected[i]}
                onChange={(e) =>
                  setSelected((s) => ({ ...s, [i]: e.target.checked }))
                }
              />
              <div className="pr-result-main">
                <b>{item.text}</b>
                <span>
                  {[item.intent, item.funnel].filter(Boolean).join(" · ")}
                </span>
              </div>
              <strong className="pr-score">{item.intentScore}</strong>
            </label>
          ))}
        </section>
      </div>
    );
  }

  return (
    <div className="pr-shell">
      <h2 className="pr-title">Prompt 研究</h2>
      <p className="pr-lead">你想如何开始？</p>

      <div className="pr-modes">
        {MODES.map((m) => {
          const open = mode === m.id;
          return (
            <div className={`pr-mode${open ? " open" : ""}`} key={m.id}>
              <label className="pr-mode-head">
                <input
                  type="radio"
                  name="pr-mode"
                  checked={open}
                  onChange={() => setMode(m.id)}
                />
                <span>{m.title}</span>
              </label>

              {open && m.id === "keywords" && (
                <div className="pr-fields">
                  <label className="pr-field">
                    <span>
                      SEO 关键词 <Tip text="一行一个，最多 20 个" />
                    </span>
                    <textarea
                      rows={5}
                      placeholder="粘贴你正在投放的 SEO 关键词"
                      value={keywordsText}
                      onChange={(e) => setKeywordsText(e.target.value)}
                    />
                    <em>最多 20 个关键词，一行一个（{kwCount}/20）</em>
                  </label>
                  <div className="pr-field-row">
                    <label className="pr-field">
                      <span>
                        语言 <Tip text="生成 Prompt 的语言" />
                      </span>
                      <select
                        className="orbis-select"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                      >
                        {LANGUAGES.map((l) => (
                          <option key={l}>{l}</option>
                        ))}
                      </select>
                    </label>
                    <label className="pr-field">
                      <span>
                        市场 <Tip text="目标市场/国家" />
                      </span>
                      <select
                        className="orbis-select"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                      >
                        {COUNTRIES.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              )}

              {open && m.id === "url" && (
                <div className="pr-fields">
                  <label className="pr-field">
                    <span>
                      URL <Tip text="将分析页面主题以生成相关问题" />
                    </span>
                    <input
                      type="url"
                      placeholder="输入需要挖掘 Search Prompts 的 URL"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                    />
                  </label>
                  <div className="pr-field-row">
                    <label className="pr-field">
                      <span>语言</span>
                      <select
                        className="orbis-select"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                      >
                        {LANGUAGES.map((l) => (
                          <option key={l}>{l}</option>
                        ))}
                      </select>
                    </label>
                    <label className="pr-field">
                      <span>市场</span>
                      <select
                        className="orbis-select"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                      >
                        {COUNTRIES.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              )}

              {open && m.id === "brand" && (
                <div className="pr-fields">
                  <label className="pr-field">
                    <span>品牌名称</span>
                    <input
                      placeholder="例如 Apple"
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                    />
                  </label>
                  <label className="pr-field">
                    <span>品牌域名</span>
                    <input
                      placeholder="例如 apple.com"
                      value={brandDomain}
                      onChange={(e) => setBrandDomain(e.target.value)}
                    />
                  </label>
                  <label className="pr-field">
                    <span>品牌行业</span>
                    <input
                      placeholder="例如 消费电子"
                      value={brandIndustry}
                      onChange={(e) => setBrandIndustry(e.target.value)}
                    />
                  </label>
                  <div className="pr-field-row">
                    <label className="pr-field">
                      <span>语言</span>
                      <select
                        className="orbis-select"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                      >
                        {LANGUAGES.map((l) => (
                          <option key={l}>{l}</option>
                        ))}
                      </select>
                    </label>
                    <label className="pr-field">
                      <span>市场</span>
                      <select
                        className="orbis-select"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                      >
                        {COUNTRIES.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error ? <p className="pr-error">{error}</p> : null}

      <div className="pr-actions">
        <button type="button" className="pr-cancel" onClick={resetForm}>
          取消
        </button>
        <button type="button" className="pr-primary" onClick={() => void start()}>
          下一步
        </button>
      </div>
    </div>
  );
}
