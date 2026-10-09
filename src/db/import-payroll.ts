import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Database } from "@/db";
import {
  dayHours,
  employees,
  importRejections,
  payrollImports,
  payrollWeeks,
  projects,
} from "@/db/schema";
import { parsePayrollCsv } from "@/lib/payroll/csv";
import { WEEKDAYS, type PayrollRecord } from "@/lib/payroll/types";

export type ImportResult =
  | { status: "imported"; importId: number; weeks: number; rejected: number }
  | { status: "already-imported"; importId: number }
  | { status: "failed"; reason: string };

// ponytail: Cloudflare D1 caps bound parameters at 100 per statement; chunking keeps every insert
// under that, so this works unchanged on D1 (also needs db.batch instead of a transaction there).
const MAX_PARAMETERS_PER_STATEMENT = 100;

function chunk<Row>(rows: Row[], columnsPerRow: number): Row[][] {
  const size = Math.max(1, Math.floor(MAX_PARAMETERS_PER_STATEMENT / columnsPerRow));
  return Array.from({ length: Math.ceil(rows.length / size) }, (_, index) =>
    rows.slice(index * size, (index + 1) * size)
  );
}

/** The CSV adapter's refs are "file:line"; keep the line so findings can point back to the file. */
const sourceLineFromRef = (ref: string) => Number(ref.split(":").at(-1)) || null;

/** Most frequent spelling per employee ID in this file, used as the canonical name. */
function canonicalNames(records: PayrollRecord[]) {
  const recordsByEmployee = Map.groupBy(records, (record) => record.employeeId);
  return new Map(
    [...recordsByEmployee].map(([employeeId, employeeRecords]) => {
      const recordsByName = Map.groupBy(employeeRecords, (record) => record.employeeName);
      const [mostFrequentName] = [...recordsByName].sort(
        ([, recordsA], [, recordsB]) => recordsB.length - recordsA.length
      )[0];
      return [employeeId, mostFrequentName];
    })
  );
}

/**
 * Imports one payroll CSV into a project, creating the project if needed. Idempotent: the same
 * file (by sha256) imported twice into a project is skipped. Rejected rows are stored, not dropped.
 * Used by the seed script today and reusable for an upload feature.
 */
export async function importPayrollCsv(
  db: Database,
  input: { projectSlug: string; projectName: string; fileName: string; csvText: string }
): Promise<ImportResult> {
  const parsed = parsePayrollCsv(input.csvText, input.fileName);
  if (parsed.fileError) return { status: "failed", reason: parsed.fileError };
  const sha256 = createHash("sha256").update(input.csvText).digest("hex");

  return db.transaction(async (transaction) => {
    const [project] = await transaction
      .insert(projects)
      .values({ slug: input.projectSlug, name: input.projectName })
      .onConflictDoUpdate({ target: projects.slug, set: { slug: input.projectSlug } })
      .returning({ id: projects.id });

    const [existingImport] = await transaction
      .select({ id: payrollImports.id })
      .from(payrollImports)
      .where(and(eq(payrollImports.projectId, project.id), eq(payrollImports.sha256, sha256)));
    if (existingImport) return { status: "already-imported", importId: existingImport.id };

    const [payrollImport] = await transaction
      .insert(payrollImports)
      .values({ projectId: project.id, fileName: input.fileName, sha256, rawCsv: input.csvText })
      .returning({ id: payrollImports.id });

    for (const rejections of chunk(parsed.rejected, 3)) {
      await transaction.insert(importRejections).values(
        rejections.map((rejection) => ({
          importId: payrollImport.id,
          sourceLine: sourceLineFromRef(rejection.ref) ?? 0,
          reason: rejection.reason,
        }))
      );
    }

    // Employees are shared across projects: insert new IDs, keep existing canonical names.
    const employeeIdByExternalId = new Map<string, number>();
    const employeeRows = [...canonicalNames(parsed.records)].map(([externalId, name]) => ({
      externalId,
      name,
    }));
    for (const rows of chunk(employeeRows, 2)) {
      const inserted = await transaction
        .insert(employees)
        .values(rows)
        .onConflictDoUpdate({
          target: employees.externalId,
          set: { externalId: employees.externalId },
        })
        .returning({ id: employees.id, externalId: employees.externalId });
      for (const employee of inserted) employeeIdByExternalId.set(employee.externalId, employee.id);
    }

    for (const records of chunk(parsed.records, 11)) {
      const insertedWeeks = await transaction
        .insert(payrollWeeks)
        .values(
          records.map((record) => ({
            projectId: project.id,
            importId: payrollImport.id,
            employeeId: employeeIdByExternalId.get(record.employeeId)!,
            nameAsRecorded: record.employeeName,
            level: record.level,
            occupation: record.occupation,
            weekEnding: record.weekEnding,
            standardRateCents: record.standardRateCents,
            overtimeRateCents: record.overtimeRateCents,
            benefitsRateCents: record.benefitsRateCents,
            sourceLine: sourceLineFromRef(record.ref),
          }))
        )
        .returning({ id: payrollWeeks.id });

      const dayRows = records.flatMap((record, recordIndex) =>
        record.days.map((day) => ({
          payrollWeekId: insertedWeeks[recordIndex].id,
          weekday: WEEKDAYS.indexOf(day.day),
          standardHours: day.standard,
          overtimeHours: day.overtime,
        }))
      );
      for (const rows of chunk(dayRows, 4)) await transaction.insert(dayHours).values(rows);
    }

    return {
      status: "imported",
      importId: payrollImport.id,
      weeks: parsed.records.length,
      rejected: parsed.rejected.length,
    };
  });
}
