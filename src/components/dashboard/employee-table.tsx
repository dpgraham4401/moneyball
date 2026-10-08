"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { EmployeeActions } from "@/components/dashboard/employee-actions";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { formatHours, formatWholeDollars } from "@/lib/format";
import type { EmployeeStats } from "@/lib/payroll/stats";

export type EmployeeRow = EmployeeStats & { flaggedWeeks: number };

const RIGHT_ALIGNED = { className: "text-right whitespace-nowrap tabular-nums" };

const columns: ColumnDef<EmployeeRow>[] = [
  {
    id: "employee",
    // Name first so sorting is by name; ID and other spellings included so search finds them.
    accessorFn: (employee) =>
      [employee.employeeName, employee.employeeId, ...employee.nameVariants].join(" "),
    header: "Employee",
    cell: ({ row }) => {
      const employee = row.original;
      const otherNames = employee.nameVariants.filter((name) => name !== employee.employeeName);
      return (
        <>
          <Link
            href={`/payroll/employees/${employee.employeeId}`}
            className="font-medium hover:underline"
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
  { accessorKey: "weeksWorked", header: "Weeks", enableGlobalFilter: false, meta: RIGHT_ALIGNED },
  {
    id: "hoursPerDay",
    accessorFn: (employee) => employee.hoursPerDay.avg, // sorts by the average
    header: "Hours/day (min / avg / max)",
    enableGlobalFilter: false,
    meta: RIGHT_ALIGNED,
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
    meta: RIGHT_ALIGNED,
    cell: ({ row }) => formatWholeDollars(row.original.totalSpendCents),
  },
  {
    accessorKey: "flaggedWeeks",
    header: "Flagged weeks",
    enableGlobalFilter: false,
    sortDescFirst: true,
    meta: RIGHT_ALIGNED,
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
    cell: ({ row }) => <EmployeeActions employee={row.original} />,
  },
];

export function EmployeeTable({ employees }: { employees: EmployeeRow[] }) {
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
    />
  );
}
