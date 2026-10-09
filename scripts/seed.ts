// Seeds the local database from each project's bundled CSV. Safe to re-run: files already
// imported (same sha256) are skipped. Run with `pnpm db:seed` after `pnpm db:migrate`.
import { readFile } from "node:fs/promises";
import { getDb } from "@/db";
import { importPayrollCsv } from "@/db/import-payroll";
import { PROJECTS } from "@/lib/projects";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: DATABASE_URL must come from the environment.
}

const db = getDb();
for (const project of PROJECTS) {
  const fileName = `data/${project.payrollFile}`;
  const result = await importPayrollCsv(db, {
    projectSlug: project.slug,
    projectName: project.name,
    fileName,
    csvText: await readFile(fileName, "utf8"),
  });
  console.log(`${project.slug} <- ${fileName}:`, result);
  if (result.status === "failed") process.exitCode = 1;
}
