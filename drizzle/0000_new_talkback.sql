CREATE TABLE `lifehub_records` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`type` text NOT NULL,
	`data` text NOT NULL,
	`parent_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`version` integer NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `lifehub_records`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `records_owner_type` ON `lifehub_records` (`owner_id`,`type`);--> statement-breakpoint
CREATE UNIQUE INDEX `one_dashboard_per_owner` ON `lifehub_records` (`owner_id`) WHERE "lifehub_records"."type" = 'DashboardPreference';--> statement-breakpoint
CREATE UNIQUE INDEX `one_checkin_per_day` ON `lifehub_records` (`owner_id`,json_extract(data,'$.habitId'),json_extract(data,'$.date')) WHERE type = 'HabitCheckIn';--> statement-breakpoint
CREATE UNIQUE INDEX `one_budget_per_month_currency` ON `lifehub_records` (`owner_id`,json_extract(data,'$.month'),json_extract(data,'$.currency')) WHERE type = 'Budget';--> statement-breakpoint
CREATE TABLE `lifehub_restore_guard` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`valid` integer NOT NULL,
	CONSTRAINT "valid_restore_revision" CHECK("lifehub_restore_guard"."valid" = 1)
);
--> statement-breakpoint
CREATE TABLE `lifehub_revisions` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER lifehub_insert_revision AFTER INSERT ON lifehub_records BEGIN
  INSERT INTO lifehub_revisions(owner_id,revision) VALUES(NEW.owner_id,1)
  ON CONFLICT(owner_id) DO UPDATE SET revision=revision+1;
END;
--> statement-breakpoint
CREATE TRIGGER lifehub_update_revision AFTER UPDATE ON lifehub_records BEGIN
  INSERT INTO lifehub_revisions(owner_id,revision) VALUES(NEW.owner_id,1)
  ON CONFLICT(owner_id) DO UPDATE SET revision=revision+1;
END;
--> statement-breakpoint
CREATE TRIGGER lifehub_delete_revision AFTER DELETE ON lifehub_records BEGIN
  INSERT INTO lifehub_revisions(owner_id,revision) VALUES(OLD.owner_id,1)
  ON CONFLICT(owner_id) DO UPDATE SET revision=revision+1;
END;
