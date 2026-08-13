import { sql } from "drizzle-orm";
import {
  char,
  date,
  datetime,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  tinyint,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

const timestamps = {
  createdAt: datetime("created_at", { mode: "string", fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`),
  updatedAt: datetime("updated_at", { mode: "string", fsp: 3 })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)`),
};

export const users = mysqlTable("users", {
  id: char("id", { length: 36 }).primaryKey(),
  email: varchar("email", { length: 255 }),
  firstName: varchar("first_name", { length: 100 }).notNull().default(""),
  lastName: varchar("last_name", { length: 100 }).notNull().default(""),
  role: mysqlEnum("role", ["brand", "agency"]).notNull().default("brand"),
  source: varchar("source", { length: 64 }).notNull().default(""),
  ...timestamps,
}, (table) => [
  uniqueIndex("users_email_unique").on(table.email),
]);

export const workspaces = mysqlTable("workspaces", {
  id: char("id", { length: 36 }).primaryKey(),
  ownerUserId: char("owner_user_id", { length: 36 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  /** Display title for Brand Report / settings breadcrumb (Otterly "Report title"). */
  reportTitle: varchar("report_title", { length: 200 }).notNull().default(""),
  slug: varchar("slug", { length: 200 }).notNull(),
  onboardingCompletedAt: datetime("onboarding_completed_at", {
    mode: "string",
    fsp: 3,
  }),
  ...timestamps,
}, (table) => [
  uniqueIndex("workspaces_owner_user_id_unique").on(table.ownerUserId),
  uniqueIndex("workspaces_slug_unique").on(table.slug),
  index("workspaces_owner_user_id_idx").on(table.ownerUserId),
]);

/** Own brand + competitors in one table. */
export const workspaceBrands = mysqlTable("workspace_brands", {
  id: char("id", { length: 36 }).primaryKey(),
  workspaceId: char("workspace_id", { length: 36 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  domain: varchar("domain", { length: 255 }).notNull().default(""),
  role: mysqlEnum("role", ["primary", "competitor"]).notNull(),
  /** active = in monitoring; detected = pending review; dismissed = ignored. */
  status: mysqlEnum("status", ["active", "detected", "dismissed"])
    .notNull()
    .default("active"),
  detectedFrom: varchar("detected_from", { length: 32 }).notNull().default(""),
  aliases: json("aliases").$type<string[]>().notNull().default(sql`(JSON_ARRAY())`),
  /** Extra domains for citation matching (Otterly domain variations). */
  domainAliases: json("domain_aliases")
    .$type<string[]>()
    .notNull()
    .default(sql`(JSON_ARRAY())`),
  /** When 1, match *.domain as well as apex. */
  includeSubdomains: tinyint("include_subdomains").notNull().default(1),
  market: varchar("market", { length: 64 }).notNull().default(""),
  language: varchar("language", { length: 64 }).notNull().default(""),
  mark: varchar("mark", { length: 8 }).notNull().default(""),
  color: varchar("color", { length: 16 }).notNull().default(""),
  sortOrder: int("sort_order").notNull().default(0),
  ...timestamps,
}, (table) => [
  index("workspace_brands_workspace_idx").on(table.workspaceId),
  index("workspace_brands_workspace_role_idx").on(table.workspaceId, table.role),
  index("workspace_brands_workspace_status_idx").on(table.workspaceId, table.status),
  uniqueIndex("workspace_brands_workspace_domain_unique").on(
    table.workspaceId,
    table.domain,
  ),
]);

/** Per-workspace prefs (notifications, etc.). */
export const workspaceSettings = mysqlTable("workspace_settings", {
  workspaceId: char("workspace_id", { length: 36 }).primaryKey(),
  notifyNewRecommendations: tinyint("notify_new_recommendations")
    .notNull()
    .default(1),
  ...timestamps,
});

export const prompts = mysqlTable("prompts", {
  id: char("id", { length: 36 }).primaryKey(),
  workspaceId: char("workspace_id", { length: 36 }).notNull(),
  text: text("text").notNull(),
  sortOrder: int("sort_order").notNull().default(0),
  source: varchar("source", { length: 32 }).notNull().default("onboarding"),
  isActive: tinyint("is_active").notNull().default(1),
  market: varchar("market", { length: 64 }).notNull().default(""),
  tags: json("tags").$type<string[]>().notNull().default(sql`(JSON_ARRAY())`),
  intentVolume: varchar("intent_volume", { length: 64 }),
  ...timestamps,
}, (table) => [
  index("prompts_workspace_sort_idx").on(table.workspaceId, table.sortOrder),
]);

export const engines = mysqlTable("engines", {
  id: char("id", { length: 36 }).primaryKey(),
  code: varchar("code", { length: 32 }).notNull(),
  name: varchar("name", { length: 64 }).notNull(),
  sortOrder: int("sort_order").notNull().default(0),
  isActive: tinyint("is_active").notNull().default(1),
  ...timestamps,
}, (table) => [
  uniqueIndex("engines_code_unique").on(table.code),
]);

/**
 * One AI monitoring result per prompt × engine × market × day.
 * answer_text / raw_path hold raw inspection payloads for import & audit.
 */
export const answerObservations = mysqlTable("answer_observations", {
  id: char("id", { length: 36 }).primaryKey(),
  workspaceId: char("workspace_id", { length: 36 }).notNull(),
  promptId: char("prompt_id", { length: 36 }).notNull(),
  engineId: char("engine_id", { length: 36 }).notNull(),
  market: varchar("market", { length: 64 }).notNull().default(""),
  observedOn: date("observed_on", { mode: "string" }).notNull(),
  answerText: text("answer_text"),
  rawPath: varchar("raw_path", { length: 512 }),
  model: varchar("model", { length: 128 }).notNull().default(""),
  channel: varchar("channel", { length: 64 }).notNull().default(""),
  runTs: varchar("run_ts", { length: 32 }).notNull().default(""),
  ...timestamps,
}, (table) => [
  uniqueIndex("answer_observations_unique").on(
    table.workspaceId,
    table.promptId,
    table.engineId,
    table.market,
    table.observedOn,
  ),
  index("answer_observations_workspace_date_idx").on(
    table.workspaceId,
    table.observedOn,
  ),
  index("answer_observations_prompt_idx").on(table.promptId),
]);

/** Brand (own or competitor) mention flags on an observation. */
export const answerBrandMentions = mysqlTable("answer_brand_mentions", {
  id: char("id", { length: 36 }).primaryKey(),
  observationId: char("observation_id", { length: 36 }).notNull(),
  brandId: char("brand_id", { length: 36 }).notNull(),
  mentioned: tinyint("mentioned").notNull().default(0),
  position: int("position"),
  sentiment: int("sentiment"),
  ...timestamps,
}, (table) => [
  uniqueIndex("answer_brand_mentions_unique").on(
    table.observationId,
    table.brandId,
  ),
  index("answer_brand_mentions_brand_idx").on(table.brandId),
]);

/** Citation row ≈ Otterly Citations CSV grain. */
export const citationEvents = mysqlTable("citation_events", {
  id: char("id", { length: 36 }).primaryKey(),
  observationId: char("observation_id", { length: 36 }).notNull(),
  url: varchar("url", { length: 512 }).notNull(),
  title: varchar("title", { length: 512 }).notNull().default(""),
  position: int("position").notNull().default(0),
  domain: varchar("domain", { length: 255 }).notNull().default(""),
  domainCategory: varchar("domain_category", { length: 64 }).notNull().default(""),
  brandMentionedOnPage: mysqlEnum("brand_mentioned_on_page", [
    "yes",
    "no",
    "na",
  ]).notNull().default("na"),
  timesCited: int("times_cited").notNull().default(1),
  ...timestamps,
}, (table) => [
  uniqueIndex("citation_events_observation_url_unique").on(
    table.observationId,
    table.url,
  ),
  index("citation_events_domain_idx").on(table.domain),
  index("citation_events_observation_idx").on(table.observationId),
]);

export const citationCompetitors = mysqlTable("citation_competitors", {
  eventId: char("event_id", { length: 36 }).notNull(),
  brandId: char("brand_id", { length: 36 }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.eventId, table.brandId] }),
  index("citation_competitors_brand_idx").on(table.brandId),
]);

export const citationStars = mysqlTable("citation_stars", {
  id: char("id", { length: 36 }).primaryKey(),
  workspaceId: char("workspace_id", { length: 36 }).notNull(),
  userId: char("user_id", { length: 36 }).notNull(),
  url: varchar("url", { length: 512 }).notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("citation_stars_unique").on(
    table.workspaceId,
    table.userId,
    table.url,
  ),
]);

export const onboardingSessions = mysqlTable("onboarding_sessions", {
  id: char("id", { length: 36 }).primaryKey(),
  userId: char("user_id", { length: 36 }).notNull(),
  version: tinyint("version").notNull().default(1),
  screen: varchar("screen", { length: 32 }).notNull(),
  processingIndex: int("processing_index").notNull().default(0),
  tourIndex: int("tour_index").notNull().default(0),
  draftJson: json("draft_json").notNull(),
  completedAt: datetime("completed_at", { mode: "string", fsp: 3 }),
  ...timestamps,
}, (table) => [
  index("onboarding_sessions_user_id_idx").on(table.userId),
]);

/** Optional export artifact metadata (PDF/CSV). */
export const reportExports = mysqlTable("report_exports", {
  id: char("id", { length: 36 }).primaryKey(),
  workspaceId: char("workspace_id", { length: 36 }).notNull(),
  title: varchar("title", { length: 255 }).notNull().default(""),
  kind: varchar("kind", { length: 32 }).notNull().default("overview"),
  filtersJson: json("filters_json").notNull(),
  filePath: varchar("file_path", { length: 512 }),
  generatedAt: datetime("generated_at", { mode: "string", fsp: 3 }).notNull(),
  ...timestamps,
}, (table) => [
  index("report_exports_workspace_idx").on(table.workspaceId),
]);

/**
 * L3 daily rollups (engine-agnostic). Rebuild from L2 per workspace × day.
 * Dashboard KPIs / trends read these; Prompt detail still uses L2.
 */
export const obsMetricsDaily = mysqlTable("obs_metrics_daily", {
  id: char("id", { length: 36 }).primaryKey(),
  workspaceId: char("workspace_id", { length: 36 }).notNull(),
  observedOn: date("observed_on", { mode: "string" }).notNull(),
  obsCount: int("obs_count").notNull().default(0),
  ...timestamps,
}, (table) => [
  uniqueIndex("obs_metrics_daily_unique").on(table.workspaceId, table.observedOn),
  index("obs_metrics_daily_date_idx").on(table.observedOn),
]);

export const brandMetricsDaily = mysqlTable("brand_metrics_daily", {
  id: char("id", { length: 36 }).primaryKey(),
  workspaceId: char("workspace_id", { length: 36 }).notNull(),
  brandId: char("brand_id", { length: 36 }).notNull(),
  observedOn: date("observed_on", { mode: "string" }).notNull(),
  mentionedObs: int("mentioned_obs").notNull().default(0),
  mentionSum: int("mention_sum").notNull().default(0),
  positionSum: int("position_sum").notNull().default(0),
  positionN: int("position_n").notNull().default(0),
  ...timestamps,
}, (table) => [
  uniqueIndex("brand_metrics_daily_unique").on(
    table.workspaceId,
    table.brandId,
    table.observedOn,
  ),
  index("brand_metrics_daily_ws_date_idx").on(table.workspaceId, table.observedOn),
  index("brand_metrics_daily_brand_idx").on(table.brandId),
]);

export const promptMetricsDaily = mysqlTable("prompt_metrics_daily", {
  id: char("id", { length: 36 }).primaryKey(),
  workspaceId: char("workspace_id", { length: 36 }).notNull(),
  promptId: char("prompt_id", { length: 36 }).notNull(),
  observedOn: date("observed_on", { mode: "string" }).notNull(),
  obsCount: int("obs_count").notNull().default(0),
  primaryMentions: int("primary_mentions").notNull().default(0),
  totalBrandMentions: int("total_brand_mentions").notNull().default(0),
  domainCites: int("domain_cites").notNull().default(0),
  ...timestamps,
}, (table) => [
  uniqueIndex("prompt_metrics_daily_unique").on(
    table.workspaceId,
    table.promptId,
    table.observedOn,
  ),
  index("prompt_metrics_daily_ws_date_idx").on(table.workspaceId, table.observedOn),
  index("prompt_metrics_daily_prompt_idx").on(table.promptId),
]);

export const domainMetricsDaily = mysqlTable("domain_metrics_daily", {
  id: char("id", { length: 36 }).primaryKey(),
  workspaceId: char("workspace_id", { length: 36 }).notNull(),
  domain: varchar("domain", { length: 255 }).notNull(),
  observedOn: date("observed_on", { mode: "string" }).notNull(),
  domainCategory: varchar("domain_category", { length: 64 }).notNull().default(""),
  citations: int("citations").notNull().default(0),
  promptsHit: int("prompts_hit").notNull().default(0),
  ...timestamps,
}, (table) => [
  uniqueIndex("domain_metrics_daily_unique").on(
    table.workspaceId,
    table.domain,
    table.observedOn,
  ),
  index("domain_metrics_daily_ws_date_idx").on(table.workspaceId, table.observedOn),
]);

export const urlMetricsDaily = mysqlTable("url_metrics_daily", {
  id: char("id", { length: 36 }).primaryKey(),
  workspaceId: char("workspace_id", { length: 36 }).notNull(),
  url: varchar("url", { length: 512 }).notNull(),
  observedOn: date("observed_on", { mode: "string" }).notNull(),
  title: varchar("title", { length: 512 }).notNull().default(""),
  domain: varchar("domain", { length: 255 }).notNull().default(""),
  domainCategory: varchar("domain_category", { length: 64 }).notNull().default(""),
  citations: int("citations").notNull().default(0),
  brandOnPageYes: int("brand_on_page_yes").notNull().default(0),
  ...timestamps,
}, (table) => [
  uniqueIndex("url_metrics_daily_unique").on(
    table.workspaceId,
    table.url,
    table.observedOn,
  ),
  index("url_metrics_daily_ws_date_idx").on(table.workspaceId, table.observedOn),
  index("url_metrics_daily_domain_idx").on(table.domain),
]);

/** AI Prompt Research jobs (Otterly-like wizard). */
export const promptResearchJobs = mysqlTable("prompt_research_jobs", {
  id: char("id", { length: 36 }).primaryKey(),
  workspaceId: char("workspace_id", { length: 36 }).notNull(),
  userId: char("user_id", { length: 36 }).notNull(),
  mode: mysqlEnum("mode", ["keywords", "url", "brand"]).notNull(),
  inputJson: json("input_json").$type<Record<string, unknown>>().notNull(),
  status: mysqlEnum("status", ["pending", "running", "succeeded", "failed"])
    .notNull()
    .default("pending"),
  resultJson: json("result_json").$type<{
    prompts: Array<{
      text: string;
      intentScore: number;
      intent?: string;
      funnel?: string;
    }>;
    engine?: string;
  } | null>(),
  error: text("error"),
  ...timestamps,
}, (table) => [
  index("prompt_research_jobs_ws_created_idx").on(
    table.workspaceId,
    table.createdAt,
  ),
  index("prompt_research_jobs_user_idx").on(table.userId),
]);
