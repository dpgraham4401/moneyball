import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parsePayrollCsv } from "@/lib/payroll/csv";
import { employeeStats, summarize } from "@/lib/payroll/stats";
import { makeRecord } from "@/lib/payroll/make-record";

// Hand-checked fixture: Ana works 2 weeks (one spelled differently), Bob 1 week.
const records = [
  makeRecord({
    hours: [
      [8, 2],
      [8, 0],
      [8, 0],
      [8, 0],
      [8, 0],
    ],
  }), // 40 st + 2 ot
  makeRecord({ weekEnding: "2025-03-08", employeeName: "Ana Smyth", hours: [[4, 0]] }),
  makeRecord({
    employeeId: "2",
    employeeName: "Bob Jones",
    level: "JOURNEYWORKER",
    standardRateCents: 5000,
    overtimeRateCents: 7500,
    benefitsRateCents: 1500,
    hours: [
      [6, 0],
      [6, 0],
      [6, 0],
      [6, 0],
      [6, 0],
    ],
  }),
];

describe("summarize", () => {
  const summary = summarize(records);

  it("counts people, weeks, and hours", () => {
    expect(summary).toMatchObject({
      recordCount: 3,
      employeeCount: 2,
      apprenticeCount: 1,
      firstWeek: "2025-03-01",
      lastWeek: "2025-03-08",
      weekCount: 2,
      standardHours: 74,
      overtimeHours: 2,
      totalHours: 76,
    });
    expect(summary.apprenticeHoursShare).toBeCloseTo(46 / 76);
  });

  it("totals spend in whole cents and hours-weights the average rates", () => {
    // Ana wk1: 40×2705 + 2×4058 = 116316 wages, 42×1217 = 51114 benefits
    // Ana wk2: 4×2705 = 10820, 4×1217 = 4868. Bob: 30×5000 = 150000, 30×1500 = 45000
    expect(summary.wagesCents).toBe(277136);
    expect(summary.benefitsCents).toBe(100982);
    expect(summary.totalSpendCents).toBe(378118);
    expect(summary.avgStandardRateCents).toBeCloseTo((2705 * 44 + 5000 * 30) / 74);
    expect(summary.avgOvertimeRateCents).toBe(4058);
  });

  it("handles no records", () => {
    expect(summarize([])).toMatchObject({
      employeeCount: 0,
      totalHours: 0,
      apprenticeHoursShare: 0,
    });
  });
});

describe("employeeStats", () => {
  const [ana, bob] = employeeStats(records);

  it("aggregates per employee over days actually worked", () => {
    expect(ana).toMatchObject({
      employeeId: "1",
      employeeName: "Ana Smith", // tie → first seen
      nameVariants: ["Ana Smith", "Ana Smyth"],
      weeksWorked: 2,
      daysWorked: 6,
      totalHours: 46,
      overtimeHours: 2,
      totalSpendCents: 116316 + 51114 + 10820 + 4868,
    });
    expect(ana.hoursPerDay).toEqual({ min: 4, max: 10, avg: 46 / 6 });
    expect(bob.standardRateCents).toEqual({ min: 5000, max: 5000, avg: 5000 });
  });

  it("covers every employee in the provided dataset", () => {
    const { records } = parsePayrollCsv(readFileSync("data/payroll_data.csv", "utf8"));
    const stats = employeeStats(records);
    expect(stats).toHaveLength(23);
    expect(stats.find((employee) => employee.employeeId === "1021")?.nameVariants).toContain(
      "Deanna Wisozk"
    );
  });
});
