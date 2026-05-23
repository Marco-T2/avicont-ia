/**
 * pago-credit-system Phase 6 — pure credit-source / cash-allocation helpers
 * extracted from payment-form.tsx (Extract-Before-Mock; sibling precedent
 * payment-form.glosa-helpers.ts). Tested directly, zero DOM mocks.
 *
 * buildCreditSources generalizes the credit gate from receivable-only to the
 * active direction's allocations: COBRO → receivable lines (receivableId),
 * PAGO → payable lines (payableId), per AllocationTarget XOR. buildCashAllocations
 * subtracts credit per target by whichever id is present (replaces the Batch-2
 * non-behavioral `if (!cs.receivableId) continue;` guard).
 *
 * Strict TDD: this RED references functions that do NOT exist yet
 * (payment-form.credit-helpers.ts) — the import rejects, failing every case.
 * That IS the declared RED (helpers not extracted/implemented yet).
 */
import { describe, it, expect } from "vitest";
import {
  buildCreditSources,
  buildCashAllocations,
  type CreditLineForSources,
  type AllocationForSources,
} from "../payment-form.credit-helpers";

function recv(id: string, assigned: string, dueDate: string): AllocationForSources {
  return { id, type: "receivable", assignedAmount: assigned, dueDate, checked: true };
}
function pay(id: string, assigned: string, dueDate: string): AllocationForSources {
  return { id, type: "payable", assignedAmount: assigned, dueDate, checked: true };
}
function credit(sourcePaymentId: string, assigned: string): CreditLineForSources {
  return { sourcePaymentId, assignedAmount: assigned, checked: true };
}

describe("buildCreditSources — direction-generalized credit gate", () => {
  it("(PAGO) builds sources from checked payable allocations carrying payableId", () => {
    const sources = buildCreditSources(
      [credit("src-1", "50")],
      [pay("payable-1", "50", "2026-06-01")],
      "PAGO",
    );

    expect(sources).toEqual([
      { sourcePaymentId: "src-1", payableId: "payable-1", amount: 50 },
    ]);
  });

  it("(PAGO) excludes receivable allocations from the PAGO source set", () => {
    const sources = buildCreditSources(
      [credit("src-1", "50")],
      [recv("recv-1", "50", "2026-06-01"), pay("payable-1", "50", "2026-06-02")],
      "PAGO",
    );

    expect(sources).toEqual([
      { sourcePaymentId: "src-1", payableId: "payable-1", amount: 50 },
    ]);
  });

  it("(COBRO) builds sources from checked receivable allocations carrying receivableId (unchanged)", () => {
    const sources = buildCreditSources(
      [credit("src-1", "30")],
      [recv("recv-1", "30", "2026-06-01")],
      "COBRO",
    );

    expect(sources).toEqual([
      { sourcePaymentId: "src-1", receivableId: "recv-1", amount: 30 },
    ]);
  });

  it("(COBRO) FIFO-distributes one credit across multiple receivables by dueDate", () => {
    const sources = buildCreditSources(
      [credit("src-1", "120")],
      [
        recv("recv-late", "100", "2026-07-01"),
        recv("recv-early", "100", "2026-06-01"),
      ],
      "COBRO",
    );

    // earliest dueDate consumed first
    expect(sources).toEqual([
      { sourcePaymentId: "src-1", receivableId: "recv-early", amount: 100 },
      { sourcePaymentId: "src-1", receivableId: "recv-late", amount: 20 },
    ]);
  });

  it("returns [] when no credit lines are checked", () => {
    expect(
      buildCreditSources(
        [{ sourcePaymentId: "src-1", assignedAmount: "0", checked: true }],
        [pay("payable-1", "50", "2026-06-01")],
        "PAGO",
      ),
    ).toEqual([]);
  });

  it("(PAGO) returns [] when no payable allocations are checked", () => {
    expect(
      buildCreditSources(
        [credit("src-1", "50")],
        [pay("payable-1", "0", "2026-06-01")],
        "PAGO",
      ),
    ).toEqual([]);
  });
});

describe("buildCashAllocations — credit subtracted per target (receivable or payable)", () => {
  it("(PAGO) subtracts payable credit from the payable cash portion", () => {
    const active = [pay("payable-1", "50", "2026-06-01")];
    const creditSources = [
      { sourcePaymentId: "src-1", payableId: "payable-1", amount: 30 },
    ];

    const allocs = buildCashAllocations(creditSources, active);

    expect(allocs).toEqual([{ payableId: "payable-1", amount: 20 }]);
  });

  it("(PAGO) drops fully-credited payable lines (cash portion 0)", () => {
    const active = [pay("payable-1", "50", "2026-06-01")];
    const creditSources = [
      { sourcePaymentId: "src-1", payableId: "payable-1", amount: 50 },
    ];

    expect(buildCashAllocations(creditSources, active)).toEqual([]);
  });

  it("(COBRO) subtracts receivable credit from the receivable cash portion (unchanged)", () => {
    const active = [recv("recv-1", "50", "2026-06-01")];
    const creditSources = [
      { sourcePaymentId: "src-1", receivableId: "recv-1", amount: 30 },
    ];

    expect(buildCashAllocations(creditSources, active)).toEqual([
      { receivableId: "recv-1", amount: 20 },
    ]);
  });

  it("emits full cash portion when there are no credit sources", () => {
    const active = [pay("payable-1", "50", "2026-06-01")];

    expect(buildCashAllocations([], active)).toEqual([
      { payableId: "payable-1", amount: 50 },
    ]);
  });
});
