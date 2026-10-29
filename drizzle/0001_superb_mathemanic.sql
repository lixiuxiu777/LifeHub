CREATE TABLE `lifehub_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`digest` text NOT NULL,
	`label` text NOT NULL,
	`before_json` text,
	`after_json` text,
	`result_id` text,
	`created_at` text NOT NULL,
	`ordinal` integer NOT NULL,
	`undone` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `operations_owner_ordinal` ON `lifehub_operations` (`owner_id`,`ordinal`);