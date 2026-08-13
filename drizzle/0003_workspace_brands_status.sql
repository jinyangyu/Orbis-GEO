ALTER TABLE `workspace_brands`
  ADD COLUMN `status` enum('active','detected','dismissed') NOT NULL DEFAULT 'active' AFTER `role`;
--> statement-breakpoint
ALTER TABLE `workspace_brands`
  ADD COLUMN `detected_from` varchar(32) NOT NULL DEFAULT '' AFTER `status`;
--> statement-breakpoint
ALTER TABLE `workspace_brands`
  ADD COLUMN `aliases` json NULL AFTER `detected_from`;
--> statement-breakpoint
UPDATE `workspace_brands` SET `aliases` = JSON_ARRAY() WHERE `aliases` IS NULL;
--> statement-breakpoint
ALTER TABLE `workspace_brands`
  ADD INDEX `workspace_brands_workspace_status_idx` (`workspace_id`, `status`);
