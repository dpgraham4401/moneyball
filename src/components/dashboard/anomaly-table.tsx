import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import type { Anomaly, Severity } from "@/lib/payroll/anomalies";

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

export function AnomalyTable({ anomalies }: { anomalies: Anomaly[] }) {
  if (!anomalies.length) {
    return <p className="text-muted-foreground">No anomalies found.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Severity</TableHead>
            <TableHead>Week ending</TableHead>
            <TableHead>Employee</TableHead>
            <TableHead>Check</TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {anomalies.map((anomaly) => (
            <TableRow key={`${anomaly.ref}-${anomaly.rule}-${anomaly.message}`}>
              <TableCell>
                <Badge {...SEVERITY_BADGE[anomaly.severity]} className="capitalize">
                  {anomaly.severity}
                </Badge>
              </TableCell>
              <TableCell className="whitespace-nowrap">{formatDate(anomaly.weekEnding)}</TableCell>
              <TableCell className="whitespace-nowrap">
                <Link href={`/payroll/employees/${anomaly.employeeId}`} className="hover:underline">
                  {anomaly.employeeName}
                </Link>
              </TableCell>
              <TableCell className="whitespace-nowrap">{ruleLabel(anomaly.rule)}</TableCell>
              <TableCell className="min-w-64 whitespace-normal">{anomaly.message}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
