import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parsePayrollCsv } from "@/lib/payroll/csv";
import type { ParseResult } from "@/lib/payroll/types";

const DATA_FILE = "data/payroll_data.csv";

/**
 * The one place the dashboard gets payroll data from. Today it reads the bundled CSV;
 * swapping in a database means changing this function, not its callers.
 * Cached: the CSV is static, so it's read and parsed once (at build) instead of per request.
 * A live source would drop "use cache" and render behind <Suspense> instead.
 */
export async function getPayrollData(): Promise<ParseResult> {
  "use cache";
  const text = await readFile(path.join(process.cwd(), DATA_FILE), "utf8");
  return parsePayrollCsv(text, DATA_FILE);
}
