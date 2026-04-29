import { describe, it, expect } from "vitest";
import {
  SALE_STATUSES,
  type SaleStatus,
  parseSaleStatus,
} from "../../value-objects/sale-status";
import { InvalidSaleStatus } from "../../errors/sale-errors";

describe("SaleStatus", () => {
  it("expone el set completo de estados válidos en orden Prisma", () => {
    expect(SALE_STATUSES).toEqual(["DRAFT", "POSTED", "LOCKED", "VOIDED"]);
  });

  it.each(SALE_STATUSES)("parsea %s como SaleStatus válido", (value) => {
    expect(parseSaleStatus(value)).toBe(value);
  });

  it("rechaza un string desconocido", () => {
    expect(() => parseSaleStatus("PENDING" as SaleStatus)).toThrow(
      InvalidSaleStatus,
    );
  });

  it("rechaza un string vacío", () => {
    expect(() => parseSaleStatus("" as SaleStatus)).toThrow(InvalidSaleStatus);
  });

  it("rechaza un valor no-string", () => {
    expect(() =>
      parseSaleStatus(123 as unknown as SaleStatus),
    ).toThrow(InvalidSaleStatus);
  });
});
