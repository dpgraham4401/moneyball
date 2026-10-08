import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("normalizes headers and values, skips blank lines", () => {
    const { rows, errors } = parseCsv(' Worker ,Hours\n Alice , 8 \n\n"Smith, Bob",10\n   \n');
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { worker: "Alice", hours: "8" },
      { worker: "Smith, Bob", hours: "10" },
    ]);
  });

  it("reports malformed rows with 1-based data row numbers", () => {
    const { errors } = parseCsv("worker,hours\nAlice,8\nBob,10,extra\n");
    expect(errors).toHaveLength(1);
    expect(errors[0].row).toBe(2);
  });
});
