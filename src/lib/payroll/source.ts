import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parsePayrollCsv } from "@/lib/payroll/csv";
import type { ParseResult } from "@/lib/payroll/types";
import { getProject } from "@/lib/projects";

/** Fixed directory so build tracing ships `data/` only, not the whole project. */
const DATA_DIRECTORY = "data";

/**
 * The one place the dashboard gets payroll data from, per project. Today it reads the project's
 * bundled CSV; swapping in a database means changing this function, not its callers.
 * Cached per project: the CSV is static, so it's read and parsed once (at build), not per request.
 * A live source would drop "use cache" and render behind <Suspense> instead.
 */
export async function getPayrollData(projectSlug: string): Promise<ParseResult> {
  "use cache";
  const project = getProject(projectSlug);
  if (!project) throw new Error(`Unknown project: ${projectSlug}`);
  const relativePath = `${DATA_DIRECTORY}/${project.payrollFile}`;
  const text = await readFile(
    path.join(process.cwd(), DATA_DIRECTORY, project.payrollFile),
    "utf8"
  );
  return parsePayrollCsv(text, relativePath);
}
