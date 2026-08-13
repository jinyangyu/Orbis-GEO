-- Monitoring / report schema (v1, simplified)
-- Applied to local MySQL `orbis`. Source of truth for Drizzle: db/schema.ts

-- Config
--   workspace_brands  (primary + competitor)
--   prompts           (+ market, tags, intent_volume)
--   engines

-- Facts
--   answer_observations
--   answer_brand_mentions
--   citation_events
--   citation_competitors
--   citation_stars

-- Optional
--   report_exports
