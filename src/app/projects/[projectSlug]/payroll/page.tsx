import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { AnomalyTable } from "@/components/dashboard/anomaly-table";
import { EmployeeTable, type EmployeeRow } from "@/components/dashboard/employee-table";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { detectAnomalies, type Severity } from "@/lib/payroll/anomalies";
import { getPayrollData } from "@/lib/payroll/source";
import { employeeStats, summarize } from "@/lib/payroll/stats";
import { getProject, PROJECTS } from "@/lib/projects";

/** Prerender one dashboard per project at build time. */
export function generateStaticParams() {
  return PROJECTS.map((project) => ({ projectSlug: project.slug }));
}

// Reading params inside <Suspense> lets navigation show the shell instantly (Cache Components).
export default function DashboardPage({ params }: PageProps<"/projects/[projectSlug]/payroll">) {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-6xl px-4 py-10">Loading…</main>}>
      <Dashboard params={params} />
    </Suspense>
  );
}

async function Dashboard({ params }: { params: Promise<{ projectSlug: string }> }) {
  const { projectSlug } = await params;
  const project = getProject(projectSlug);
  if (!project) notFound();
  const { records, rejected, fileError } = await getPayrollData(project.slug);
  const summary = summarize(records);
  const employees = employeeStats(records);
  const anomalies = detectAnomalies(records);

  // Flagged weeks = distinct records with any anomaly, so one bad week with two problems counts once.
  const flaggedRecordsByEmployee = Map.groupBy(
    new Set(anomalies.map((anomaly) => `${anomaly.employeeId}|${anomaly.ref}`)),
    (key) => key.split("|")[0]
  );
  const employeeRows: EmployeeRow[] = employees.map((employee) => ({
    ...employee,
    flaggedWeeks: flaggedRecordsByEmployee.get(employee.employeeId)?.length ?? 0,
  }));
  const countBySeverity = (severity: Severity) =>
    anomalies.filter((anomaly) => anomaly.severity === severity).length;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10">
      <header className="flex flex-col gap-1">
        <p className="text-muted-foreground text-sm">{project.name}</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Payroll dashboard</h1>
        <p className="text-muted-foreground">
          Weekly payroll for {summary.employeeCount} workers across {summary.weekCount} weeks, with
          likely data-entry errors flagged for review.
        </p>
      </header>

      {(fileError || rejected.length > 0) && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Some payroll data couldn&apos;t be loaded</AlertTitle>
          <AlertDescription>
            {fileError ??
              rejected.map((rejection) => `${rejection.ref}: ${rejection.reason}`).join("; ")}
          </AlertDescription>
        </Alert>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Summary</h2>
        <SummaryCards summary={summary} />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">Anomalies</h2>
          <div className="flex gap-2">
            <Badge variant="destructive">{countBySeverity("high")} high</Badge>
            <Badge variant="secondary">{countBySeverity("medium")} medium</Badge>
            <Badge variant="outline">{countBySeverity("low")} low</Badge>
          </div>
        </div>
        <AnomalyTable anomalies={anomalies} projectSlug={project.slug} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Employees</h2>
        <EmployeeTable employees={employeeRows} projectSlug={project.slug} />
      </section>
    </main>
  );
}
