import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp } from "lucide-react";
import { EmployeeTrendChart } from "@/components/dashboard/employee-trend-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCents, formatDate, formatHours, formatWholeDollars } from "@/lib/format";
import { detectAnomalies, median } from "@/lib/payroll/anomalies";
import { getPayrollData } from "@/lib/payroll/source";
import { employeeStats, employeeWeeks } from "@/lib/payroll/stats";
import { getProject, PROJECTS, projectPaths } from "@/lib/projects";

/** Prerender one page per employee at build time. */
export async function generateStaticParams() {
  const paramsPerProject = await Promise.all(
    PROJECTS.map(async (project) => {
      const { records } = await getPayrollData(project.slug);
      return [...new Set(records.map((record) => record.employeeId))].map((employeeId) => ({
        projectSlug: project.slug,
        employeeId,
      }));
    })
  );
  return paramsPerProject.flat();
}

/** "+2.5" / "−3" with an arrow; nothing for the first week. */
function Change({ value, format }: { value: number | null; format: (value: number) => string }) {
  if (value === null || Math.abs(value) < 0.05) {
    return <span className="text-muted-foreground">–</span>;
  }
  const isIncrease = value > 0;
  return (
    <span className="inline-flex items-center gap-0.5">
      {isIncrease ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {format(Math.abs(value))}
    </span>
  );
}

// Reading params inside <Suspense> lets navigation show the shell instantly (Cache Components).
export default function EmployeePage({
  params,
}: PageProps<"/projects/[projectSlug]/payroll/employees/[employeeId]">) {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-6xl px-4 py-10">Loading…</main>}>
      <EmployeeDetail params={params} />
    </Suspense>
  );
}

async function EmployeeDetail({
  params,
}: {
  params: Promise<{ projectSlug: string; employeeId: string }>;
}) {
  const { projectSlug, employeeId } = await params;
  const project = getProject(projectSlug);
  if (!project) notFound();
  const { records } = await getPayrollData(project.slug);
  const employeeRecords = records.filter((record) => record.employeeId === employeeId);
  if (!employeeRecords.length) notFound();

  const [employee] = employeeStats(employeeRecords);
  const weeks = employeeWeeks(employeeRecords);
  // Detect on the whole crew: the apprentice-ratio and peer-rate rules compare across employees.
  const employeeAnomalies = detectAnomalies(records).filter(
    (anomaly) => anomaly.employeeId === employeeId
  );
  const anomaliesByRecord = Map.groupBy(employeeAnomalies, (anomaly) => anomaly.ref);
  const peakWeek = weeks.reduce((peak, week) => (week.totalHours > peak.totalHours ? week : peak));

  const stats = [
    { label: "Weeks worked", value: employee.weeksWorked, detail: `${employee.daysWorked} days` },
    {
      label: "Avg hours per week",
      value: formatHours(employee.totalHours / employee.weeksWorked),
      detail: `peak ${formatHours(peakWeek.totalHours)} (${formatDate(peakWeek.weekEnding)})`,
    },
    {
      label: "Usual standard rate",
      // Median, not mean: the same baseline the anomaly checks use, so spikes don't inflate it.
      value: formatCents(median(employeeRecords.map((record) => record.standardRateCents))),
      detail: `${formatCents(employee.standardRateCents.min)} – ${formatCents(employee.standardRateCents.max)}`,
    },
    {
      label: "Total spend",
      value: formatWholeDollars(employee.totalSpendCents),
      detail: `${anomaliesByRecord.size} flagged weeks`,
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-2">
        <Link
          href={projectPaths.payroll(project.slug)}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> Payroll dashboard
        </Link>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {employee.employeeName}
        </h1>
        <div className="text-muted-foreground flex flex-wrap items-center gap-2">
          {employee.occupation} · ID {employee.employeeId}
          {employee.level === "APPRENTICE" && (
            <Badge className="bg-accent text-accent-foreground">Apprentice</Badge>
          )}
          {employee.nameVariants.length > 1 && (
            <Badge variant="secondary">
              Also recorded as {employee.nameVariants.slice(1).join(", ")}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{stat.value}</CardTitle>
              <CardDescription className="text-xs">{stat.detail}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hours and rates by week</CardTitle>
          <CardDescription>
            Hours worked, then hourly rates. A rate spike with no change in role usually means a
            data-entry error.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmployeeTrendChart weeks={weeks} />
        </CardContent>
      </Card>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Week over week</h2>
        <div className="overflow-x-auto">
          <Table className="tabular-nums">
            <TableHeader>
              <TableRow>
                <TableHead>Week ending</TableHead>
                <TableHead className="text-right">Days</TableHead>
                <TableHead className="text-right">Standard h</TableHead>
                <TableHead className="text-right">Overtime h</TableHead>
                <TableHead className="text-right">Total h</TableHead>
                <TableHead className="text-right">Change</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Spend</TableHead>
                <TableHead className="text-right">Change</TableHead>
                <TableHead>Flags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {weeks.map((week) => {
                const weekAnomalies = anomaliesByRecord.get(week.ref) ?? [];
                return (
                  <TableRow key={week.ref}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(week.weekEnding)}
                      {week.isAfterGap && (
                        <span className="text-muted-foreground text-xs"> (after a gap)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{week.daysWorked}</TableCell>
                    <TableCell className="text-right">{formatHours(week.standardHours)}</TableCell>
                    <TableCell className="text-right">{formatHours(week.overtimeHours)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatHours(week.totalHours)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Change value={week.hoursChange} format={formatHours} />
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCents(week.standardRateCents)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatWholeDollars(week.spendCents)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Change value={week.spendChangeCents} format={formatWholeDollars} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {weekAnomalies.map((anomaly) => (
                          <Badge
                            key={`${anomaly.rule}-${anomaly.message}`}
                            variant={anomaly.severity === "high" ? "destructive" : "secondary"}
                            title={anomaly.message}
                          >
                            {anomaly.rule.replaceAll("-", " ")}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>
    </main>
  );
}
