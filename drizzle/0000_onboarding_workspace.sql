CREATE TABLE `users` (
	`id` char(36) NOT NULL,
	`email` varchar(255),
	`first_name` varchar(100) NOT NULL DEFAULT '',
	`last_name` varchar(100) NOT NULL DEFAULT '',
	`role` enum('brand','agency') NOT NULL DEFAULT 'brand',
	`source` varchar(64) NOT NULL DEFAULT '',
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `users_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` char(36) NOT NULL,
	`owner_user_id` char(36) NOT NULL,
	`name` varchar(200) NOT NULL,
	`slug` varchar(200) NOT NULL,
	`onboarding_completed_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `workspaces_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_owner_user_id_unique` ON `workspaces` (`owner_user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_slug_unique` ON `workspaces` (`slug`);
--> statement-breakpoint
CREATE INDEX `workspaces_owner_user_id_idx` ON `workspaces` (`owner_user_id`);
--> statement-breakpoint
CREATE TABLE `brands` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`name` varchar(200) NOT NULL,
	`website` varchar(255) NOT NULL DEFAULT '',
	`market` varchar(64) NOT NULL DEFAULT '',
	`language` varchar(64) NOT NULL DEFAULT '',
	`is_primary` tinyint NOT NULL DEFAULT 1,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `brands_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `brands_workspace_id_unique` ON `brands` (`workspace_id`);
--> statement-breakpoint
CREATE TABLE `prompts` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`text` text NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`source` varchar(32) NOT NULL DEFAULT 'onboarding',
	`is_active` tinyint NOT NULL DEFAULT 1,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `prompts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `prompts_workspace_sort_idx` ON `prompts` (`workspace_id`,`sort_order`);
--> statement-breakpoint
CREATE TABLE `competitors` (
	`id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`name` varchar(200) NOT NULL,
	`domain` varchar(255) NOT NULL,
	`mark` varchar(8) NOT NULL DEFAULT '',
	`color` varchar(16) NOT NULL DEFAULT '',
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `competitors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `competitors_workspace_sort_idx` ON `competitors` (`workspace_id`,`sort_order`);
--> statement-breakpoint
CREATE UNIQUE INDEX `competitors_workspace_domain_unique` ON `competitors` (`workspace_id`,`domain`);
--> statement-breakpoint
CREATE TABLE `onboarding_sessions` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`version` tinyint NOT NULL DEFAULT 1,
	`screen` varchar(32) NOT NULL,
	`processing_index` int NOT NULL DEFAULT 0,
	`tour_index` int NOT NULL DEFAULT 0,
	`draft_json` json NOT NULL,
	`completed_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `onboarding_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `onboarding_sessions_user_id_idx` ON `onboarding_sessions` (`user_id`);
