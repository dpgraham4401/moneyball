import { asc, eq } from "drizzle-orm";
import type { Database } from "@/db";
import {
  dayHours,
  employees,
  importRejections,
  payrollImports,
  payrollWeeks,
  projects,
} from "@/db/schema";
import { WEEKDAYS, type ParseResult, type PayrollRecord } from "@/lib/payroll/types";

/**
 * Rebuilds a project's payroll from the database in the same shape the CSV parser returns,
 * so stats, anomaly checks, and the dashboard don't know which source they're reading.
 */
export async function readPayrollData(db: Database, projectSlug: string): Promise<ParseResult> {
  const weeks = await db
    .select({
      id: payrollWeeks.id,
      employeeId: employees.externalId,
      employeeName: payrollWeeks.nameAsRecorded,
      level: payrollWeeks.level,
      occupation: payrollWeeks.occupation,
      weekEnding: payrollWeeks.weekEnding,
      standardRateCents: payrollWeeks.standardRateCents,
      overtimeRateCents: payrollWeeks.overtimeRateCents,
      benefitsRateCents: payrollWeeks.benefitsRateCents,
    })
    .from(payrollWeeks)
    .innerJoin(projects, eq(projects.id, payrollWeeks.projectId))
    .innerJoin(employees, eq(employees.id, payrollWeeks.employeeId))
    .where(eq(projects.slug, projectSlug))
    .orderBy(asc(payrollWeeks.id)); // import order, matching the source file

  const days = await db
    .select({
      payrollWeekId: dayHours.payrollWeekId,
      weekday: dayHours.weekday,
      standard: dayHours.standardHours,
      overtime: dayHours.overtimeHours,
    })
    .from(dayHours)
    .innerJoin(payrollWeeks, eq(payrollWeeks.id, dayHours.payrollWeekId))
    .innerJoin(projects, eq(projects.id, payrollWeeks.projectId))
    .where(eq(projects.slug, projectSlug));
  const daysByWeek = Map.groupBy(days, (day) => day.payrollWeekId);

  const records: PayrollRecord[] = weeks.map(({ id, ...week }) => {
    const hoursByWeekday = new Map((daysByWeek.get(id) ?? []).map((day) => [day.weekday, day]));
    return {
      ...week,
      ref: `payroll_weeks:${id}`, // the database row, replacing the CSV's file:line
      days: WEEKDAYS.map((weekday, index) => ({
        day: weekday,
        standard: hoursByWeekday.get(index)?.standard ?? 0,
        overtime: hoursByWeekday.get(index)?.overtime ?? 0,
      })),
    };
  });

  const rejections = await db
    .select({
      fileName: payrollImports.fileName,
      sourceLine: importRejections.sourceLine,
      reason: importRejections.reason,
    })
    .from(importRejections)
    .innerJoin(payrollImports, eq(payrollImports.id, importRejections.importId))
    .innerJoin(projects, eq(projects.id, payrollImports.projectId))
    .where(eq(projects.slug, projectSlug))
    .orderBy(asc(importRejections.id));

  return {
    records,
    rejected: rejections.map((rejection) => ({
      ref: `${rejection.fileName}:${rejection.sourceLine}`,
      reason: rejection.reason,
    })),
    fileError: records.length
      ? undefined
      : "No payroll imported for this project yet. Run `pnpm db:seed`.",
  };
}
