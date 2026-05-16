/**
 * POC pagination-ledger C1 RED — port behavioral contract for
 * `findLinesByAccountPaginated`.
 *
 * Targets the fake `InMemoryJournalLedgerQueryPort` (port-level isolation —
 * no Prisma, no real DB). Asserts the BEHAVIORAL CONTRACT that BOTH the fake
 * AND the real Prisma adapter must honor downstream.
 *
 * Sister precedent: poc-pagination-journal C1 unit tests (Journal POC closed
 * `45135b82`). Mirror EXACT shape — port-level fake-driven assertions.
 *
 * Expected failure mode pre-GREEN per [[red_acceptance_failure_mode]]:
 *   - TypeError: `query.findLinesByAccountPaginated is not a function` —
 *     method doesn't exist yet on `InMemoryJournalLedgerQueryPort` interface
 *     (port nor fake declare it). 4/4 tests FAIL with this exact mode.
 *
 * Cross-ref:
 *   - spec #2553 REQ-1 (port method) + REQ-2 (3-query semantics) +
 *     SC-1 (page 3 math) + SC-3 (page 1 zero opening)
 *   - design #2554 §2.1-§2.4 + §7.2 fake update
 *   - tasks #2555 T-C1.1
 */
import { describe, expect, it } from "vitest";
import { InMemoryJournalLedgerQueryPort } from "./fakes/in-memory-accounting-uow";

function row(debit: number, credit: number, date: string, num: number) {
  return {
    debit,
    credit,
    description: null,
    journalEntry: {
      id: `je-${num}`,
      date: new Date(date),
      number: num,
      description: `E${num}`,
      voucherType: { code: "CD", prefix: "D" },
    },
  };
}

describe("InMemoryJournalLedgerQueryPort.findLinesByAccountPaginated (RED — port behavioral contract)", () => {
  it("T1 pagination math: page=2, pageSize=2 → skip=2 + take=2 → items[2..3] of 5-row collection", async () => {
    const query = new InMemoryJournalLedgerQueryPort();
    query.linesByAccountPaginated = [
      row(10, 0, "2099-01-01", 1),
      row(20, 0, "2099-01-02", 2),
      row(30, 0, "2099-01-03", 3),
      row(40, 0, "2099-01-04", 4),
      row(50, 0, "2099-01-05", 5),
    ];
    query.openingBalanceDeltaPrimed = 0;

    const result = await query.findLinesByAccountPaginated(
      "org-1",
      "acc-1",
      undefined,
      { page: 2, pageSize: 2 },
    );

    expect(result.items.map((r) => r.journalEntry.number)).toEqual([3, 4]);
    expect(result.total).toBe(5);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(2);
    expect(result.totalPages).toBe(3);
  });

  it("T2 page 1 zero opening: page=1 → openingBalanceDelta defaults to primed 0", async () => {
    const query = new InMemoryJournalLedgerQueryPort();
    query.linesByAccountPaginated = [row(100, 0, "2099-01-01", 1)];
    query.openingBalanceDeltaPrimed = 0;

    const result = await query.findLinesByAccountPaginated(
      "org-1",
      "acc-1",
      undefined,
      { page: 1, pageSize: 25 },
    );

    expect(result.openingBalanceDelta).toBe(0);
    expect(result.items).toHaveLength(1);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it("T3 page N opening: openingBalanceDeltaPrimed propagates verbatim through result", async () => {
    const query = new InMemoryJournalLedgerQueryPort();
    query.linesByAccountPaginated = [
      row(50, 0, "2099-02-01", 11),
      row(20, 0, "2099-02-02", 12),
    ];
    query.openingBalanceDeltaPrimed = 1000;

    const result = await query.findLinesByAccountPaginated(
      "org-1",
      "acc-1",
      undefined,
      { page: 1, pageSize: 25 },
    );

    expect(result.openingBalanceDelta).toBe(1000);
  });

  it("T4 default pagination: undefined pagination → page=1, pageSize=25", async () => {
    const query = new InMemoryJournalLedgerQueryPort();
    query.linesByAccountPaginated = [row(10, 0, "2099-01-01", 1)];
    query.openingBalanceDeltaPrimed = 0;

    const result = await query.findLinesByAccountPaginated(
      "org-1",
      "acc-1",
      undefined,
      undefined,
    );

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
    expect(result.totalPages).toBe(1);
    expect(result.items).toHaveLength(1);
  });
});
