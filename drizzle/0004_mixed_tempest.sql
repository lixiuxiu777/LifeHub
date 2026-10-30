CREATE TABLE `lifehub_backup_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`scope` text NOT NULL,
	`mode` text NOT NULL,
	`digest` text NOT NULL,
	`expected_revision` integer NOT NULL,
	`summary` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text
);
--> statement-breakpoint
CREATE INDEX `backup_plans_owner_expiry` ON `lifehub_backup_plans` (`owner_id`,`expires_at`);