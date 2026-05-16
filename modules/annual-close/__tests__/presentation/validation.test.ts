/**
 * Phase 5.3 RED — `annualCloseRequestSchema` Zod validation.
 *
 * Per design rev 2 §6 + spec REQ-2.1 (justification + year gates) + REQ-7.4
 * (voseo Rioplatense for user-facing strings):
 *   - `year` coerced int ∈ [1900, 2100]
 *   - `justification` string min 50 chars
 *   - error messages in voseo Rioplatense
 *
 * Declared failure mode (pre-GREEN):
 *   - module exports `{}` (Phase 5.2 stub) — `annualCloseRequestSchema` undefined
 *   - every assertion that calls `.parse()` throws TypeError on `undefined.parse`
 *
 * Per [[red_acceptance_failure_mode]] this is the legitimate RED mode.
 * GREEN flips at Phase 5.4 once validation.ts ships the real schema.
 */
import { describe, it, expect } from "vitest";

import { annualCloseRequestSchema } from "@/modules/annual-close/presentation/validation";

describe("Phase 5.3 RED — annualCloseRequestSchema", () => {
  describe("happy path", () => {
    it("accepts a valid {year, justification}", () => {
      const result = annualCloseRequestSchema.parse({
        year: 2025,
        justification:
          "Cierre de la gestión anual 2025 — aprobado por dirección financiera tras revisión.",
      });
      expect(result.year).toBe(2025);
      expect(result.justification.length).toBeGreaterThanOrEqual(50);
    });

    it("coerces year from string input", () => {
      const result = annualCloseRequestSchema.parse({
        year: "2024" as unknown as number,
        justification:
          "Cierre del ejercicio 2024 luego de conciliar todos los movimientos pendientes del mes de diciembre.",
      });
      expect(result.year).toBe(2024);
    });
  });

  describe("year validation", () => {
    it("rejects year < 1900", () => {
      const out = annualCloseRequestSchema.safeParse({
        year: 1899,
        justification: "x".repeat(60),
      });
      expect(out.success).toBe(false);
    });

    it("rejects year > 2100", () => {
      const out = annualCloseRequestSchema.safeParse({
        year: 2101,
        justification: "x".repeat(60),
      });
      expect(out.success).toBe(false);
    });

    it("rejects non-integer year", () => {
      const out = annualCloseRequestSchema.safeParse({
        year: 2025.5,
        justification: "x".repeat(60),
      });
      expect(out.success).toBe(false);
    });
  });

  describe("justification validation (REQ-2.1 ≥50 chars + voseo message)", () => {
    it("rejects justification < 50 chars", () => {
      const out = annualCloseRequestSchema.safeParse({
        year: 2025,
        justification: "Cierre", // 6 chars
      });
      expect(out.success).toBe(false);
      if (!out.success) {
        const justificationIssue = out.error.issues.find((issue) =>
          issue.path.includes("justification"),
        );
        expect(justificationIssue).toBeDefined();
        // Voseo Rioplatense (REQ-7.4): message uses voseo or rioplatense
        // phrasing. Anchor: includes "al menos 50" (matches design §6 spec).
        expect(justificationIssue?.message).toMatch(/al menos 50/i);
      }
    });

    it("accepts justification == 50 chars (boundary)", () => {
      const out = annualCloseRequestSchema.safeParse({
        year: 2025,
        justification: "x".repeat(50),
      });
      expect(out.success).toBe(true);
    });

    it("rejects missing justification", () => {
      const out = annualCloseRequestSchema.safeParse({ year: 2025 });
      expect(out.success).toBe(false);
    });
  });
});
