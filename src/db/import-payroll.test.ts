import { readFileSync } from "node:fs";
import { count, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, type Database } from "@/db";
import { importPayrollCsv } from "@/db/import-payroll";
import { readPayrollData } from "@/db/read-payroll";
import { parsePayrollCsv } from "@/lib/payroll/csv";
import type { PayrollRecord } from "@/lib/payroll/types";
import { dayHours, employees, importRejections, payrollWeeks, projects } from "@/db/schema";

const csvText = readFileSync("data/payroll_data.csv", "utf8");
const importDataset = (db: Database, text = csvText) =>
  importPayrollCsv(db, {
    projectSlug: "my-project",
    projectName: "My project",
    fileName: "data/payroll_data.csv",
    csvText: text,
  });
const countRows = async (db: Database, table: SQLiteTable) =>
  (await db.select({ rows: count() }).from(table))[0].rows;

describe("importPayrollCsv", () => {
  let db: Database;
  beforeEach(async () => {
    db = createDb(":memory:"); // fresh database per test, built from the real migrations
    await migrate(db, { migrationsFolder: "drizzle" });
  });

  it("imports the dataset into normalized tables", async () => {
    expect(await importDataset(db)).toMatchObject({ status: "imported", weeks: 263, rejected: 0 });
    expect(await countRows(db, projects)).toBe(1);
    expect(await countRows(db, employees)).toBe(23);
    expect(await countRows(db, payrollWeeks)).toBe(263);
    expect(await countRows(db, dayHours)).toBe(263 * 7);

    // Typos are kept per week; the employee keeps the most frequent spelling.
    const [zander] = await db.select().from(employees).where(eq(employees.externalId, "1021"));
    expect(zander.name).toBe("Zander Wisozk");
    const names = await db
      .selectDistinct({ name: payrollWeeks.nameAsRecorded })
      .from(payrollWeeks)
      .where(eq(payrollWeeks.employeeId, zander.id));
    expect(names.map((row) => row.name).sort()).toEqual(["Deanna Wisozk", "Zander Wisozk"]);
  });

  it("skips a file that was already imported into the project", async () => {
    const first = await importDataset(db);
    expect(await importDataset(db)).toEqual({
      status: "already-imported",
      importId: first.status === "imported" ? first.importId : -1,
    });
    expect(await countRows(db, payrollWeeks)).toBe(263);
  });

  it("stores rejected rows and reports a missing column without writing", async () => {
    const withBadRow = `${csvText.trimEnd()}\nBad Row,9999,FOREMAN,Mason,03/01/2025,8,8,8,8,8,0,0,0,0,0,0,0,0,0,30,45,10\n`;
    expect(await importDataset(db, withBadRow)).toMatchObject({ status: "imported", rejected: 1 });
    expect(await countRows(db, importRejections)).toBe(1);

    expect(await importDataset(db, "employee_name,employee_id\nAna,1\n")).toMatchObject({
      status: "failed",
    });
  });

  it("reads back exactly what the CSV parser produced (only refs differ)", async () => {
    await importDataset(db);
    const fromDatabase = await readPayrollData(db, "my-project");
    const fromCsv = parsePayrollCsv(csvText, "data/payroll_data.csv");
    const withoutRef = (record: PayrollRecord) => ({ ...record, ref: undefined });
    expect(fromDatabase.records.map(withoutRef)).toEqual(fromCsv.records.map(withoutRef));
    expect(fromDatabase.records[0].ref).toMatch(/^payroll_weeks:\d+$/);
    expect(fromDatabase.fileError).toBeUndefined();
  });

  it("reports an empty project instead of failing", async () => {
    expect((await readPayrollData(db, "my-project")).fileError).toMatch(/db:seed/);
  });
});
