ALTER TABLE `employees` RENAME COLUMN "external_id" TO "payroll_id";--> statement-breakpoint
DROP INDEX `employees_externalId_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `employees_payrollId_unique` ON `employees` (`payroll_id`);