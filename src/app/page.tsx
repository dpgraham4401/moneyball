import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col items-start gap-4 px-4 py-10">
      <h1 className="font-heading text-3xl font-semibold tracking-tight">Construction payroll</h1>
      <p className="text-muted-foreground max-w-2xl">
        Review weekly payroll at a glance: hours, rates, and spend across the crew, with likely
        data-entry errors flagged for follow-up.
      </p>
      <Button asChild>
        <Link href="/payroll">
          Open payroll dashboard <ArrowRight />
        </Link>
      </Button>
    </main>
  );
}
