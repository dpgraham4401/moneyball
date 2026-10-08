"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { SEVERITY_ORDER, type Anomaly, type Severity } from "@/lib/payroll/anomalies";
import { projectPaths } from "@/lib/projects";

const SEVERITY_BADGE: Record<Severity, React.ComponentProps<typeof Badge>> = {
  high: { variant: "destructive" },
  medium: { variant: "secondary" },
  low: { variant: "outline" },
};

/** "standard-rate-deviation" → "Standard rate deviation" */
const ruleLabel = (rule: string) => {
  const words = rule.replaceAll("-", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const buildColumns = (projectSlug: string): ColumnDef<Anomaly>[] => [
  {
    accessorKey: "severity",
    header: "Severity",
    filterFn: "equals",
    // Sort high → low by meaning, not alphabetically.
    sortingFn: (rowA, rowB) =>
      SEVERITY_ORDER[rowA.original.severity] - SEVERITY_ORDER[rowB.original.severity],
    cell: ({ row }) => (
      <Badge {...SEVERITY_BADGE[row.original.severity]} className="capitalize">
        {row.original.severity}
      </Badge>
    ),
  },
  {
    accessorKey: "weekEnding",
    header: "Week ending",
    meta: { className: "whitespace-nowrap" },
    cell: ({ row }) => formatDate(row.original.weekEnding),
  },
  {
    accessorKey: "employeeName",
    header: "Employee",
    meta: { className: "whitespace-nowrap" },
    cell: ({ row }) => (
      <Link
        href={projectPaths.employee(projectSlug, row.original.employeeId)}
        className="hover:underline"
      >
        {row.original.employeeName}
      </Link>
    ),
  },
  {
    accessorKey: "rule",
    header: "Check",
    filterFn: "equals",
    meta: { className: "whitespace-nowrap" },
    cell: ({ row }) => ruleLabel(row.original.rule),
  },
  {
    accessorKey: "message",
    header: "Details",
    enableSorting: false,
    meta: { className: "min-w-64 whitespace-normal" },
  },
];

export function AnomalyTable({
  anomalies,
  projectSlug,
}: {
  anomalies: Anomaly[];
  projectSlug: string;
}) {
  // Stable column definitions: TanStack re-derives the table when the columns array changes.
  const columns = useMemo(() => buildColumns(projectSlug), [projectSlug]);
  if (!anomalies.length) {
    return <p className="text-muted-foreground">No anomalies found.</p>;
  }
  const rules = [...new Set(anomalies.map((anomaly) => anomaly.rule))].sort();

  return (
    <DataTable
      columns={columns}
      data={anomalies}
      searchPlaceholder="Search employee or details…"
      selectFilters={[
        {
          columnId: "severity",
          label: "Severities",
          options: (["high", "medium", "low"] as const).map((severity) => ({
            value: severity,
            label: severity.charAt(0).toUpperCase() + severity.slice(1),
          })),
        },
        {
          columnId: "rule",
          label: "Checks",
          options: rules.map((rule) => ({ value: rule, label: ruleLabel(rule) })),
        },
      ]}
      emptyMessage="No anomalies match these filters."
    />
  );
}
