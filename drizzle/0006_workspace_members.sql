CREATE TABLE IF NOT EXISTS `workspace_members` (
  `workspace_id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `role` enum('owner','member') NOT NULL DEFAULT 'member',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`workspace_id`, `user_id`),
  KEY `workspace_members_user_idx` (`user_id`)
);

INSERT IGNORE INTO `workspace_members` (`workspace_id`, `user_id`, `role`)
SELECT `id`, `owner_user_id`, 'owner' FROM `workspaces`;
