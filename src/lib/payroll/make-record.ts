import { WEEKDAYS, type PayrollRecord } from "@/lib/payroll/types";

// Test-only helper: builds records directly, without CSV, which also shows the stats and anomaly code are source-agnostic.
/** Build a record from per-day [standard, overtime] pairs (Mon first, missing days = 0). */
export function makeRecord(
  overrides: Partial<PayrollRecord> & { hours: [number, number][] }
): PayrollRecord {
  const { hours, ...fields } = overrides;
  return {
    ref: "test",
    employeeId: "1",
    employeeName: "Ana Smith",
    level: "APPRENTICE",
    occupation: "Mason",
    weekEnding: "2025-03-01",
    standardRateCents: 2705,
    overtimeRateCents: 4058,
    benefitsRateCents: 1217,
    days: WEEKDAYS.map((day, dayIndex) => ({
      day,
      standard: hours[dayIndex]?.[0] ?? 0,
      overtime: hours[dayIndex]?.[1] ?? 0,
    })),
    ...fields,
  };
}
