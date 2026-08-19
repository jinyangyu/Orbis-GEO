# Orbis｜AI 搜索可见度与 GEO 平台

vinext 仪表盘：监测品牌在 ChatGPT / DeepSeek / 豆包等答卷中的提及、引用与覆盖率。配置与监测事实存在 MySQL。

仓库：<https://github.com/jinyangyu/Orbis-GEO>

## 环境要求

- Node.js `>=22.13.0`
- MySQL 8.x（本机或与应用同机）

## 本地启动

```bash
npm install
cp .env.example .env.local
# 按这台机器改 DATABASE_URL，主机必须是 127.0.0.1，不要写 localhost
npm run db:push
npm run dev
```

`localhost` 和 `127.0.0.1` 在 MySQL 里是不同账号。应用会把 `localhost` 规范成 `127.0.0.1`。

每台机器单独一份 `.env.local`，不要提交、不要打进 zip。示例账号 `orbis:orbis` 只适用于本机自己建过该用户的开发库。

```bash
DATABASE_URL=mysql://用户:密码@127.0.0.1:3306/库名
SESSION_SECRET=至少32位随机串
ORBIS_COOKIE_SECURE=0
ORBIS_DEV_OPEN_TENANT=1
```

需要演示门禁时，同时设置 `ORBIS_GATE_USER` 与 `ORBIS_GATE_PASSWORD`。

建库示例（本机开发）：

```sql
CREATE DATABASE orbis CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'orbis'@'127.0.0.1' IDENTIFIED BY 'orbis';
GRANT ALL PRIVILEGES ON orbis.* TO 'orbis'@'127.0.0.1';
FLUSH PRIVILEGES;
```

导入监测数据后重建三级日表：

```bash
npm run db:rebuild-daily
```

## 服务器部署（宝塔 / ECS）

详见 [BAOTA-UPLOAD.txt](BAOTA-UPLOAD.txt)。摘要：

```bash
cd /www/wwwroot/orbis/seo-geo-platform
cp -n .env.example .env.local
# 编辑 DATABASE_URL 为这台宝塔「数据库」面板里的用户/密码
bash start.sh
```

日常发版：

```bash
cd /www/wwwroot/orbis/seo-geo-platform
bash deploy.sh
```

`deploy.sh` 会从 GitHub 拉最新代码（无 git 则下 zip）、停掉旧进程、验库、构建并用 PM2 启动，同时保留 `.env.local`。  
`bash start.sh` 只重启当前目录，不拉代码。

反代 `http://127.0.0.1:3000`。自检：`curl -s http://127.0.0.1:3000/api/health`  
日志应出现 `[orbis] db ok user=...`。

PM2 读 `.env.local`；vinext Worker 读启动时写出的 `.dev.vars`。不要把数据库密码写进仓库里的 `ecosystem.config.cjs`。

演示机可保留 `ORBIS_DEV_OPEN_TENANT=1` 且不要设 `NODE_ENV=production`，以便 `POST /api/workspaces/claim` 挂上已导入的监测工作区。正式环境不要开该开关。

## 数据分层与仪表盘查询

表结构见 [docs/storage-design.md](docs/storage-design.md)。

| 层 | 表 | 用途 |
|---|---|---|
| L0/L1 | users / workspaces / workspace_brands / prompts / engines | 账号与配置 |
| L2 | answer_observations / answer_brand_mentions / citation_events / … | 答卷事实 |
| L3 | `*_metrics_daily` 五张日表 | Overview / Prompts / Citations 默认聚合 |

默认「全部引擎」、不筛市场时，KPI / 趋势 / 工作区列表走 L3。引擎列表与域名覆盖改为按日期索引的短查询，不再全表 JOIN 百万行提及。筛单个引擎时仍回退 L2（日表没有引擎维度）。

## 身份

- 登录态：HttpOnly 签名 Cookie `orbis_session`（`SESSION_SECRET`）
- `x-orbis-user-id` 仅用于 `POST /api/auth/bootstrap` 提议 userId，不能单独授权
- 工作区访问以 `workspace_members` 为准
- 可选门禁：`ORBIS_GATE_USER` + `ORBIS_GATE_PASSWORD`

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 本地开发 |
| `npm run build` / `npm start` | 生产构建与启动（start 前会验库） |
| `npm run db:check` | 只验 `DATABASE_URL` 并写 `.dev.vars` |
| `npm run db:push` / `db:migrate` | 同步 schema |
| `npm run db:seed-engines` | 引擎字典 |
| `npm run db:import-inspection` | 导入 inspection 答卷到 L2 |
| `npm run db:rebuild-daily` | 从 L2 重建 L3 |
| `npm run test:unit` | 单元测试 |
| `bash deploy.sh` | 服务器拉 GitHub 最新代码并启动 |
| `bash start.sh` | 只重启当前目录，不拉代码 |

## 健康检查与 CI

- `GET /api/health` — 就绪（含 DB）；`?ready=0` 仅存活
- GitHub Actions：`.github/workflows/ci.yml`（lint + unit）
- 可选：`ORBIS_E2E_BASE_URL=http://127.0.0.1:3000 npm run test:e2e`

## 生产核对

- [ ] 每台机器自己的 `.env.local`，主机 `127.0.0.1`
- [ ] `SESSION_SECRET` ≥ 32 位
- [ ] 正式环境关闭 `ORBIS_DEV_OPEN_TENANT`
- [ ] HTTPS 下不要把 `ORBIS_COOKIE_SECURE` 强制为 `0`
- [ ] `REPORTS_STORAGE` 可写（`local` 或 `s3`）

## 内容生成（可选）

「内容生成」经 BFF 调 Go agent。`.env.local` 中设置 `SEO_AGENT_BASE_URL=http://127.0.0.1:8080`。

## vinext 宿主

本项目基于 vinext starter：不使用 `wrangler.jsonc`；`.openai/hosting.json` 声明可选 D1/R2（主存储是 MySQL）。演示身份走门禁 cookie + session cookie；工作区成员以 `workspace_members` 为准。
