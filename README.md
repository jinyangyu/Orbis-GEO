# Orbis SEO / GEO Platform

vinext dashboard for AI search visibility (GEO), with MySQL persistence for
onboarding and workspace configuration.

## Prerequisites

- Node.js `>=22.13.0`
- MySQL 8.x (local)

## Quick Start

```bash
npm install
cp .env.example .env.local
# create database + user, then:
npm run db:push
npm run dev
```

This starter does not use `wrangler.jsonc`.

## Local MySQL (onboarding / workspace)

Onboarding drafts and completed workspace config are stored in MySQL via Drizzle.

1. Create a database (example):

```sql
CREATE DATABASE orbis CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'orbis'@'%' IDENTIFIED BY 'orbis';
GRANT ALL PRIVILEGES ON orbis.* TO 'orbis'@'%';
FLUSH PRIVILEGES;
```

2. Set `DATABASE_URL` (and session secrets) in `.env.local`:

```bash
DATABASE_URL=mysql://orbis:orbis@127.0.0.1:3306/orbis
SESSION_SECRET=dev-local-change-me-to-a-long-random-string
ORBIS_COOKIE_SECURE=0
ORBIS_DEV_OPEN_TENANT=1
```

3. Apply schema:

```bash
npm run db:push
# or apply SQL under drizzle/ (e.g. 0005_notifications.sql, 0006_workspace_members.sql)
```

Identity (P0): the server issues an **HttpOnly signed cookie** `orbis_session`
(HMAC with `SESSION_SECRET`). API access requires this cookie (`credentials: "include"`).
A `localStorage` UUID may still be sent as `x-orbis-user-id` only during
`POST /api/auth/bootstrap` to propose a stable user id — it is **not** trusted for
authorization. Workspace data requires a row in `workspace_members`.

For local imported monitoring data (e.g. inspection import), keep
`ORBIS_DEV_OPEN_TENANT=1` so the app can `POST /api/workspaces/claim` and attach
those workspaces to your session. **Do not enable that flag in production**
(`NODE_ENV=production` ignores it).

### Production checklist

- [ ] `NODE_ENV=production` (DEV claim is always off)
- [ ] `ORBIS_DEV_OPEN_TENANT`, `ORBIS_DEMO_DETECTED`, `ORBIS_HEURISTIC_SENTIMENT` unset
- [ ] `SESSION_SECRET` ≥32 random characters
- [ ] `ORBIS_COOKIE_SECURE` not forced to `0` (HTTPS cookies)
- [ ] `REPORTS_STORAGE` set (`local` disk or `s3`) and writable
- [ ] Worker security headers enabled (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`)
- [ ] App is noindex (`app/robots.ts` + layout `robots: { index: false }`)

SIWC email is reserved on
`users.email` but not required yet.

API surface:

- `GET/PUT /api/onboarding` — draft session
- `POST /api/onboarding/complete` — commit users / workspace / brand / prompts / competitors
- `POST /api/onboarding/reset` — clear draft (sidebar「重新体验首次激活」)
- `GET /api/workspace` — current workspace payload for the dashboard shell

`localStorage` (`orbis_onboarding_v1`) remains an offline draft fallback; MySQL is
the source of truth when available.

### Schema (MySQL `orbis`)

详见设计文档：[docs/storage-design.md](docs/storage-design.md)。

**Account / onboarding:** `users`, `workspaces`, `onboarding_sessions`

**Config:** `workspace_brands` (primary + competitor), `prompts`, `engines`

**Facts (GEO monitoring):** `answer_observations`, `answer_brand_mentions`,
`citation_events`, `citation_competitors`, `citation_stars`

**Daily rollups (L3):** `obs_metrics_daily`, `brand_metrics_daily`,
`prompt_metrics_daily`, `domain_metrics_daily`, `url_metrics_daily`

**Optional:** `report_exports`

Seed engines:

```bash
mysql -h127.0.0.1 -P3306 -uorbis -porbis orbis < scripts/seed-engines.sql
```

Rebuild daily metrics after importing facts:

```bash
npm run db:rebuild-daily
```

## Health & CI

- `GET /api/health` — readiness (DB ping); `GET /api/health?ready=0` — liveness only
- `POST /api/client-error` — browser ErrorBoundary reports
- GitHub Actions: `.github/workflows/ci.yml` runs lint + unit tests
- Optional live smoke: `ORBIS_E2E_BASE_URL=http://127.0.0.1:3000 npm run test:e2e`

Dashboard UI is split under `app/dashboard/` (`shell`, `overview`, `prompts`, …); `app/page.tsx` is the thin entry.

## Included Shape

- edit site code under `app/`
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings (D1 unused; MySQL is primary)
- `vite.config.ts` simulates declared bindings for local development
- `db/schema.ts` defines onboarding / workspace tables
- `examples/d1/` contains a legacy D1 example surface
- `drizzle.config.ts` targets MySQL via `DATABASE_URL`
## Workspace Auth Headers

OpenAI workspace sites can read the current user's email from
`oai-authenticated-user-email`.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Content generation (seo-generator-agent)

The「内容生成」page lists articles from the Go agent via a vinext BFF.

1. Start `seo-generator-agent` HTTP API (default `http://127.0.0.1:8080`).
2. Copy `.env.example` to `.env.local` and set:

```bash
SEO_AGENT_BASE_URL=http://127.0.0.1:8080
```

3. Run `npm run dev`, open the dashboard, and open **内容 → 内容生成**.

Browser calls `GET /api/content/articles`, which proxies to
`GET {SEO_AGENT_BASE_URL}/api/orbis/articles`. Preview links open the agent's
`/preview/:articleId` in a new tab when `preview_ready` is true.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: build the starter and verify its rendered loading skeleton
- `npm run test:unit`: unit tests (query helpers, slug, onboarding validation)
- `npm run db:generate`: generate Drizzle migrations after schema changes
- `npm run db:push`: push schema to local MySQL
- `npm run db:migrate`: apply generated SQL migrations
- `npm run db:seed-engines`: seed AI engine dictionary (idempotent)
- `npm run db:import-inspection`: import inspection `response.json` dumps into L2 fact tables
  (default path `~/Downloads/inspection_2026-08-05_all_raw_responses_v2`; pass another root as argv)
- `npm run db:enrich-monitoring`: discover competitors, backfill mentions / citation categories

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle MySQL Guide](https://orm.drizzle.team/docs/get-started/mysql-new)
