import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parsePayrollCsv } from "@/lib/payroll/csv";
import type { ParseResult } from "@/lib/payroll/types";

const DATA_FILE = "payroll_data.csv";

/**
 * The one place the dashboard gets payroll data from. Today it reads the bundled CSV;
 * swapping in a database means changing this function, not its callers.
 */
export async function getPayrollData(): Promise<ParseResult> {
  const text = await readFile(path.join(process.cwd(), DATA_FILE), "utf8");
  return parsePayrollCsv(text, DATA_FILE);
}
