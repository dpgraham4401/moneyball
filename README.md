# MoneyBall

A dashboard for reviewing weekly payroll for [Prevailing Wages and Apprenticeship](https://www.irs.gov/credits-deductions/prevailing-wage-and-apprenticeship-requirements) compliance.
It shows summary statistics, per-employee statistics and likely data-entry errors.

## Requirements

- Node.js 26
- pnpm

## Getting started

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000/.

Pre-commit git hooks run Prettier and ESLint on staged files.

## Project structure

```
data/payroll_data.csv          Source data
src/lib/payroll/               Reusable logic for detecting anomalies, payroll stats
  types.ts                     Source-agnostic data model (DTO), can be read from CSV, DB, ect.
  stats.ts                     Summary and per-employee statistics
  anomalies.ts                 Anomaly rules and thresholds
src/app/                       The Next.js application that handles routing and server/client side rendered components.
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

Each anomaly has a severity and keeps a reference to its source record. Every threshold is configurable in `DEFAULT_THRESHOLDS`.

| Check                    | Severity   | Rule                                                                                        |
| ------------------------ | ---------- | ------------------------------------------------------------------------------------------- |
| Standard rate deviation  | High       | More than 20% from the employee's own median rate (needs 3+ weeks of history)               |
| Benefits rate deviation  | Medium     | More than 20% from the employee's own median rate                                           |
| Overtime rate mismatch   | Medium     | Overtime rate is not 1.5x the standard rate                                                 |
| Long day / short day     | High / Low | Over 14 h / under 3 h on a worked day                                                       |
| Long week / short week   | High / Low | Over 60 h / under 16 h                                                                      |
| unpaid overtime          | Medium     | More than 40 standard hours in a week (likely unpaid overtime)                              |
| Apprentice ratio         | Medium     | More apprentices than journeyworkers of the same trade on a day (default 1:1, configurable) |
| Rate vs trade peers      | Medium     | Usual rate more than 25% from the median for the same trade and level (groups of 3+)        |
| Name mismatch            | Medium     | Name differs from the most common name for that ID                                          |
| Duplicate week           | High       | More than one row for the same employee and week                                            |
| Week ending not Saturday | Medium     | `week_ending` falls on another weekday                                                      |

Rows with invalid values (a non-numeric rate, an impossible date, an unknown level) are rejected and reported. All other rows are kept and flagged, so no data is silently dropped.
