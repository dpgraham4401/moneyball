// Source-agnostic payroll model. CSV, uploads, or a database all produce these;
// stats, anomaly checks, and the dashboard only ever see these types.

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export type Level = "APPRENTICE" | "JOURNEYWORKER";

export type DayHours = { day: Weekday; standard: number; overtime: number };

/** One employee's hours and pay for one week. Money is integer cents per hour. */
export type PayrollRecord = {
  /** Opaque pointer back to the source (e.g. "payroll_data.csv:40" or a DB id), for citing anomalies. */
  ref: string;
  employeeId: string;
  employeeName: string;
  level: Level;
  occupation: string;
  weekEnding: string; // YYYY-MM-DD
  days: DayHours[];
  standardRateCents: number;
  overtimeRateCents: number;
  benefitsRateCents: number;
};

/** A source row that couldn't become a PayrollRecord, with why. */
export type Rejected = { ref: string; reason: string };

export type ParseResult = { records: PayrollRecord[]; rejected: Rejected[]; fileError?: string };
