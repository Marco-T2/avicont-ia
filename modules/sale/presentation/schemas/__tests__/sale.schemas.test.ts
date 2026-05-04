import { describe, expect, it } from "vitest";

import {
  createSaleSchema,
  saleFiltersSchema,
  saleStatusSchema,
  updateSaleSchema,
} from "../sale.schemas";

/**
 * Zod presentation schemas migrados bit-exact (POC #11.0a A5 β + POC nuevo
 * A3-C7 atomic delete commit ad36da2). Cobertura mínima por schema: 1 parse
 * válido + 1+ inválidos por requirement crítico — paridad bit-exact con legacy.
 */

describe("Sale presentation schemas", () => {
  describe("createSaleSchema", () => {
    it("parses minimal valid input", () => {
      const parsed = createSaleSchema.parse({
        date: "2025-01-15",
        contactId: "contact-1",
        periodId: "period-1",
        description: "Test sale",
        details: [{ description: "Line 1", incomeAccountId: "acc-1" }],
      });
      expect(parsed.description).toBe("Test sale");
      expect(parsed.details).toHaveLength(1);
    });

    it("rejects empty details array (.min(1))", () => {
      expect(() =>
        createSaleSchema.parse({
          date: "2025-01-15",
          contactId: "contact-1",
          periodId: "period-1",
          description: "Test sale",
          details: [],
        }),
      ).toThrow();
    });

    it("rejects missing contactId", () => {
      expect(() =>
        createSaleSchema.parse({
          date: "2025-01-15",
          periodId: "period-1",
          description: "Test sale",
          details: [{ description: "Line 1", incomeAccountId: "acc-1" }],
        }),
      ).toThrow();
    });
  });

  describe("updateSaleSchema", () => {
    it("parses empty object (all fields optional)", () => {
      expect(updateSaleSchema.parse({})).toEqual({});
    });

    it("rejects description exceeding 500 chars", () => {
      expect(() =>
        updateSaleSchema.parse({ description: "x".repeat(501) }),
      ).toThrow();
    });
  });

  describe("saleFiltersSchema", () => {
    it("parses empty object (all fields optional)", () => {
      expect(saleFiltersSchema.parse({})).toEqual({});
    });

    it("coerces date strings to Date for dateFrom/dateTo", () => {
      const parsed = saleFiltersSchema.parse({
        dateFrom: "2025-01-01",
        dateTo: "2025-01-31",
      });
      expect(parsed.dateFrom).toBeInstanceOf(Date);
      expect(parsed.dateTo).toBeInstanceOf(Date);
    });

    it("rejects invalid status enum value", () => {
      expect(() => saleFiltersSchema.parse({ status: "INVALID" })).toThrow();
    });
  });

  describe("saleStatusSchema", () => {
    it("parses POSTED without justification", () => {
      const parsed = saleStatusSchema.parse({ status: "POSTED" });
      expect(parsed.status).toBe("POSTED");
      expect(parsed.justification).toBeUndefined();
    });

    it("parses VOIDED with justification >= 10 chars", () => {
      const parsed = saleStatusSchema.parse({
        status: "VOIDED",
        justification: "Cliente canceló por error",
      });
      expect(parsed.justification).toBe("Cliente canceló por error");
    });

    it("rejects DRAFT status (enum violation)", () => {
      expect(() => saleStatusSchema.parse({ status: "DRAFT" })).toThrow();
    });

    it("rejects justification with <10 chars", () => {
      expect(() =>
        saleStatusSchema.parse({
          status: "VOIDED",
          justification: "short",
        }),
      ).toThrow();
    });
  });
});
