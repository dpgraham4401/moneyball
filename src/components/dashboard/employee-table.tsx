"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { EmployeeActions } from "@/components/dashboard/employee-actions";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { formatHours, formatWholeDollars } from "@/lib/format";
import type { EmployeeStats } from "@/lib/payroll/stats";
import { projectPaths } from "@/lib/projects";
import { cn, linkClassName } from "@/lib/utils";

export type EmployeeRow = EmployeeStats & { flaggedWeeks: number };

const rightAligned = (width: string) => ({
  className: `${width} text-right whitespace-nowrap tabular-nums`,
});

const buildColumns = (projectSlug: string): ColumnDef<EmployeeRow>[] => [
  {
    id: "employee",
    // Name first so sorting is by name; ID and other spellings included so search finds them.
    accessorFn: (employee) =>
      [employee.employeeName, employee.employeeId, ...employee.nameVariants].join(" "),
    header: "Employee", // takes the remaining width
    cell: ({ row }) => {
      const employee = row.original;
      const otherNames = employee.nameVariants.filter((name) => name !== employee.employeeName);
      return (
        <>
          <Link
            href={projectPaths.employee(projectSlug, employee.employeeId)}
            className={cn(linkClassName, "font-medium")}
          >
            {employee.employeeName}
          </Link>
          <div className="text-muted-foreground text-xs">
            ID {employee.employeeId}
            {otherNames.length > 0 && ` · also "${otherNames.join('", "')}"`}
          </div>
        </>
      );
    },
  },
  {
    accessorKey: "occupation",
    header: "Trade",
    meta: { className: "w-44" },
    filterFn: "equals",
    cell: ({ row }) => (
      <>
        <div>{row.original.occupation}</div>
        {row.original.level === "APPRENTICE" && (
          <Badge className="bg-accent text-accent-foreground">Apprentice</Badge>
        )}
      </>
    ),
  },
  // Hidden: exists only so the level dropdown can filter on it.
  { accessorKey: "level", header: "Level", filterFn: "equals", enableGlobalFilter: false },
  {
    accessorKey: "weeksWorked",
    header: "Weeks",
    enableGlobalFilter: false,
    meta: rightAligned("w-20"),
  },
  {
    id: "hoursPerDay",
    accessorFn: (employee) => employee.hoursPerDay.avg, // sorts by the average
    header: "Hours/day (min / avg / max)",
    enableGlobalFilter: false,
    meta: rightAligned("w-60"),
    cell: ({ row }) => {
      const range = row.original.hoursPerDay;
      return (
        <>
          <span className="text-muted-foreground">{formatHours(range.min)} / </span>
          <span className="font-medium">{formatHours(range.avg)}</span>
          <span className="text-muted-foreground"> / {formatHours(range.max)}</span>
        </>
      );
    },
  },
  {
    accessorKey: "totalSpendCents",
    header: "Total spend",
    enableGlobalFilter: false,
    meta: rightAligned("w-32"),
    cell: ({ row }) => formatWholeDollars(row.original.totalSpendCents),
  },
  {
    accessorKey: "flaggedWeeks",
    header: "Flagged weeks",
    enableGlobalFilter: false,
    sortDescFirst: true,
    meta: rightAligned("w-36"),
    cell: ({ row }) =>
      row.original.flaggedWeeks > 0 ? (
        <Badge variant="destructive">{row.original.flaggedWeeks}</Badge>
      ) : (
        <span className="text-muted-foreground">0</span>
      ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    enableSorting: false,
    meta: { className: "w-12" },
    cell: ({ row }) => <EmployeeActions employee={row.original} projectSlug={projectSlug} />,
  },
];

export function EmployeeTable({
  employees,
  projectSlug,
}: {
  employees: EmployeeRow[];
  projectSlug: string;
}) {
  // Stable column definitions: TanStack re-derives the table when the columns array changes.
  const columns = useMemo(() => buildColumns(projectSlug), [projectSlug]);
  const trades = [...new Set(employees.map((employee) => employee.occupation))].sort();

  return (
    <DataTable
      columns={columns}
      data={employees}
      searchPlaceholder="Search name, ID, or trade…"
      initialSorting={[{ id: "employee", desc: false }]}
      hiddenColumnIds={["level"]}
      selectFilters={[
        {
          columnId: "occupation",
          label: "Trades",
          options: trades.map((trade) => ({ value: trade, label: trade })),
        },
        {
          columnId: "level",
          label: "Levels",
          options: [
            { value: "APPRENTICE", label: "Apprentice" },
            { value: "JOURNEYWORKER", label: "Journeyworker" },
          ],
        },
      ]}
      emptyMessage="No employees match these filters."
      tableClassName="min-w-[56rem]"
      rowClassName="h-16"
    />
  );
}
