import { EmployeeActions } from "@/components/dashboard/employee-actions";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatHours, formatWholeDollars } from "@/lib/format";
import type { EmployeeStats, Range } from "@/lib/payroll/stats";

/** "min / avg / max" with the average emphasized. */
function RangeCell({ range, format }: { range: Range; format: (value: number) => string }) {
  return (
    <TableCell className="text-right whitespace-nowrap">
      <span className="text-muted-foreground">{format(range.min)} / </span>
      <span className="font-medium">{format(range.avg)}</span>
      <span className="text-muted-foreground"> / {format(range.max)}</span>
    </TableCell>
  );
}

export function EmployeeTable({
  employees,
  flaggedRowsByEmployee,
}: {
  employees: EmployeeStats[];
  flaggedRowsByEmployee: Map<string, number>;
}) {
  const sortedEmployees = [...employees].sort((left, right) =>
    left.employeeName.localeCompare(right.employeeName)
  );

  return (
    <div className="overflow-x-auto">
      <Table className="tabular-nums">
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Trade</TableHead>
            <TableHead className="text-right">Weeks</TableHead>
            <TableHead className="text-right">Hours/day (min / avg / max)</TableHead>
            <TableHead className="text-right">Total spend</TableHead>
            <TableHead className="text-right">Flagged rows</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedEmployees.map((employee) => {
            const flaggedRows = flaggedRowsByEmployee.get(employee.employeeId) ?? 0;
            return (
              <TableRow key={employee.employeeId}>
                <TableCell>
                  <div className="font-medium">{employee.employeeName}</div>
                  <div className="text-muted-foreground text-xs">
                    ID {employee.employeeId}
                    {employee.nameVariants.length > 1 &&
                      ` · also "${employee.nameVariants
                        .filter((name) => name !== employee.employeeName)
                        .join('", "')}"`}
                  </div>
                </TableCell>
                <TableCell>
                  <div>{employee.occupation}</div>
                  {employee.level === "APPRENTICE" && (
                    <Badge className="bg-accent text-accent-foreground">Apprentice</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">{employee.weeksWorked}</TableCell>
                <RangeCell range={employee.hoursPerDay} format={formatHours} />
                <TableCell className="text-right">
                  {formatWholeDollars(employee.totalSpendCents)}
                </TableCell>
                <TableCell className="text-right">
                  {flaggedRows > 0 ? (
                    <Badge variant="destructive">{flaggedRows}</Badge>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
                <TableCell>
                  <EmployeeActions employee={employee} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
