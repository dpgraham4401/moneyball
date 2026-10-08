import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { detectAnomalies, median } from "@/lib/payroll/anomalies";
import { parsePayrollCsv } from "@/lib/payroll/csv";
import { makeRecord } from "@/lib/payroll/make-record";
import type { PayrollRecord } from "@/lib/payroll/types";

/** Journeyworker by default, so the apprentice-ratio rule stays quiet unless a test opts in. */
const journeyworkerRecord = (fields: Parameters<typeof makeRecord>[0]) =>
  makeRecord({ level: "JOURNEYWORKER", ...fields });

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
    journeyworkerRecord({ weekEnding, ref: `row-${weekEnding}`, hours: NORMAL_WEEK })
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
    const spike = journeyworkerRecord({
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
    const longDay = journeyworkerRecord({ ref: "long-day", hours: [[12, 8.4]] });
    const longWeek = journeyworkerRecord({ ref: "long-week", hours: Array(7).fill([9, 4]) });
    // 4 full days + a 2h day = 34h: short day, but not a short week or over 40 standard.
    const shortDay = journeyworkerRecord({
      ref: "short-day",
      hours: [...NORMAL_WEEK.slice(0, 4), [2, 0]],
    });
    const shortWeek = journeyworkerRecord({ ref: "short-week", hours: [[8, 0]] });
    expect(rulesFor([longDay], "long-day")).toEqual(["long-day"]);
    expect(rulesFor([longWeek], "long-week")).toContain("long-week"); // 13h/day is under 14
    expect(rulesFor([shortDay], "short-day")).toEqual(["short-day"]);
    expect(rulesFor([shortWeek], "short-week")).toEqual(["short-week"]);
  });

  it("flags overtime not at 1.5× and a wrong week-ending day", () => {
    const record = journeyworkerRecord({
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
      journeyworkerRecord({
        ref: "typo",
        weekEnding: "2025-03-29",
        employeeName: "Ana Smyth",
        hours: NORMAL_WEEK,
      }),
      journeyworkerRecord({ ref: "dupe", weekEnding: "2025-03-01", hours: NORMAL_WEEK }),
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

describe("new checks", () => {
  it("skips rate checks until there are enough weeks for a baseline", () => {
    const twoWeeks = [
      journeyworkerRecord({ ref: "normal", hours: NORMAL_WEEK }),
      journeyworkerRecord({
        ref: "spike",
        weekEnding: "2025-03-08",
        standardRateCents: 8857,
        overtimeRateCents: 13286,
        hours: NORMAL_WEEK,
      }),
    ];
    // With two weeks the median sits halfway, so both would look ~50% off; neither is flagged.
    expect(detectAnomalies(twoWeeks)).toEqual([]);
  });

  it("flags more than 40 standard hours in a week", () => {
    const record = journeyworkerRecord({ ref: "long-standard", hours: [...NORMAL_WEEK, [6, 0]] });
    const [anomaly] = detectAnomalies([record]);
    expect(anomaly).toMatchObject({ rule: "standard-hours-over-40", severity: "medium" });
    expect(anomaly.message).toMatch(/^46h standard hours/);
  });

  it("flags apprentices outnumbering journeyworkers of the same trade on a day", () => {
    const records = [
      makeRecord({
        ref: "apprentice-a",
        employeeId: "a",
        hours: [
          [8, 0],
          [8, 0],
        ],
      }),
      makeRecord({ ref: "apprentice-b", employeeId: "b", hours: [[8, 0]] }),
      journeyworkerRecord({
        ref: "journeyworker",
        employeeId: "j",
        hours: [
          [8, 0],
          [8, 0],
        ],
      }),
    ];
    // Mon: 2 apprentices to 1 journeyworker (over 1:1). Tue: 1:1 (fine).
    const ratioFindings = detectAnomalies(records).filter(
      (anomaly) => anomaly.rule === "apprentice-ratio"
    );
    expect(ratioFindings.map((anomaly) => anomaly.ref).sort()).toEqual([
      "apprentice-a",
      "apprentice-b",
    ]);
    expect(ratioFindings[0].message).toContain("on mon (2:1)");
    expect(ratioFindings[0].message).not.toContain("tue");
  });

  it("only counts journeyworkers of the same trade", () => {
    const records = [
      makeRecord({ ref: "apprentice", employeeId: "a", occupation: "Mason", hours: [[8, 0]] }),
      journeyworkerRecord({ employeeId: "j", occupation: "Painter", hours: [[8, 0]] }),
    ];
    // A painter doesn't count as supervision for a mason apprentice.
    expect(rulesFor(records, "apprentice")).toContain("apprentice-ratio");
  });

  it("flags an employee paid far from their trade + level peers, once", () => {
    const peer = (employeeId: string, standardRateCents: number) =>
      ["2025-03-01", "2025-03-08", "2025-03-15"].map((weekEnding) =>
        journeyworkerRecord({
          ref: `${employeeId}-${weekEnding}`,
          employeeId,
          weekEnding,
          standardRateCents,
          overtimeRateCents: standardRateCents * 1.5,
          hours: NORMAL_WEEK.slice(0, 4),
        })
      );
    const records = [
      ...peer("a", 4000),
      ...peer("b", 4200),
      ...peer("c", 4100),
      ...peer("d", 6500),
    ];
    const peerFindings = detectAnomalies(records).filter(
      (anomaly) => anomaly.rule === "rate-vs-trade-peers"
    );
    expect(peerFindings).toHaveLength(1);
    expect(peerFindings[0]).toMatchObject({ employeeId: "d", ref: "d-2025-03-15" });
    expect(peerFindings[0].message).toBe(
      "Usual standard rate $65.00 is 57% above the median for 4 mason journeyworkers ($41.50)"
    );
  });

  it("skips the peer comparison for groups smaller than the minimum", () => {
    const records = ["a", "b"].flatMap((employeeId, index) =>
      ["2025-03-01", "2025-03-08", "2025-03-15"].map((weekEnding) =>
        journeyworkerRecord({
          employeeId,
          weekEnding,
          standardRateCents: index ? 9000 : 3000,
          overtimeRateCents: index ? 13500 : 4500,
          hours: NORMAL_WEEK.slice(0, 4),
        })
      )
    );
    expect(detectAnomalies(records).map((anomaly) => anomaly.rule)).not.toContain(
      "rate-vs-trade-peers"
    );
  });
});

describe("median", () => {
  it("handles odd and even lengths", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});
