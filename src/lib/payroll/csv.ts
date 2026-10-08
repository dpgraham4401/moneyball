import { parseCsv, type CsvRow } from "@/lib/csv";
import { WEEKDAYS, type Level, type ParseResult, type PayrollRecord } from "@/lib/payroll/types";

const COLUMNS = [
  "employee_name",
  "employee_id",
  "level",
  "occupation",
  "week_ending",
  ...WEEKDAYS.flatMap((weekday) => [`${weekday}_st_hours`, `${weekday}_ot_hours`]),
  "standard_rate",
  "overtime_rate",
  "benefits_rate",
];

/**
 * Wide weekly payroll CSV (one row per employee-week, 14 hour columns) → PayrollRecords.
 * Structurally invalid rows are rejected with a reason; suspicious-but-valid values
 * (huge hours, odd rates) are kept so anomaly detection can flag them.
 */
export function parsePayrollCsv(text: string, sourceName = "upload.csv"): ParseResult {
  const csv = parseCsv(text);
  const presentColumns = new Set(Object.keys(csv.rows[0] ?? {}));
  const missingColumns = COLUMNS.filter((column) => !presentColumns.has(column));
  if (missingColumns.length) {
    return {
      records: [],
      rejected: [],
      fileError: `Missing columns: ${missingColumns.join(", ")}`,
    };
  }

  const csvErrorsByRow = new Map(csv.errors.map((error) => [error.row, error.message]));
  const result: ParseResult = { records: [], rejected: [] };
  csv.rows.forEach((row, rowIndex) => {
    const ref = `${sourceName}:${rowIndex + 2}`; // +1 for 0-index, +1 for the header line
    const csvError = csvErrorsByRow.get(rowIndex + 1);
    if (csvError) return result.rejected.push({ ref, reason: csvError });
    try {
      result.records.push(toRecord(row, ref));
    } catch (error) {
      result.rejected.push({ ref, reason: (error as Error).message });
    }
  });
  return result;
}

function toRecord(row: CsvRow, ref: string): PayrollRecord {
  return {
    ref,
    employeeId: required(row.employee_id, "employee_id"),
    employeeName: required(row.employee_name, "employee_name"),
    level: toLevel(row.level),
    occupation: required(row.occupation, "occupation"),
    weekEnding: toIsoDate(row.week_ending),
    days: WEEKDAYS.map((weekday) => ({
      day: weekday,
      standard: toHours(row[`${weekday}_st_hours`], `${weekday}_st_hours`),
      overtime: toHours(row[`${weekday}_ot_hours`], `${weekday}_ot_hours`),
    })),
    standardRateCents: toCents(row.standard_rate, "standard_rate"),
    overtimeRateCents: toCents(row.overtime_rate, "overtime_rate"),
    benefitsRateCents: toCents(row.benefits_rate, "benefits_rate"),
  };
}

function required(value: string | undefined, columnName: string): string {
  if (!value) throw new Error(`${columnName} is required`);
  return value;
}

function toLevel(value: string | undefined): Level {
  const level = (value ?? "").toUpperCase();
  if (level === "APPRENTICE" || level === "JOURNEYWORKER") return level;
  throw new Error(`level must be APPRENTICE or JOURNEYWORKER: "${value ?? ""}"`);
}

/** Blank counts as 0 hours; anything else must be a number in 0–24. */
function toHours(value: string | undefined, columnName: string): number {
  if (!value) return 0;
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
    throw new Error(`${columnName} must be 0–24: "${value}"`);
  }
  return hours;
}

/** "$1,234.5" → 123450. Exact for up to 2 decimals; rejects negatives and junk. */
export function toCents(value: string | undefined, columnName: string): number {
  const amount = (value ?? "").replace(/[$,]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(amount)) {
    throw new Error(`${columnName} is not a valid amount: "${value ?? ""}"`);
  }
  return Math.round(Number(amount) * 100);
}

/** MM/DD/YYYY (or YYYY-MM-DD) → YYYY-MM-DD; rejects impossible dates like 02/30/2025. */
export function toIsoDate(value: string | undefined): string {
  const text = value ?? "";
  const usMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const [year, month, day] = usMatch
    ? [usMatch[3], usMatch[1], usMatch[2]].map(Number)
    : isoMatch
      ? [isoMatch[1], isoMatch[2], isoMatch[3]].map(Number)
      : [];
  if (!year || !month || !day) throw new Error(`week_ending is not MM/DD/YYYY: "${text}"`);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`week_ending does not exist: "${text}"`);
  }
  return date.toISOString().slice(0, 10);
}
