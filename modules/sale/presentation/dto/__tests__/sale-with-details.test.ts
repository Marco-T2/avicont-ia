import { describe, expect, it } from "vitest";

import type {
  PaymentAllocationSummary,
  ReceivableSummary,
  SaleDetailRow,
  SaleWithDetails,
} from "../sale-with-details";

/**
 * Smoke type-check para DTO presentation Sale — migrado bit-exact
 * (POC #11.0a A5 β + POC nuevo A3-C7 atomic delete commit ad36da2).
 * Cobertura: import resolution + shape literal compile-time. Paridad shape
 * lockeada (D-A5#5 α displayCode = DTO presentation property, no aggregate hex).
 */

describe("sale-with-details DTO (smoke)", () => {
  it("compiles SaleWithDetails partial literal with displayCode", () => {
    const sale: Pick<
      SaleWithDetails,
      "id" | "totalAmount" | "displayCode"
    > = {
      id: "sale-1",
      totalAmount: 100,
      displayCode: "S-001",
    };
    expect(sale.displayCode).toBe("S-001");
    expect(sale.totalAmount).toBe(100);
  });

  it("compiles ReceivableSummary with empty allocations", () => {
    const allocations: PaymentAllocationSummary[] = [];
    const r: ReceivableSummary = {
      id: "r-1",
      amount: 50,
      paid: 0,
      balance: 50,
      status: "PENDING",
      dueDate: new Date("2025-01-31"),
      allocations,
    };
    expect(r.balance).toBe(r.amount - r.paid);
  });

  it("compiles SaleDetailRow with nullable lineAmount/quantity/unitPrice override", () => {
    const row: Pick<
      SaleDetailRow,
      "id" | "lineAmount" | "quantity" | "unitPrice"
    > = {
      id: "row-1",
      lineAmount: 10,
      quantity: null,
      unitPrice: null,
    };
    expect(row.lineAmount).toBe(10);
    expect(row.quantity).toBeNull();
  });
});
