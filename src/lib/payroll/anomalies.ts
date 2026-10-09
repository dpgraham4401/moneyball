import { getTotalHoursInDay, recordHours } from "@/lib/payroll/stats";
import type { PayrollRecord } from "@/lib/payroll/types";

export type Severity = "high" | "medium" | "low";

export type AnomalyRule =
  | "standard-rate-deviation"
  | "benefits-rate-deviation"
  | "overtime-rate-mismatch"
  | "long-day"
  | "short-day"
  | "long-week"
  | "short-week"
  | "standard-hours-over-40"
  | "rate-vs-trade-peers"
  | "apprentice-ratio"
  | "name-mismatch"
  | "duplicate-week"
  | "week-ending-not-saturday";

export type Anomaly = {
  ref: string;
  employeeId: string;
  employeeName: string;
  weekEnding: string;
  rule: AnomalyRule;
  severity: Severity;
  message: string;
};

/**
 * Tunable thresholds. Defaults come from profiling the provided data: median day 7.5h
 * (99th percentile 12.8h), median week 37.4h (95th percentile 48.4h).
 */
export const DEFAULT_THRESHOLDS = {
  /** Flag a rate this far (as a fraction) from the employee's own median rate. */
  rateDeviation: 0.2,
  /** Need this many weeks before a median is a trustworthy baseline (with 2, one spike flags both). */
  minWeeksForRateBaseline: 3,
  /** Flag an employee whose usual rate is this far from the median of their trade + level. */
  peerRateDeviation: 0.25,
  /** Only compare against peers when the trade + level group has at least this many employees. */
  minPeerGroupSize: 3,
  maxDayHours: 14,
  minDayHours: 3, // only checked on days with any hours
  /** Well above the data's 95th percentile (48.4h); catches the ~86–88h weeks. */
  maxWeekHours: 70,
  /** Below full-time (30h/week), worth a look but often legitimate (part-time, partial weeks). */
  minWeekHours: 30,
  /** Hours past 40 in a week are normally overtime (FLSA / Davis-Bacon); more "standard" hours suggests unpaid OT. */
  maxStandardWeekHours: 40,
  /**
   * Allowed apprentices per journeyworker of the same trade on the same day. Real ratios come from
   * each registered apprenticeship program (often 1:1); this is an assumption to confirm.
   */
  maxApprenticesPerJourneyworker: 1,
  /** Overtime is expected to be 1.5× standard; allow a cent of rounding. */
  overtimeMultiplier: 1.5,
  overtimeToleranceCents: 1,
};
export type Thresholds = typeof DEFAULT_THRESHOLDS;

export const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const hoursText = (hours: number) => `${Math.round(hours * 10) / 10}h`;

/** Median is used over the mean so one bad week can't hide itself by skewing the baseline. */
export function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function detectAnomalies(
  records: PayrollRecord[],
  thresholds: Thresholds = DEFAULT_THRESHOLDS
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const flag = (record: PayrollRecord, rule: AnomalyRule, severity: Severity, message: string) =>
    anomalies.push({
      ref: record.ref,
      employeeId: record.employeeId,
      employeeName: record.employeeName,
      weekEnding: record.weekEnding,
      rule,
      severity,
      message,
    });

  // Apprentice ratio is crew-wide: count who worked each (week, day, trade).
  const crewByTradeDay = new Map<string, { apprentices: number; journeyworkers: number }>();
  for (const record of records) {
    for (const day of record.days) {
      if (getTotalHoursInDay(day) <= 0) continue;
      const key = `${record.weekEnding}|${day.day}|${record.occupation}`;
      const crew = crewByTradeDay.get(key) ?? { apprentices: 0, journeyworkers: 0 };
      if (record.level === "APPRENTICE") crew.apprentices += 1;
      else crew.journeyworkers += 1;
      crewByTradeDay.set(key, crew);
    }
  }

  const recordsByEmployee = Map.groupBy(records, (record) => record.employeeId);

  // Peer baseline: median of each employee's usual (median) rate, per trade + level.
  const peerGroupKey = (record: PayrollRecord) => `${record.occupation}|${record.level}`;
  const usualRatesByPeerGroup = new Map<string, number[]>();
  for (const employeeRecords of recordsByEmployee.values()) {
    const key = peerGroupKey(employeeRecords[0]);
    const usualRate = median(employeeRecords.map((record) => record.standardRateCents));
    usualRatesByPeerGroup.set(key, [...(usualRatesByPeerGroup.get(key) ?? []), usualRate]);
  }

  for (const employeeRecords of recordsByEmployee.values()) {
    const hasRateBaseline = employeeRecords.length >= thresholds.minWeeksForRateBaseline;
    const usualStandardRate = median(employeeRecords.map((record) => record.standardRateCents));
    const usualBenefitsRate = median(employeeRecords.map((record) => record.benefitsRateCents));
    const usualName = mostFrequent(employeeRecords.map((record) => record.employeeName));

    // Employee-level check, reported once on their latest week.
    const peerRates = usualRatesByPeerGroup.get(peerGroupKey(employeeRecords[0])) ?? [];
    if (hasRateBaseline && peerRates.length >= thresholds.minPeerGroupSize) {
      const peerMedian = median(peerRates);
      const peerDeviation = usualStandardRate / peerMedian - 1;
      if (Math.abs(peerDeviation) > thresholds.peerRateDeviation) {
        const latestRecord = employeeRecords.reduce((latest, record) =>
          record.weekEnding > latest.weekEnding ? record : latest
        );
        const peerGroup = `${latestRecord.occupation.toLowerCase()} ${latestRecord.level.toLowerCase()}s`;
        flag(
          latestRecord,
          "rate-vs-trade-peers",
          "medium",
          `Usual standard rate ${dollars(usualStandardRate)} is ${describeDeviation(peerDeviation)} the median for ${peerRates.length} ${peerGroup} (${dollars(peerMedian)})`
        );
      }
    }
    const seenWeeks = new Set<string>();

    for (const record of employeeRecords) {
      // Rates compared to this employee's own usual rate, not a crew-wide average.
      const standardDeviation = record.standardRateCents / usualStandardRate - 1;
      if (hasRateBaseline && Math.abs(standardDeviation) > thresholds.rateDeviation) {
        flag(
          record,
          "standard-rate-deviation",
          "high",
          `Standard rate ${dollars(record.standardRateCents)} is ${describeDeviation(standardDeviation)} their usual ${dollars(usualStandardRate)}`
        );
      }
      const benefitsDeviation = record.benefitsRateCents / usualBenefitsRate - 1;
      if (hasRateBaseline && Math.abs(benefitsDeviation) > thresholds.rateDeviation) {
        flag(
          record,
          "benefits-rate-deviation",
          "medium",
          `Benefits rate ${dollars(record.benefitsRateCents)} is ${describeDeviation(benefitsDeviation)} their usual ${dollars(usualBenefitsRate)}`
        );
      }
      const expectedOvertimeRate = record.standardRateCents * thresholds.overtimeMultiplier;
      if (
        Math.abs(record.overtimeRateCents - expectedOvertimeRate) >
        thresholds.overtimeToleranceCents
      ) {
        flag(
          record,
          "overtime-rate-mismatch",
          "medium",
          `Overtime rate ${dollars(record.overtimeRateCents)} isn't ${thresholds.overtimeMultiplier}× the standard rate (expected ${dollars(expectedOvertimeRate)})`
        );
      }

      for (const day of record.days) {
        const hoursInDay = getTotalHoursInDay(day);
        if (hoursInDay > thresholds.maxDayHours) {
          flag(
            record,
            "long-day",
            "high",
            `${hoursText(hoursInDay)} on ${day.day} (${hoursText(day.standard)} standard + ${hoursText(day.overtime)} overtime)`
          );
        } else if (hoursInDay > 0 && hoursInDay < thresholds.minDayHours) {
          flag(record, "short-day", "low", `Only ${hoursText(hoursInDay)} on ${day.day}`);
        }
      }

      const hoursInWeek = recordHours(record).total;
      if (hoursInWeek > thresholds.maxWeekHours) {
        flag(
          record,
          "long-week",
          "high",
          `${hoursText(hoursInWeek)} in one week (over ${thresholds.maxWeekHours}h)`
        );
      } else if (hoursInWeek < thresholds.minWeekHours) {
        flag(
          record,
          "short-week",
          "low",
          `Only ${hoursText(hoursInWeek)} in the week (under the ${thresholds.minWeekHours}h full-time threshold)`
        );
      }

      const standardHoursInWeek = recordHours(record).standard;
      if (standardHoursInWeek > thresholds.maxStandardWeekHours) {
        flag(
          record,
          "standard-hours-over-40",
          "medium",
          `${hoursText(standardHoursInWeek)} standard hours (over ${thresholds.maxStandardWeekHours}h); hours past ${thresholds.maxStandardWeekHours} are normally paid as overtime`
        );
      }

      if (record.level === "APPRENTICE") {
        const overRatioDays = record.days.flatMap((day) => {
          if (getTotalHoursInDay(day) <= 0) return [];
          const crew = crewByTradeDay.get(`${record.weekEnding}|${day.day}|${record.occupation}`);
          const isOverRatio =
            crew &&
            crew.apprentices > crew.journeyworkers * thresholds.maxApprenticesPerJourneyworker;
          return isOverRatio ? [`${day.day} (${crew.apprentices}:${crew.journeyworkers})`] : [];
        });
        if (overRatioDays.length) {
          flag(
            record,
            "apprentice-ratio",
            "medium",
            `Apprentice-to-journeyworker ${record.occupation.toLowerCase()} ratio above ${thresholds.maxApprenticesPerJourneyworker}:1 on ${overRatioDays.join(", ")}`
          );
        }
      }

      if (record.employeeName !== usualName) {
        flag(
          record,
          "name-mismatch",
          "medium",
          `Name "${record.employeeName}" differs from "${usualName}" used on employee ID ${record.employeeId}'s other rows`
        );
      }
      if (seenWeeks.has(record.weekEnding)) {
        flag(
          record,
          "duplicate-week",
          "high",
          `Second payroll row for the week ending ${record.weekEnding}`
        );
      }
      seenWeeks.add(record.weekEnding);
      if (new Date(`${record.weekEnding}T00:00:00Z`).getUTCDay() !== 6) {
        flag(
          record,
          "week-ending-not-saturday",
          "medium",
          `Week ending ${record.weekEnding} is not a Saturday`
        );
      }
    }
  }

  return anomalies.sort(
    (left, right) =>
      SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity] ||
      left.weekEnding.localeCompare(right.weekEnding) ||
      left.employeeName.localeCompare(right.employeeName)
  );
}

function describeDeviation(deviation: number) {
  const percent = Math.round(Math.abs(deviation) * 100);
  return `${percent}% ${deviation > 0 ? "above" : "below"}`;
}

/** Most common value; ties go to the one seen first. */
function mostFrequent(values: string[]): string {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].sort(([, countA], [, countB]) => countB - countA)[0][0];
}
