import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatCents,
  formatDate,
  formatHours,
  formatPercent,
  formatWholeDollars,
} from "@/lib/format";
import type { Summary } from "@/lib/payroll/stats";

export function SummaryCards({ summary }: { summary: Summary }) {
  const stats = [
    {
      label: "Employees",
      value: summary.employeeCount,
      detail: `${summary.apprenticeCount} apprentices`,
    },
    {
      label: "Pay period",
      value: `${summary.weekCount} weeks`,
      detail: `${formatDate(summary.firstWeek)} – ${formatDate(summary.lastWeek)}`,
    },
    {
      label: "Total hours",
      value: formatHours(summary.totalHours),
      detail: `${formatHours(summary.overtimeHours)} overtime (${formatPercent(summary.overtimeHours / summary.totalHours)})`,
    },
    {
      label: "Apprentice share of hours",
      value: formatPercent(summary.apprenticeHoursShare),
      detail: "of all hours worked",
    },
    {
      label: "Total payroll spend",
      value: formatWholeDollars(summary.totalSpendCents),
      detail: `${formatWholeDollars(summary.wagesCents)} wages + ${formatWholeDollars(summary.benefitsCents)} benefits`,
    },
    {
      label: "Avg standard rate",
      value: formatCents(summary.avgStandardRateCents),
      detail: "per hour, weighted by hours worked",
    },
    {
      label: "Avg overtime rate",
      value: formatCents(summary.avgOvertimeRateCents),
      detail: "per hour, weighted by hours worked",
    },
    {
      label: "Avg benefits rate",
      value: formatCents(summary.avgBenefitsRateCents),
      detail: "per hour, weighted by hours worked",
    },
  ];

  return (
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
  );
}
