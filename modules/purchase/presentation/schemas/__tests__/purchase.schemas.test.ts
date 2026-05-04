import { describe, expect, it } from "vitest";

import {
  createPurchaseSchema,
  purchaseFiltersSchema,
  updatePurchaseSchema,
} from "../purchase.schemas";

/**
 * Zod presentation schemas migrados bit-exact (POC nuevo A3-C1 + atomic delete
 * A3-C8 commit 4aa8480). Cobertura mínima por schema: 1 parse válido + 1+
 * inválidos por requirement crítico — paridad bit-exact con legacy.
 *
 * Mirror sale precedent
 * `modules/sale/presentation/schemas/__tests__/sale.schemas.test.ts` modulo
 * Q5 lock Marco (a) mirror legacy estricto: NO `purchaseStatusSchema` (3
 * schemas hex purchase vs 4 schemas hex sale — asimetría legítima).
 */

describe("Purchase presentation schemas", () => {
  describe("createPurchaseSchema", () => {
    it("parses minimal valid input", () => {
      const parsed = createPurchaseSchema.parse({
        purchaseType: "COMPRA_GENERAL",
        date: "2025-01-15",
        contactId: "contact-1",
        periodId: "period-1",
        description: "Test purchase",
        details: [{ description: "Line 1" }],
      });
      expect(parsed.description).toBe("Test purchase");
      expect(parsed.details).toHaveLength(1);
    });

    it("rejects empty details array (.min(1))", () => {
      expect(() =>
        createPurchaseSchema.parse({
          purchaseType: "COMPRA_GENERAL",
          date: "2025-01-15",
          contactId: "contact-1",
          periodId: "period-1",
          description: "Test purchase",
          details: [],
        }),
      ).toThrow();
    });

    it("rejects invalid purchaseType enum value", () => {
      expect(() =>
        createPurchaseSchema.parse({
          purchaseType: "INVALID_TYPE",
          date: "2025-01-15",
          contactId: "contact-1",
          periodId: "period-1",
          description: "Test purchase",
          details: [{ description: "Line 1" }],
        }),
      ).toThrow();
    });

    it("rejects missing contactId", () => {
      expect(() =>
        createPurchaseSchema.parse({
          purchaseType: "COMPRA_GENERAL",
          date: "2025-01-15",
          periodId: "period-1",
          description: "Test purchase",
          details: [{ description: "Line 1" }],
        }),
      ).toThrow();
    });
  });

  describe("updatePurchaseSchema", () => {
    it("parses empty object (all fields optional)", () => {
      expect(updatePurchaseSchema.parse({})).toEqual({});
    });

    it("rejects description exceeding 500 chars", () => {
      expect(() =>
        updatePurchaseSchema.parse({ description: "x".repeat(501) }),
      ).toThrow();
    });

    it("rejects shrinkagePct > 100", () => {
      expect(() =>
        updatePurchaseSchema.parse({ shrinkagePct: 101 }),
      ).toThrow();
    });
  });

  describe("purchaseFiltersSchema", () => {
    it("parses empty object (all fields optional)", () => {
      expect(purchaseFiltersSchema.parse({})).toEqual({});
    });

    it("coerces date strings to Date for dateFrom/dateTo", () => {
      const parsed = purchaseFiltersSchema.parse({
        dateFrom: "2025-01-01",
        dateTo: "2025-01-31",
      });
      expect(parsed.dateFrom).toBeInstanceOf(Date);
      expect(parsed.dateTo).toBeInstanceOf(Date);
    });

    it("rejects invalid status enum value", () => {
      expect(() =>
        purchaseFiltersSchema.parse({ status: "INVALID" }),
      ).toThrow();
    });

    it("rejects invalid purchaseType enum value", () => {
      expect(() =>
        purchaseFiltersSchema.parse({ purchaseType: "INVALID" }),
      ).toThrow();
    });
  });
});
