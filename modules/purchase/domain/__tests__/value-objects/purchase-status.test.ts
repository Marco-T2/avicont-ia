import { describe, it, expect } from "vitest";
import {
  PURCHASE_STATUSES,
  type PurchaseStatus,
  parsePurchaseStatus,
} from "../../value-objects/purchase-status";
import { InvalidPurchaseStatus } from "../../errors/purchase-errors";

describe("PurchaseStatus", () => {
  it("expone el set completo de estados válidos en orden Prisma", () => {
    expect(PURCHASE_STATUSES).toEqual(["DRAFT", "POSTED", "LOCKED", "VOIDED"]);
  });

  it.each(PURCHASE_STATUSES)("parsea %s como PurchaseStatus válido", (value) => {
    expect(parsePurchaseStatus(value)).toBe(value);
  });

  it("rechaza un string desconocido", () => {
    expect(() => parsePurchaseStatus("PENDING" as PurchaseStatus)).toThrow(
      InvalidPurchaseStatus,
    );
  });

  it("rechaza un string vacío", () => {
    expect(() => parsePurchaseStatus("" as PurchaseStatus)).toThrow(InvalidPurchaseStatus);
  });

  it("rechaza un valor no-string", () => {
    expect(() =>
      parsePurchaseStatus(123 as unknown as PurchaseStatus),
    ).toThrow(InvalidPurchaseStatus);
  });
});
