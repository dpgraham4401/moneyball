import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { detectAnomalies, median } from "@/lib/payroll/anomalies";
import { parsePayrollCsv } from "@/lib/payroll/csv";
import { makeRecord } from "@/lib/payroll/make-record";
import type { PayrollRecord } from "@/lib/payroll/types";

const NORMAL_WEEK: [number, number][] = [
  [8, 0],
  [8, 0],
  [8, 0],
  [8, 0],
  [8, 0],
];

/** Four ordinary weeks for one employee, so the median baseline is well defined. */
function normalWeeks(): PayrollRecord[] {
  return ["2025-03-01", "2025-03-08", "2025-03-15", "2025-03-22"].map((weekEnding) =>
    makeRecord({ weekEnding, ref: `row-${weekEnding}`, hours: NORMAL_WEEK })
  );
}

const rulesFor = (records: PayrollRecord[], ref: string) =>
  detectAnomalies(records)
    .filter((anomaly) => anomaly.ref === ref)
    .map((anomaly) => anomaly.rule);

describe("detectAnomalies", () => {
  it("finds nothing in ordinary data", () => {
    expect(detectAnomalies(normalWeeks())).toEqual([]);
  });

  it("flags a rate far from the employee's own median", () => {
    const spike = makeRecord({
      ref: "spike",
      weekEnding: "2025-03-29",
      standardRateCents: 8857,
      overtimeRateCents: 13286,
      hours: NORMAL_WEEK,
    });
    const [anomaly] = detectAnomalies([...normalWeeks(), spike]);
    expect(anomaly).toMatchObject({
      ref: "spike",
      rule: "standard-rate-deviation",
      severity: "high",
    });
    expect(anomaly.message).toBe("Standard rate $88.57 is 227% above their usual $27.05");
  });

  it("flags long and short days and weeks", () => {
    const longDay = makeRecord({ ref: "long-day", hours: [[12, 8.4]] });
    const longWeek = makeRecord({ ref: "long-week", hours: Array(7).fill([9, 4]) });
    const shortDay = makeRecord({ ref: "short-day", hours: [...NORMAL_WEEK, [2, 0]] });
    const shortWeek = makeRecord({ ref: "short-week", hours: [[8, 0]] });
    expect(rulesFor([longDay], "long-day")).toEqual(["long-day"]);
    expect(rulesFor([longWeek], "long-week")).toEqual(["long-week"]); // 13h/day is under 14
    expect(rulesFor([shortDay], "short-day")).toEqual(["short-day"]);
    expect(rulesFor([shortWeek], "short-week")).toEqual(["short-week"]);
  });

  it("flags overtime not at 1.5× and a wrong week-ending day", () => {
    const record = makeRecord({
      ref: "odd",
      weekEnding: "2025-03-03", // a Monday
      overtimeRateCents: 3000,
      hours: NORMAL_WEEK,
    });
    expect(rulesFor([record], "odd")).toEqual([
      "overtime-rate-mismatch",
      "week-ending-not-saturday",
    ]);
  });

  it("flags a name that differs from the ID's usual name, and duplicate weeks", () => {
    const records = [
      ...normalWeeks(),
      makeRecord({
        ref: "typo",
        weekEnding: "2025-03-29",
        employeeName: "Ana Smyth",
        hours: NORMAL_WEEK,
      }),
      makeRecord({ ref: "dupe", weekEnding: "2025-03-01", hours: NORMAL_WEEK }),
    ];
    expect(rulesFor(records, "typo")).toEqual(["name-mismatch"]);
    expect(rulesFor(records, "dupe")).toEqual(["duplicate-week"]);
  });

  it("finds exactly the planted high-severity errors in the provided dataset", () => {
    const { records } = parsePayrollCsv(
      readFileSync("data/payroll_data.csv", "utf8"),
      "payroll_data.csv"
    );
    const highRows = detectAnomalies(records)
      .filter((anomaly) => anomaly.severity === "high")
      .map((anomaly) => Number(anomaly.ref.split(":")[1]))
      .sort((left, right) => left - right);
    // Rate spikes/drops: 40, 137, 138, 145, 176, 201. ~87h weeks: 20, 104, 154, 245.
    // ~20h days: 46, 116, 117, 262.
    expect(highRows).toEqual([20, 40, 46, 104, 116, 117, 137, 138, 145, 154, 176, 201, 245, 262]);
  });
});

describe("median", () => {
  it("handles odd and even lengths", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});
