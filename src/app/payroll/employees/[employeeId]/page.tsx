import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getPayrollData } from "@/lib/payroll/source";
import { employeeStats } from "@/lib/payroll/stats";

/** Prerender one page per employee at build time. */
export async function generateStaticParams() {
  const { records } = await getPayrollData();
  return [...new Set(records.map((record) => record.employeeId))].map((employeeId) => ({
    employeeId,
  }));
}

// Reading params inside <Suspense> lets navigation show the shell instantly (Cache Components).
export default function EmployeePage({ params }: PageProps<"/payroll/employees/[employeeId]">) {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-6xl px-4 py-10">Loading…</main>}>
      <EmployeeDetail params={params} />
    </Suspense>
  );
}

async function EmployeeDetail({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params;
  const { records } = await getPayrollData();
  const employeeRecords = records.filter((record) => record.employeeId === employeeId);
  if (!employeeRecords.length) notFound();
  const [employee] = employeeStats(employeeRecords);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-2">
        <Link
          href="/payroll"
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
        </div>
      </div>
    </main>
  );
}
