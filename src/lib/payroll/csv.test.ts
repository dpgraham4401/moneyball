import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parsePayrollCsv, toCents, toIsoDate } from "@/lib/payroll/csv";

const HEADER =
  "employee_name,employee_id,level,occupation,week_ending," +
  "mon_st_hours,tue_st_hours,wed_st_hours,thu_st_hours,fri_st_hours,sat_st_hours,sun_st_hours," +
  "mon_ot_hours,tue_ot_hours,wed_ot_hours,thu_ot_hours,fri_ot_hours,sat_ot_hours,sun_ot_hours," +
  "standard_rate,overtime_rate,benefits_rate";
const HOURS = "8,8,8,8,8,0,0,1,0,0,0,0,0,0";
const csv = (...rows: string[]) => [HEADER, ...rows].join("\n");

describe("parsePayrollCsv", () => {
  it("parses the provided dataset with no rejections", () => {
    const { records, rejected, fileError } = parsePayrollCsv(
      readFileSync("data/payroll_data.csv", "utf8"),
      "payroll_data.csv"
    );
    expect(fileError).toBeUndefined();
    expect(rejected).toEqual([]);
    expect(records).toHaveLength(263);
    expect(new Set(records.map((record) => record.employeeId)).size).toBe(23);
    // Line 40: a known rate spike, kept as data for anomaly detection to flag.
    expect(records.find((record) => record.ref === "payroll_data.csv:40")).toMatchObject({
      employeeName: "Kamille O'Reilly",
      weekEnding: "2025-03-15",
      standardRateCents: 8857,
    });
  });

  it("maps the 14 wide hour columns into 7 days", () => {
    const { records } = parsePayrollCsv(
      csv(`Ana,1,APPRENTICE,Mason,03/01/2025,${HOURS},27.05,40.58,12.17`)
    );
    expect(records[0].days).toHaveLength(7);
    expect(records[0].days[0]).toEqual({ day: "mon", standard: 8, overtime: 1 });
    expect(records[0].days[6]).toEqual({ day: "sun", standard: 0, overtime: 0 });
    expect(records[0]).toMatchObject({ level: "APPRENTICE", standardRateCents: 2705 });
  });

  it("rejects structurally bad rows with a source ref and keeps the rest", () => {
    const { records, rejected } = parsePayrollCsv(
      csv(
        `Ana,1,APPRENTICE,Mason,03/01/2025,${HOURS},27.05,40.58,12.17`,
        `Bob,2,FOREMAN,Mason,03/01/2025,${HOURS},27.05,40.58,12.17`,
        `Cal,3,APPRENTICE,Mason,02/30/2025,${HOURS},27.05,40.58,12.17`,
        `Dee,4,APPRENTICE,Mason,03/01/2025,${HOURS},-1,40.58,12.17`
      ),
      "test.csv"
    );
    expect(records.map((record) => record.employeeName)).toEqual(["Ana"]);
    expect(rejected.map((rejection) => rejection.ref)).toEqual([
      "test.csv:3",
      "test.csv:4",
      "test.csv:5",
    ]);
    expect(rejected[0].reason).toMatch(/level/);
    expect(rejected[1].reason).toMatch(/does not exist/);
    expect(rejected[2].reason).toMatch(/standard_rate/);
  });

  it("fails the whole file when columns are missing", () => {
    expect(parsePayrollCsv("employee_name,employee_id\nAna,1\n").fileError).toMatch(/level/);
  });
});

describe("converters", () => {
  it("toCents is exact and strict", () => {
    expect(toCents("$1,234.5", "x")).toBe(123450);
    expect(toCents("0.29", "x")).toBe(29);
    for (const bad of ["", "-1", "1.234", "abc"]) expect(() => toCents(bad, "x")).toThrow();
  });

  it("toIsoDate takes MM/DD/YYYY", () => {
    expect(toIsoDate("03/01/2025")).toBe("2025-03-01");
    expect(() => toIsoDate("13/01/2025")).toThrow();
  });
});
