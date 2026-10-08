import Link from "next/link";
import { LayoutDashboard, Menu, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SiteHeader() {
  return (
    <header className="bg-card sticky top-0 z-10 border-b">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="bg-brand text-brand-forest flex size-8 items-center justify-center rounded">
            <Scale className="size-5" />
          </span>
          Moneyball
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open navigation">
              <Menu />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link href="/payroll">
                <LayoutDashboard />
                Payroll dashboard
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
