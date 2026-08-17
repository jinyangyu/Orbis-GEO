# Orbis → Otterly 对标：项目整体审计

> 审计日期：2026-08-13。目标：中国市场优先的 AI 搜索可见度（GEO）产品，数据与交互对标 Otterly，并保持可国际化。

## 1. 数据能否支撑当前页面

| 页面 / 模块 | 所需数据 | 库表支撑 | 结论 |
|-------------|----------|----------|------|
| Overview KPI / 趋势 / 排名 | 答卷、提及、引用、日聚合 | L2 + L3 | **可支撑**（需已导入监测数据） |
| Prompts 表 / 抽屉 | prompt 指标 + 答卷明细 | prompts + L2/L3 | **可支撑** |
| Citations | URL/域名引用 | citation_events + L3 | **可支撑** |
| Recommendations | 规则引擎 | 由 overview 计算 | **可支撑**（无持久化） |
| Brand Settings | 品牌/竞品/prompts/通知偏好 | workspace_* + prompts | **可支撑** |
| Prompt 研究 | 生成任务 | prompt_research_jobs | **可支撑**（无 key 时启发式） |
| Generate Report PDF | overview + citations | 内存导出 | **可支撑**（不落库） |
| 报告中心 | 历史导出列表 | report_exports **未接线** | **不能当真** |
| 内容生成 | 外部 Agent | 无本地文章表 | **依赖外部服务** |
| 通知送达 | 邮件/站内信 | 仅有 preference 字段 | **未实现送达** |
| 真实 NLP 情感 | 正负向标注 | sentiment 列恒 NULL | **UI 为启发式** |

**结论：** 监测主路径（Overview / Prompts / Citations / Settings）在「已导入观测数据」前提下数据充足。缺口集中在：报告中心、通知送达、真实情感、`citation_stars`、迁移脚本与 schema 漂移。

## 2. 真实数据 vs Mock

| 表面 | 真实 DB | Mock / Stub / 启发式 |
|------|---------|----------------------|
| Overview / Prompts / Citations 主指标 | ✓ | 情感/意图/可见度/Likelihood 为启发式 |
| Brand Settings CRUD | ✓ | Detected 空队列时会 seed 演示竞品 |
| Prompt Research | ✓ 任务表 | 无 OPENAI_API_KEY → 模板启发式 |
| Generate Report | ✓ 用当前指标 | 不写 report_exports |
| 报告中心 | ✗ | **整页硬编码列表** |
| Onboarding 完成写入 | ✓ | Processing/Tour 展示 MockReport |
| 内容导出 / 建议「查看指南」 | ✗ | notify stub |
| 星标引用 | ✗ | UI 静态 ☆ |

## 3. 结构与可扩展性

**合理处：** `lib/{metrics,onboarding,brands,brand-settings,prompt-research,report}/` 分层清晰；API 路由薄；L2/L3 双路径。

**风险：**
- `app/page.tsx` 体量过大（壳 + 多页组件）
- `drizzle/0001` 无 DDL；L3 靠脚本；`db:migrate` 不可靠，依赖 `db:push`
- `report_exports` / `citation_stars` 死表
- brands `assertWorkspaceOwner` 已放宽为「存在即可」（演示用）

**建议方向（本期落地一部分）：** i18n 抽离文案；测试锁住指标数学；报告中心改为空态/真实列表占位；启发式明确标注；Detected demo seed 受环境变量控制。

## 4. 文案与国际化

- 现状：**中文为主 + Otterly 英文残留**（筛选、部分 KPI、Export as CSV、Generate Report）
- 无 i18n 框架
- 本期：`lib/i18n.ts`（zh 默认 + en 消息表）+ 迁移筛选/顶栏/关键按钮；`lang` 跟随 locale

## 5. 测试

现有：onboarding validate、slug、seo-agent query、rendered-html smoke。  
缺失：指标数学、日期范围、prompt-research validate、metrics client 标签映射。  
本期补齐上述单测并纳入 `test:unit`。

## 本期修改清单（已落地）

1. ✅ `docs/project-audit.md`（本文）
2. ✅ `lib/i18n.ts`（zh 默认 + en 消息表）+ 筛选/顶栏关键按钮键驱动文案
3. ✅ 情感列标注「情感（估算）」；可见度/情感启发式抽到 `lib/metrics/heuristics.ts`
4. ✅ 报告中心：去掉假列表，改为空态 + 引导生成 PDF
5. ✅ Detected demo seed：仅 `ORBIS_DEMO_DETECTED=1` 时插入
6. ✅ 单测：heuristics / filters / date-range / prompt-research-validate / i18n
7. ✅ Prompt Research 结果标注 heuristic / llm 引擎
8. ✅ 筛选标签映射抽到 `lib/metrics/filters.ts`（中英别名）

## P2 工程债（2026-08-17 已落地）

1. ✅ 拆分 `app/page.tsx` → `app/dashboard/*`（shell / overview / prompts / …）
2. ✅ `GET /api/health`（`?ready=0` 存活；默认含 DB）
3. ✅ ErrorBoundary + `reportError` / `POST /api/client-error`（可选 webhook）
4. ✅ GitHub Actions CI（lint + unit）；`npm run test:e2e` 可选对线上/本地冒烟
5. ✅ 补齐 `.env.example`
