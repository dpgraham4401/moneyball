const currencyFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const wholeCurrencyFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

/** 2705 → "$27.05" */
export const formatCents = (cents: number) => currencyFormat.format(cents / 100);
/** 37811800 → "$378,118" — for large totals where cents are noise. */
export const formatWholeDollars = (cents: number) => wholeCurrencyFormat.format(cents / 100);
/** 85.8999 → "85.9" */
export const formatHours = (hours: number) => numberFormat.format(hours);
/** 0.1234 → "12.3%" */
export const formatPercent = (fraction: number) => `${numberFormat.format(fraction * 100)}%`;
/** "2025-03-01" → "Mar 1, 2025" (dates are calendar dates, so format in UTC). */
export const formatDate = (isoDate: string) =>
  new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
