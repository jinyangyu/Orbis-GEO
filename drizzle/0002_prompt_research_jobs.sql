CREATE TABLE `prompt_research_jobs` (
  `id` char(36) NOT NULL,
  `workspace_id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `mode` enum('keywords','url','brand') NOT NULL,
  `input_json` json NOT NULL,
  `status` enum('pending','running','succeeded','failed') NOT NULL DEFAULT 'pending',
  `result_json` json,
  `error` text,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `prompt_research_jobs_ws_created_idx` (`workspace_id`,`created_at`),
  KEY `prompt_research_jobs_user_idx` (`user_id`)
);
