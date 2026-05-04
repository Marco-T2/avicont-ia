import { describe, expect, it } from "vitest";

import type {
  PaymentAllocationSummary,
  PayableSummary,
  PurchaseDetailRow,
  PurchaseWithDetails,
} from "../purchase-with-details";

/**
 * Smoke type-check para DTO presentation Purchase — migrado bit-exact
 * (POC nuevo A3-C1 + atomic delete A3-C8 commit 4aa8480). Cobertura: import
 * resolution + shape literal compile-time. Paridad shape lockeada (D-A5#5 α
 * displayCode = DTO presentation property, no aggregate hex).
 *
 * Mirror sale precedent
 * `modules/sale/presentation/dto/__tests__/sale-with-details.test.ts`.
 */

describe("purchase-with-details DTO (smoke)", () => {
  it("compiles PurchaseWithDetails partial literal with displayCode", () => {
    const purchase: Pick<
      PurchaseWithDetails,
      "id" | "totalAmount" | "displayCode"
    > = {
      id: "purchase-1",
      totalAmount: 100,
      displayCode: "FL-001",
    };
    expect(purchase.displayCode).toBe("FL-001");
    expect(purchase.totalAmount).toBe(100);
  });

  it("compiles PayableSummary with empty allocations", () => {
    const allocations: PaymentAllocationSummary[] = [];
    const p: PayableSummary = {
      id: "p-1",
      amount: 50,
      paid: 0,
      balance: 50,
      status: "PENDING",
      dueDate: new Date("2025-01-31"),
      allocations,
    };
    expect(p.balance).toBe(p.amount - p.paid);
  });

  it("compiles PurchaseDetailRow with nullable lineAmount/quantity/unitPrice override", () => {
    const row: Pick<
      PurchaseDetailRow,
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
