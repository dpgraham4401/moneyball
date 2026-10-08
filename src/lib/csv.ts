import Papa from "papaparse";

export type CsvRow = Record<string, string>;

export type CsvResult = {
  rows: CsvRow[];
  errors: { row: number; message: string }[];
};

/** Parse CSV text into rows keyed by header. Headers are trimmed and lowercased; values are trimmed. */
export function parseCsv(text: string): CsvResult {
  const { data, errors } = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase(),
    transform: (v) => v.trim(),
  });
  return {
    rows: data,
    errors: errors.map((e) => ({ row: (e.row ?? -1) + 1, message: e.message })),
  };
}
