import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cacheTag } from "next/cache";
import { getDb } from "@/db";
import { readPayrollData } from "@/db/read-payroll";
import { parsePayrollCsv } from "@/lib/payroll/csv";
import type { ParseResult } from "@/lib/payroll/types";
import { getProject } from "@/lib/projects";

/** Fixed directory so build tracing ships `data/` only, not the whole project. */
const DATA_DIRECTORY = "data";

/** Tag for a project's payroll cache; an import can call `revalidateTag()` with it. */
export const payrollCacheTag = (projectSlug: string) => `payroll:${projectSlug}`;

/**
 * The one place the dashboard gets payroll data from, per project.
 * - DATABASE_URL set: read from the database (populated by `pnpm db:seed` or future uploads).
 * - Not set: read the project's bundled CSV, so the app runs with zero setup.
 * Either way the result is the same ParseResult shape; callers can't tell the difference.
 * Cached per project and tagged, so the dashboard isn't re-queried on every request.
 */
export async function getPayrollData(projectSlug: string): Promise<ParseResult> {
  "use cache";
  cacheTag(payrollCacheTag(projectSlug));
  const project = getProject(projectSlug);
  if (!project) throw new Error(`Unknown project: ${projectSlug}`);

  if (process.env.DATABASE_URL) return readPayrollData(getDb(), project.slug);

  const relativePath = `${DATA_DIRECTORY}/${project.payrollFile}`;
  const text = await readFile(
    path.join(process.cwd(), DATA_DIRECTORY, project.payrollFile),
    "utf8"
  );
  return parsePayrollCsv(text, relativePath);
}
