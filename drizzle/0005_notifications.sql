ALTER TABLE `workspace_settings`
  ADD COLUMN `notify_webhook_url` varchar(512) NOT NULL DEFAULT '',
  ADD COLUMN `last_recs_digest` varchar(64) NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS `notification_events` (
  `id` char(36) NOT NULL,
  `workspace_id` char(36) NOT NULL,
  `kind` varchar(64) NOT NULL DEFAULT 'recommendations',
  `title` varchar(255) NOT NULL DEFAULT '',
  `body` text NOT NULL,
  `payload_json` json NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `notification_events_workspace_idx` (`workspace_id`, `created_at`)
);

CREATE TABLE IF NOT EXISTS `notification_deliveries` (
  `id` char(36) NOT NULL,
  `event_id` char(36) NOT NULL,
  `channel` enum('webhook','in_app') NOT NULL,
  `status` varchar(32) NOT NULL DEFAULT 'pending',
  `error` varchar(512) NOT NULL DEFAULT '',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `notification_deliveries_event_idx` (`event_id`)
);

CREATE TABLE IF NOT EXISTS `notification_reads` (
  `user_id` char(36) NOT NULL,
  `event_id` char(36) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`user_id`, `event_id`),
  KEY `notification_reads_user_idx` (`user_id`)
);
