ALTER TABLE `workspaces`
  ADD COLUMN `report_title` varchar(200) NOT NULL DEFAULT '' AFTER `name`;
--> statement-breakpoint
ALTER TABLE `workspace_brands`
  ADD COLUMN `domain_aliases` json NULL AFTER `aliases`;
--> statement-breakpoint
ALTER TABLE `workspace_brands`
  ADD COLUMN `include_subdomains` tinyint NOT NULL DEFAULT 1 AFTER `domain_aliases`;
--> statement-breakpoint
UPDATE `workspace_brands` SET `domain_aliases` = JSON_ARRAY() WHERE `domain_aliases` IS NULL;
--> statement-breakpoint
CREATE TABLE `workspace_settings` (
  `workspace_id` char(36) NOT NULL,
  `notify_new_recommendations` tinyint NOT NULL DEFAULT 1,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`workspace_id`)
);
--> statement-breakpoint
UPDATE `workspaces` w
  LEFT JOIN `workspace_brands` b
    ON b.workspace_id = w.id AND b.role = 'primary'
  SET w.report_title = COALESCE(NULLIF(w.report_title, ''), b.name, w.name)
  WHERE w.report_title = '' OR w.report_title IS NULL;
