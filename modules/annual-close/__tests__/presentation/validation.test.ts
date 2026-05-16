/**
 * `annualCloseRequestSchema` Zod validation — post-justification-removal.
 *
 * Per design rev 2 §6 + spec REQ-7.4 (voseo Rioplatense for user-facing strings):
 *   - `year` coerced int ∈ [1900, 2100]
 *   - `justification` field REMOVED from request schema. Auto-generated
 *     server-side by the route handler (always ≥50 chars), still satisfies
 *     the service's MIN_JUSTIFICATION_LENGTH pre-tx gate.
 *   - error messages in voseo Rioplatense
 */
import { describe, it, expect } from "vitest";

import { annualCloseRequestSchema } from "@/modules/annual-close/presentation/validation";

describe("annualCloseRequestSchema (post-justification-removal)", () => {
  describe("happy path", () => {
    it("accepts a valid {year}", () => {
      const result = annualCloseRequestSchema.parse({ year: 2025 });
      expect(result.year).toBe(2025);
    });

    it("coerces year from string input", () => {
      const result = annualCloseRequestSchema.parse({
        year: "2024" as unknown as number,
      });
      expect(result.year).toBe(2024);
    });

    it("does NOT require justification anymore (auto-generated server-side)", () => {
      const out = annualCloseRequestSchema.safeParse({ year: 2025 });
      expect(out.success).toBe(true);
    });
  });

  describe("year validation", () => {
    it("rejects year < 1900", () => {
      const out = annualCloseRequestSchema.safeParse({ year: 1899 });
      expect(out.success).toBe(false);
    });

    it("rejects year > 2100", () => {
      const out = annualCloseRequestSchema.safeParse({ year: 2101 });
      expect(out.success).toBe(false);
    });

    it("rejects non-integer year", () => {
      const out = annualCloseRequestSchema.safeParse({ year: 2025.5 });
      expect(out.success).toBe(false);
    });
  });
});
