import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

// SQLite schema: runs locally on a libsql file and deploys unchanged to Cloudflare D1 (or Turso).
// Column names are inferred from the keys and stored as snake_case (see `casing` in drizzle.config.ts).
// SQLite has no enum/date/decimal types, so those are text/integer/real with CHECK constraints.

const LEVELS = ["APPRENTICE", "JOURNEYWORKER"] as const;

const createdAt = () =>
  integer({ mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`);

export const projects = sqliteTable("projects", {
  id: integer().primaryKey({ autoIncrement: true }),
  slug: text().notNull().unique(), // used in URLs, e.g. "my-project"
  name: text().notNull(),
  createdAt: createdAt(),
});

/** A person, independent of any project (workers move between jobs). */
export const employees = sqliteTable("employees", {
  id: integer().primaryKey({ autoIncrement: true }),
  externalId: text().notNull().unique(), // employee_id from payroll, e.g. "1021"
  name: text().notNull(), // canonical (most frequent) spelling
});

/** One uploaded payroll file. The raw CSV is kept so findings can always be recomputed. */
export const payrollImports = sqliteTable(
  "payroll_imports",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    projectId: integer()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    fileName: text().notNull(),
    sha256: text().notNull(),
    rawCsv: text().notNull(),
    importedAt: createdAt(),
  },
  // Importing the identical file twice into a project is a no-op.
  (table) => [unique().on(table.projectId, table.sha256)]
);

/** Rows in an import that couldn't be parsed, with why. */
export const importRejections = sqliteTable("import_rejections", {
  id: integer().primaryKey({ autoIncrement: true }),
  importId: integer()
    .notNull()
    .references(() => payrollImports.id, { onDelete: "cascade" }),
  sourceLine: integer().notNull(),
  reason: text().notNull(),
});

/**
 * One employee's pay line for one week (= PayrollRecord). Level and trade are per week because
 * they can change. No unique (project, employee, week): duplicates are stored so the
 * duplicate-week check can surface them rather than the import hiding them.
 */
export const payrollWeeks = sqliteTable(
  "payroll_weeks",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    projectId: integer()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    importId: integer()
      .notNull()
      .references(() => payrollImports.id, { onDelete: "cascade" }),
    employeeId: integer()
      .notNull()
      .references(() => employees.id),
    nameAsRecorded: text().notNull(), // keeps typos visible for the name-mismatch check
    level: text({ enum: LEVELS }).notNull(),
    occupation: text().notNull(),
    weekEnding: text().notNull(), // YYYY-MM-DD
    standardRateCents: integer().notNull(),
    overtimeRateCents: integer().notNull(),
    benefitsRateCents: integer().notNull(),
    sourceLine: integer(), // line in the imported file, for tracing a finding back
  },
  (table) => [
    index("payroll_weeks_project_week_idx").on(table.projectId, table.weekEnding),
    index("payroll_weeks_employee_idx").on(table.employeeId),
    check("payroll_weeks_level_valid", sql`${table.level} IN ('APPRENTICE', 'JOURNEYWORKER')`),
    check(
      "payroll_weeks_week_ending_iso",
      sql`${table.weekEnding} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`
    ),
    check(
      "payroll_weeks_rates_non_negative",
      sql`${table.standardRateCents} >= 0 AND ${table.overtimeRateCents} >= 0 AND ${table.benefitsRateCents} >= 0`
    ),
  ]
);

/**
 * The 14 wide CSV hour columns as 7 rows. Weekday, not a date: Sunday's date is ambiguous.
 * Hours are REAL: inputs have one decimal and are only rounded for display.
 */
export const dayHours = sqliteTable(
  "day_hours",
  {
    payrollWeekId: integer()
      .notNull()
      .references(() => payrollWeeks.id, { onDelete: "cascade" }),
    weekday: integer().notNull(), // 0 = Monday … 6 = Sunday
    standardHours: real().notNull(),
    overtimeHours: real().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.payrollWeekId, table.weekday] }),
    check("day_hours_weekday_range", sql`${table.weekday} BETWEEN 0 AND 6`),
    check(
      "day_hours_hours_range",
      sql`${table.standardHours} BETWEEN 0 AND 24 AND ${table.overtimeHours} BETWEEN 0 AND 24`
    ),
  ]
);
