"use client";

import type { OverviewMetrics } from "@/lib/metrics/types";

export function Recommendations({
  overview,
  notify,
}: {
  overview: OverviewMetrics | null;
  notify: (s: string) => void;
}) {
  const items = overview?.actions ?? [];
  return (
    <>
      <section className="audit-hero">
        <div>
          <span className="eyebrow">RECOMMENDATIONS · 基于监测库</span>
          <h2>{overview ? overview.brandName : "品牌"} 优先行动</h2>
          <p>
            {overview
              ? `覆盖率、官网引用份额与高频第三方来源已接入真实答卷。共 ${items.length} 条建议。`
              : "加载监测数据后生成建议。"}
          </p>
        </div>
      </section>
      <div className="panel audit-list">
        <div className="panel-head">
          <div>
            <h3>优化建议</h3>
            <p>按影响优先级排序</p>
          </div>
        </div>
        {items.map((item, i) => (
          <div className="audit-item" key={item.title}>
            <span className="audit-score">{90 - i * 6}</span>
            <div className="audit-copy">
              <div>
                <b>{item.title}</b>
                <span>{item.category}</span>
              </div>
              <p>{item.description}</p>
              <div className="audit-meta">
                <span>
                  影响{" "}
                  <b className={item.priority === "高" ? "danger-text" : "warn-text"}>
                    {item.priority}
                  </b>
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => notify(`已打开「${item.title}」执行指南`)}
            >
              查看指南 →
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <div className="empty-delta" style={{ margin: 18 }}>
            暂无建议
          </div>
        )}
      </div>
    </>
  );
}
