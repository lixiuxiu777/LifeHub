CREATE TABLE `lifehub_life_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`digest` text NOT NULL,
	`result_id` text NOT NULL,
	`created_at` text NOT NULL
);
