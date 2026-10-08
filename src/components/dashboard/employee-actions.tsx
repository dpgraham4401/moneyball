"use client";

import { useState } from "react";
import { DollarSign, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCents } from "@/lib/format";
import type { EmployeeStats } from "@/lib/payroll/stats";

/** Per-row actions menu. Client component: the menu and modal need state; the table stays server-rendered. */
export function EmployeeActions({ employee }: { employee: EmployeeStats }) {
  const [isRatesOpen, setIsRatesOpen] = useState(false);
  const rates = [
    { label: "Standard", range: employee.standardRateCents },
    { label: "Overtime", range: employee.overtimeRateCents },
    { label: "Benefits", range: employee.benefitsRateCents },
  ];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${employee.employeeName}`}>
            <Menu />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setIsRatesOpen(true)}>
            <DollarSign />
            Rates
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isRatesOpen} onOpenChange={setIsRatesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{employee.employeeName}&apos;s hourly rates</DialogTitle>
            <DialogDescription>
              {employee.occupation} · ID {employee.employeeId} · across {employee.weeksWorked} weeks
            </DialogDescription>
          </DialogHeader>
          <Table className="tabular-nums">
            <TableHeader>
              <TableRow>
                <TableHead>Rate</TableHead>
                <TableHead className="text-right">Min</TableHead>
                <TableHead className="text-right">Avg</TableHead>
                <TableHead className="text-right">Max</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.map((rate) => (
                <TableRow key={rate.label}>
                  <TableCell className="font-medium">{rate.label}</TableCell>
                  <TableCell className="text-right">{formatCents(rate.range.min)}</TableCell>
                  <TableCell className="text-right">{formatCents(rate.range.avg)}</TableCell>
                  <TableCell className="text-right">{formatCents(rate.range.max)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </>
  );
}
