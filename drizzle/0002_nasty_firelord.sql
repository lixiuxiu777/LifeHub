CREATE TABLE `lifehub_finance_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`digest` text NOT NULL,
	`result_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
DROP INDEX `one_budget_per_month_currency`;--> statement-breakpoint
CREATE UNIQUE INDEX `one_budget_per_scope` ON `lifehub_records` (`owner_id`,json_extract("data", '$.month'),json_extract("data", '$.currency'),coalesce(json_extract("data", '$.category'), '')) WHERE "lifehub_records"."type" = 'Budget';
