/**
 * T05 — RED: Zod validation schema tests.
 *
 * Covers: REQ-10 (date range validation), REQ-11 (format enum)
 */

import { describe, it, expect } from "vitest";
import { ZodError } from "zod";

describe("equityStatementQuerySchema", () => {
  it("valid range → parses OK; format defaults to 'json'", async () => {
    const { equityStatementQuerySchema } = await import("../equity-statement.validation");
    const result = equityStatementQuerySchema.parse({
      dateFrom: "2024-01-01",
      dateTo: "2024-12-31",
    });
    expect(result.dateFrom).toBe("2024-01-01");
    expect(result.dateTo).toBe("2024-12-31");
    expect(result.format).toBe("json");
  });

  it("missing dateFrom → ZodError with path ['dateFrom']", async () => {
    const { equityStatementQuerySchema } = await import("../equity-statement.validation");
    let caught: unknown;
    try {
      equityStatementQuerySchema.parse({ dateTo: "2024-12-31" });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ZodError);
    const ze = caught as ZodError;
    // Zod v4 uses .issues; fallback to .errors for v3
    const issues = ze.issues ?? (ze as unknown as { errors: typeof ze.issues }).errors;
    expect(issues.some((err) => err.path.includes("dateFrom"))).toBe(true);
  });

  it("missing dateTo → ZodError", async () => {
    const { equityStatementQuerySchema } = await import("../equity-statement.validation");
    expect(() =>
      equityStatementQuerySchema.parse({ dateFrom: "2024-01-01" }),
    ).toThrow(ZodError);
  });

  it("dateFrom > dateTo → ZodError with path ['dateFrom'] and message about 'anterior o igual'", async () => {
    const { equityStatementQuerySchema } = await import("../equity-statement.validation");
    let caught: unknown;
    try {
      equityStatementQuerySchema.parse({ dateFrom: "2024-12-31", dateTo: "2024-01-01" });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ZodError);
    const ze = caught as ZodError;
    const issues = ze.issues ?? (ze as unknown as { errors: typeof ze.issues }).errors;
    const err = issues.find((e) => e.path.includes("dateFrom"));
    expect(err).toBeDefined();
    expect(err?.message).toContain("anterior o igual");
  });

  it("invalid date format 'not-a-date' → ZodError", async () => {
    const { equityStatementQuerySchema } = await import("../equity-statement.validation");
    expect(() =>
      equityStatementQuerySchema.parse({ dateFrom: "not-a-date", dateTo: "2024-12-31" }),
    ).toThrow(ZodError);
  });

  it("format='csv' (not in enum) → ZodError", async () => {
    const { equityStatementQuerySchema } = await import("../equity-statement.validation");
    expect(() =>
      equityStatementQuerySchema.parse({ dateFrom: "2024-01-01", dateTo: "2024-12-31", format: "csv" }),
    ).toThrow(ZodError);
  });

  it("format='pdf' → parses OK with result.format === 'pdf'", async () => {
    const { equityStatementQuerySchema } = await import("../equity-statement.validation");
    const result = equityStatementQuerySchema.parse({
      dateFrom: "2024-01-01",
      dateTo: "2024-12-31",
      format: "pdf",
    });
    expect(result.format).toBe("pdf");
  });

  it("format='xlsx' → parses OK", async () => {
    const { equityStatementQuerySchema } = await import("../equity-statement.validation");
    const result = equityStatementQuerySchema.parse({
      dateFrom: "2024-01-01",
      dateTo: "2024-12-31",
      format: "xlsx",
    });
    expect(result.format).toBe("xlsx");
  });
});
