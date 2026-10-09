CREATE TABLE `day_hours` (
	`payroll_week_id` integer NOT NULL,
	`weekday` integer NOT NULL,
	`standard_hours` real NOT NULL,
	`overtime_hours` real NOT NULL,
	PRIMARY KEY(`payroll_week_id`, `weekday`),
	FOREIGN KEY (`payroll_week_id`) REFERENCES `payroll_weeks`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "day_hours_weekday_range" CHECK("day_hours"."weekday" BETWEEN 0 AND 6),
	CONSTRAINT "day_hours_hours_range" CHECK("day_hours"."standard_hours" BETWEEN 0 AND 24 AND "day_hours"."overtime_hours" BETWEEN 0 AND 24)
);
--> statement-breakpoint
CREATE TABLE `employees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`external_id` text NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employees_externalId_unique` ON `employees` (`external_id`);--> statement-breakpoint
CREATE TABLE `import_rejections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`import_id` integer NOT NULL,
	`source_line` integer NOT NULL,
	`reason` text NOT NULL,
	FOREIGN KEY (`import_id`) REFERENCES `payroll_imports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `payroll_imports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`file_name` text NOT NULL,
	`sha256` text NOT NULL,
	`raw_csv` text NOT NULL,
	`imported_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payroll_imports_projectId_sha256_unique` ON `payroll_imports` (`project_id`,`sha256`);--> statement-breakpoint
CREATE TABLE `payroll_weeks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`import_id` integer NOT NULL,
	`employee_id` integer NOT NULL,
	`name_as_recorded` text NOT NULL,
	`level` text NOT NULL,
	`occupation` text NOT NULL,
	`week_ending` text NOT NULL,
	`standard_rate_cents` integer NOT NULL,
	`overtime_rate_cents` integer NOT NULL,
	`benefits_rate_cents` integer NOT NULL,
	`source_line` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`import_id`) REFERENCES `payroll_imports`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "payroll_weeks_level_valid" CHECK("payroll_weeks"."level" IN ('APPRENTICE', 'JOURNEYWORKER')),
	CONSTRAINT "payroll_weeks_week_ending_iso" CHECK("payroll_weeks"."week_ending" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "payroll_weeks_rates_non_negative" CHECK("payroll_weeks"."standard_rate_cents" >= 0 AND "payroll_weeks"."overtime_rate_cents" >= 0 AND "payroll_weeks"."benefits_rate_cents" >= 0)
);
--> statement-breakpoint
CREATE INDEX `payroll_weeks_project_week_idx` ON `payroll_weeks` (`project_id`,`week_ending`);--> statement-breakpoint
CREATE INDEX `payroll_weeks_employee_idx` ON `payroll_weeks` (`employee_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_slug_unique` ON `projects` (`slug`);