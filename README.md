# Payroll Dashboard

A dashboard for reviewing weekly construction payroll. It shows summary statistics, per-employee statistics and likely data-entry errors.

Built with Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui and Vitest.

## Requirements

- Node.js 20.9 or newer
- pnpm (the version is pinned in `package.json`; run `corepack enable` to use it automatically)

## Getting started

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000/payroll.

The dashboard reads `data/payroll_data.csv`. You don't need a database or environment variables.

## Scripts

| Command                     | Description                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `pnpm dev`                  | Start the development server                                   |
| `pnpm build` / `pnpm start` | Production build and server                                    |
| `pnpm test`                 | Unit tests (Vitest, watch mode; add `--run` for a single pass) |
| `pnpm lint`                 | ESLint                                                         |

Pre-commit hooks (lefthook) run Prettier and ESLint on staged files.

## Project structure

```
data/payroll_data.csv          Source data
src/lib/payroll/
  types.ts                     Source-independent data model (PayrollRecord)
  csv.ts                       CSV adapter: wide weekly rows -> PayrollRecord[]
  source.ts                    getPayrollData(): the only data entry point for the UI
  stats.ts                     Summary and per-employee statistics
  anomalies.ts                 Anomaly rules and thresholds
src/app/payroll/page.tsx       Dashboard (server component)
src/components/dashboard/      Dashboard sections
```

The UI only depends on `PayrollRecord` and `getPayrollData()`. To replace the CSV with a database or uploads, change `source.ts`; the dashboard doesn't change.

## Features

### Summary statistics

- Unique employees (counted by employee ID) and apprentice count
- Pay period and number of weeks
- Total, standard and overtime hours
- Apprentice share of hours
- Total spend, split into wages and benefits
- Average standard, overtime and benefits rates, weighted by hours

### Employee statistics

- Weeks worked
- Hours per day (min / avg / max), counting only days worked
- Total spend
- Number of flagged weeks
- Name variants recorded under the same ID
- Rates (standard, overtime, benefits; min / avg / max), in a modal opened from the row's menu

### Anomaly detection

Each anomaly shows the record it came from and has a severity. Every threshold is configurable in `DEFAULT_THRESHOLDS`.

| Check                    | Severity   | Rule                                               |
| ------------------------ | ---------- | -------------------------------------------------- |
| Standard rate deviation  | High       | More than 20% from the employee's own median rate  |
| Benefits rate deviation  | Medium     | More than 20% from the employee's own median rate  |
| Overtime rate mismatch   | Medium     | Overtime rate is not 1.5x the standard rate        |
| Long day / short day     | High / Low | Over 14 h / under 3 h on a worked day              |
| Long week / short week   | High / Low | Over 60 h / under 16 h                             |
| Name mismatch            | Medium     | Name differs from the most common name for that ID |
| Duplicate week           | High       | More than one row for the same employee and week   |
| Week ending not Saturday | Medium     | `week_ending` falls on another weekday             |

Rows with invalid values (a non-numeric rate, an impossible date, an unknown level) are rejected and reported. All other rows are kept and flagged, so no data is silently dropped.
