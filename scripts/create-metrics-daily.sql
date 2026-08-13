-- L3 daily rollups (engine-agnostic). Safe to re-run.
CREATE TABLE IF NOT EXISTS obs_metrics_daily (
  id CHAR(36) NOT NULL,
  workspace_id CHAR(36) NOT NULL,
  observed_on DATE NOT NULL,
  obs_count INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY obs_metrics_daily_unique (workspace_id, observed_on),
  KEY obs_metrics_daily_date_idx (observed_on)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS brand_metrics_daily (
  id CHAR(36) NOT NULL,
  workspace_id CHAR(36) NOT NULL,
  brand_id CHAR(36) NOT NULL,
  observed_on DATE NOT NULL,
  mentioned_obs INT NOT NULL DEFAULT 0,
  mention_sum INT NOT NULL DEFAULT 0,
  position_sum INT NOT NULL DEFAULT 0,
  position_n INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY brand_metrics_daily_unique (workspace_id, brand_id, observed_on),
  KEY brand_metrics_daily_ws_date_idx (workspace_id, observed_on),
  KEY brand_metrics_daily_brand_idx (brand_id)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prompt_metrics_daily (
  id CHAR(36) NOT NULL,
  workspace_id CHAR(36) NOT NULL,
  prompt_id CHAR(36) NOT NULL,
  observed_on DATE NOT NULL,
  obs_count INT NOT NULL DEFAULT 0,
  primary_mentions INT NOT NULL DEFAULT 0,
  total_brand_mentions INT NOT NULL DEFAULT 0,
  domain_cites INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY prompt_metrics_daily_unique (workspace_id, prompt_id, observed_on),
  KEY prompt_metrics_daily_ws_date_idx (workspace_id, observed_on),
  KEY prompt_metrics_daily_prompt_idx (prompt_id)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS domain_metrics_daily (
  id CHAR(36) NOT NULL,
  workspace_id CHAR(36) NOT NULL,
  domain VARCHAR(255) NOT NULL,
  observed_on DATE NOT NULL,
  domain_category VARCHAR(64) NOT NULL DEFAULT '',
  citations INT NOT NULL DEFAULT 0,
  prompts_hit INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY domain_metrics_daily_unique (workspace_id, domain, observed_on),
  KEY domain_metrics_daily_ws_date_idx (workspace_id, observed_on)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS url_metrics_daily (
  id CHAR(36) NOT NULL,
  workspace_id CHAR(36) NOT NULL,
  url VARCHAR(512) NOT NULL,
  observed_on DATE NOT NULL,
  title VARCHAR(512) NOT NULL DEFAULT '',
  domain VARCHAR(255) NOT NULL DEFAULT '',
  domain_category VARCHAR(64) NOT NULL DEFAULT '',
  citations INT NOT NULL DEFAULT 0,
  brand_on_page_yes INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY url_metrics_daily_unique (workspace_id, url, observed_on),
  KEY url_metrics_daily_ws_date_idx (workspace_id, observed_on),
  KEY url_metrics_daily_domain_idx (domain)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
