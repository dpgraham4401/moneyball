import type { DayHours, PayrollRecord } from "@/lib/payroll/types";

export type Range = { min: number; max: number; avg: number };
export type Summary = ReturnType<typeof summarize>;
export type EmployeeStats = ReturnType<typeof employeeStats>[number];

export const getTotalHoursInDay = (day: DayHours) => day.standard + day.overtime;
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

export function recordHours(record: PayrollRecord) {
  const standard = sum(record.days.map((day) => day.standard));
  const overtime = sum(record.days.map((day) => day.overtime));
  return { standard, overtime, total: standard + overtime };
}

/**
 * Pay for one employee-week, rounded to whole cents once per record (a pay line).
 * Assumes benefits accrue on every hour worked, overtime included.
 */
export function recordSpendCents(record: PayrollRecord) {
  const hours = recordHours(record);
  const wages = Math.round(
    hours.standard * record.standardRateCents + hours.overtime * record.overtimeRateCents
  );
  const benefits = Math.round(hours.total * record.benefitsRateCents);
  return { wages, benefits, total: wages + benefits };
}

export function range(values: number[]): Range {
  if (!values.length) return { min: 0, max: 0, avg: 0 };
  return { min: Math.min(...values), max: Math.max(...values), avg: sum(values) / values.length };
}

export function summarize(records: PayrollRecord[]) {
  let standardHours = 0;
  let overtimeHours = 0;
  let apprenticeHours = 0;
  let standardCost = 0; // unrounded cents, for the weighted averages
  let overtimeCost = 0;
  let benefitsCost = 0;
  let wagesCents = 0; // rounded per record
  let benefitsCents = 0;
  for (const record of records) {
    const hours = recordHours(record);
    standardHours += hours.standard;
    overtimeHours += hours.overtime;
    if (record.level === "APPRENTICE") apprenticeHours += hours.total;
    standardCost += hours.standard * record.standardRateCents;
    overtimeCost += hours.overtime * record.overtimeRateCents;
    benefitsCost += hours.total * record.benefitsRateCents;
    const spend = recordSpendCents(record);
    wagesCents += spend.wages;
    benefitsCents += spend.benefits;
  }
  const totalHours = standardHours + overtimeHours;
  const ratio = (numerator: number, denominator: number) =>
    denominator ? numerator / denominator : 0;
  const weeks = [...new Set(records.map((record) => record.weekEnding))].sort();
  const apprentices = records.filter((record) => record.level === "APPRENTICE");

  return {
    recordCount: records.length,
    employeeCount: new Set(records.map((record) => record.employeeId)).size,
    apprenticeCount: new Set(apprentices.map((record) => record.employeeId)).size,
    firstWeek: weeks[0] ?? "",
    lastWeek: weeks.at(-1) ?? "",
    weekCount: weeks.length,
    standardHours,
    overtimeHours,
    totalHours,
    apprenticeHoursShare: ratio(apprenticeHours, totalHours), // 0–1
    // Hours-weighted: what an average hour actually cost.
    avgStandardRateCents: ratio(standardCost, standardHours),
    avgOvertimeRateCents: ratio(overtimeCost, overtimeHours),
    avgBenefitsRateCents: ratio(benefitsCost, totalHours),
    wagesCents,
    benefitsCents,
    totalSpendCents: wagesCents + benefitsCents,
  };
}

export function employeeStats(records: PayrollRecord[]) {
  const recordsByEmployee = Map.groupBy(records, (record) => record.employeeId);
  return [...recordsByEmployee].map(([employeeId, employeeRecords]) => {
    // Days off are excluded so they don't drag the hours-per-day average down.
    const hoursOnWorkedDays = employeeRecords
      .flatMap((record) => record.days.map(getTotalHoursInDay))
      .filter((hours) => hours > 0);
    const recordsByName = Map.groupBy(employeeRecords, (record) => record.employeeName);
    const [mostFrequentName] = [...recordsByName].sort(
      ([, recordsA], [, recordsB]) => recordsB.length - recordsA.length
    )[0];
    const ratesOf = (rate: (record: PayrollRecord) => number) => range(employeeRecords.map(rate));

    return {
      employeeId,
      employeeName: mostFrequentName,
      nameVariants: [...recordsByName.keys()],
      level: employeeRecords[0].level,
      occupation: employeeRecords[0].occupation,
      weeksWorked: employeeRecords.length,
      daysWorked: hoursOnWorkedDays.length,
      totalHours: sum(hoursOnWorkedDays),
      overtimeHours: sum(employeeRecords.map((record) => recordHours(record).overtime)),
      hoursPerDay: range(hoursOnWorkedDays),
      standardRateCents: ratesOf((record) => record.standardRateCents),
      overtimeRateCents: ratesOf((record) => record.overtimeRateCents),
      benefitsRateCents: ratesOf((record) => record.benefitsRateCents),
      totalSpendCents: sum(employeeRecords.map((record) => recordSpendCents(record).total)),
    };
  });
}
