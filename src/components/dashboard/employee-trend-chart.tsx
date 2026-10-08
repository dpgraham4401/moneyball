"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatDate } from "@/lib/format";
import type { EmployeeWeek } from "@/lib/payroll/stats";

const hoursConfig = {
  standardHours: { label: "Standard hours", color: "var(--chart-1)" },
  overtimeHours: { label: "Overtime hours", color: "var(--chart-2)" },
} satisfies ChartConfig;

const rateConfig = {
  standardRate: { label: "Standard rate ($/h)", color: "var(--chart-4)" },
  benefitsRate: { label: "Benefits rate ($/h)", color: "var(--chart-5)" },
} satisfies ChartConfig;

/**
 * Two charts sharing the same weeks: hours (stacked bars) and rates (lines).
 * Kept separate rather than dual-axis so neither hides the other and each has an honest scale.
 */
export function EmployeeTrendChart({ weeks }: { weeks: EmployeeWeek[] }) {
  const chartData = weeks.map((week) => ({
    week: formatDate(week.weekEnding),
    standardHours: Math.round(week.standardHours * 10) / 10,
    overtimeHours: Math.round(week.overtimeHours * 10) / 10,
    standardRate: week.standardRateCents / 100,
    benefitsRate: week.benefitsRateCents / 100,
  }));
  const xAxis = <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} />;

  return (
    <div className="flex flex-col gap-6">
      <ChartContainer config={hoursConfig} className="aspect-auto h-64 w-full">
        <BarChart data={chartData}>
          <CartesianGrid vertical={false} />
          {xAxis}
          <YAxis tickLine={false} axisLine={false} width={32} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="standardHours" stackId="hours" fill="var(--color-standardHours)" />
          <Bar
            dataKey="overtimeHours"
            stackId="hours"
            fill="var(--color-overtimeHours)"
            radius={[3, 3, 0, 0]}
          />
        </BarChart>
      </ChartContainer>

      <ChartContainer config={rateConfig} className="aspect-auto h-48 w-full">
        <LineChart data={chartData}>
          <CartesianGrid vertical={false} />
          {xAxis}
          <YAxis
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(rate: number) => `$${rate}`}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Line
            dataKey="standardRate"
            stroke="var(--color-standardRate)"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            dataKey="benefitsRate"
            stroke="var(--color-benefitsRate)"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
}
