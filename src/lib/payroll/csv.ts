import { parseCsv } from "@/lib/csv";
import { WEEKDAYS, type Level, type ParseResult, type PayrollRecord } from "@/lib/payroll/types";

const COLUMNS = [
  "employee_name",
  "employee_id",
  "level",
  "occupation",
  "week_ending",
  ...WEEKDAYS.flatMap((d) => [`${d}_st_hours`, `${d}_ot_hours`]),
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
  const present = new Set(Object.keys(csv.rows[0] ?? {}));
  const missing = COLUMNS.filter((c) => !present.has(c));
  if (missing.length) {
    return { records: [], rejected: [], fileError: `Missing columns: ${missing.join(", ")}` };
  }

  const csvErrors = new Map(csv.errors.map((e) => [e.row, e.message]));
  const result: ParseResult = { records: [], rejected: [] };
  csv.rows.forEach((r, i) => {
    const ref = `${sourceName}:${i + 2}`; // +1 for 0-index, +1 for the header line
    const csvError = csvErrors.get(i + 1);
    if (csvError) return result.rejected.push({ ref, reason: csvError });
    try {
      result.records.push(toRecord(r, ref));
    } catch (e) {
      result.rejected.push({ ref, reason: (e as Error).message });
    }
  });
  return result;
}

function toRecord(r: Record<string, string>, ref: string): PayrollRecord {
  return {
    ref,
    employeeId: required(r.employee_id, "employee_id"),
    employeeName: required(r.employee_name, "employee_name"),
    level: toLevel(r.level),
    occupation: required(r.occupation, "occupation"),
    weekEnding: toIsoDate(r.week_ending),
    days: WEEKDAYS.map((day) => ({
      day,
      standard: toHours(r[`${day}_st_hours`], `${day}_st_hours`),
      overtime: toHours(r[`${day}_ot_hours`], `${day}_ot_hours`),
    })),
    standardRateCents: toCents(r.standard_rate, "standard_rate"),
    overtimeRateCents: toCents(r.overtime_rate, "overtime_rate"),
    benefitsRateCents: toCents(r.benefits_rate, "benefits_rate"),
  };
}

function required(v: string | undefined, name: string): string {
  if (!v) throw new Error(`${name} is required`);
  return v;
}

function toLevel(v: string | undefined): Level {
  const s = (v ?? "").toUpperCase();
  if (s === "APPRENTICE" || s === "JOURNEYWORKER") return s;
  throw new Error(`level must be APPRENTICE or JOURNEYWORKER: "${v ?? ""}"`);
}

/** Blank counts as 0 hours; anything else must be a number in 0–24. */
function toHours(v: string | undefined, name: string): number {
  if (!v) return 0;
  const h = Number(v);
  if (!Number.isFinite(h) || h < 0 || h > 24) throw new Error(`${name} must be 0–24: "${v}"`);
  return h;
}

/** "$1,234.5" → 123450. Exact for up to 2 decimals; rejects negatives and junk. */
export function toCents(v: string | undefined, name: string): number {
  const s = (v ?? "").replace(/[$,]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error(`${name} is not a valid amount: "${v ?? ""}"`);
  return Math.round(Number(s) * 100);
}

/** MM/DD/YYYY (or YYYY-MM-DD) → YYYY-MM-DD; rejects impossible dates like 02/30/2025. */
export function toIsoDate(v: string | undefined): string {
  const s = v ?? "";
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const [y, m, d] = us ? [us[3], us[1], us[2]] : iso ? [iso[1], iso[2], iso[3]] : [];
  if (!y || !m || !d) throw new Error(`week_ending is not MM/DD/YYYY: "${s}"`);
  const date = new Date(Date.UTC(+y, +m - 1, +d));
  if (date.getUTCMonth() !== +m - 1 || date.getUTCDate() !== +d) {
    throw new Error(`week_ending does not exist: "${s}"`);
  }
  return date.toISOString().slice(0, 10);
}
