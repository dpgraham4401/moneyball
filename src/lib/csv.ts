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
    transformHeader: (header) => header.trim().toLowerCase(),
    transform: (value) => value.trim(),
  });
  return {
    rows: data,
    errors: errors.map((error) => ({ row: (error.row ?? -1) + 1, message: error.message })),
  };
}
