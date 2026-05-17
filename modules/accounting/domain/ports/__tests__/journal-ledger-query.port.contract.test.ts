import { describe, expect, it } from "vitest";

import { InMemoryJournalLedgerQueryPort } from "@/modules/accounting/application/__tests__/fakes/in-memory-accounting-uow";

/**
 * Contract test for the contact-keyed read surface of `JournalLedgerQueryPort`
 * (contact-ledger-refactor — C1).
 *
 * Mirrors the sister account-keyed contract (findLinesByAccountPaginated /
 * aggregateByAccount) one layer over: same port, same shape family, contact
 * as the keying axis instead of account.
 *
 * RED expected failure mode per [[red_acceptance_failure_mode]]: the in-memory
 * fake does not yet implement `findLinesByContactPaginated`,
 * `findOpeningBalanceByContact`, or `aggregateOpenBalanceByContact` → each
 * `await` throws `TypeError: ... is not a function`. NOT a value-mismatch
 * failure.
 *
 * The methods are accessed through a narrow widening type
 * (`PortWithContactReads`) so the file COMPILES in the RED commit — runtime
 * presence on the fake is the actual assertion target.
 *
 * GREEN extends `JournalLedgerQueryPort` with the 3 method signatures
 * + `ContactLedgerLineRow` / `ContactLedgerPageResult` and adds the matching
 * no-op defaults to `InMemoryJournalLedgerQueryPort`. Adapter
 * (`PrismaJournalLedgerQueryAdapter`) ships throwing stubs — Prisma SQL
 * lands in C2.
 */

const ORG_ID = "org-1";
const CONTACT_ID = "contact-1";

/**
 * Narrow widening: declares the EXPECTED method names so this test file
 * compiles regardless of port surface evolution. Runtime presence on
 * `InMemoryJournalLedgerQueryPort` is the actual contract under test.
 */
type PortWithContactReads = InMemoryJournalLedgerQueryPort & {
  findLinesByContactPaginated: (
    organizationId: string,
    contactId: string,
    filters?: { accountCodes?: string[] } & Record<string, unknown>,
    pagination?: unknown,
  ) => Promise<{
    items: unknown[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    openingBalanceDelta: unknown;
  }>;
  findOpeningBalanceByContact: (
    organizationId: string,
    contactId: string,
    dateFrom: Date,
  ) => Promise<unknown>;
  aggregateOpenBalanceByContact: (
    organizationId: string,
    contactId: string,
  ) => Promise<{ _sum: { debit: unknown; credit: unknown } }>;
};

function makePort(): PortWithContactReads {
  return new InMemoryJournalLedgerQueryPort() as PortWithContactReads;
}

describe("JournalLedgerQueryPort — contact-keyed read surface (C1)", () => {
  it("findLinesByContactPaginated returns ContactLedgerPageResult shape", async () => {
    const port = makePort();

    const result = await port.findLinesByContactPaginated(ORG_ID, CONTACT_ID);

    expect(result).toMatchObject({
      items: expect.any(Array),
      total: expect.any(Number),
      page: expect.any(Number),
      pageSize: expect.any(Number),
      totalPages: expect.any(Number),
    });
    expect(result).toHaveProperty("openingBalanceDelta");
    // Empty-by-default safety: a test forgetting to prime gets [] / 0,
    // not phantom rows. Parity with account-keyed sister.
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("findOpeningBalanceByContact returns a Decimal-coercible value", async () => {
    const port = makePort();

    const opening = await port.findOpeningBalanceByContact(
      ORG_ID,
      CONTACT_ID,
      new Date("2026-01-01T00:00:00.000Z"),
    );

    // Coerces to a finite number via String(...) — mirrors how the service
    // wraps `new Decimal(String(opening))` per DEC-1.
    expect(Number.isFinite(Number(String(opening)))).toBe(true);
  });

  it("aggregateOpenBalanceByContact returns LedgerAggregateRow shape", async () => {
    const port = makePort();

    const aggregate = await port.aggregateOpenBalanceByContact(
      ORG_ID,
      CONTACT_ID,
    );

    expect(aggregate).toHaveProperty("_sum");
    expect(aggregate._sum).toHaveProperty("debit");
    expect(aggregate._sum).toHaveProperty("credit");
  });

  it("BF1 — findLinesByContactPaginated accepts an `accountCodes` filter that the fake records for assertion (real adapter narrows the where to account.code IN [...])", async () => {
    // BF1: the contact-ledger view must scope movements to the org-wide
    // CxC/CxP control accounts so contrapartida lines (Caja, Ventas, etc.)
    // do not duplicate the JE in the running balance.
    // Contract: filters.accountCodes is propagated all the way down. The fake
    // captures the last filters arg so the test can assert it round-trips.
    const port = makePort();
    const codes = ["1.1.4.1", "2.1.1.1"];

    await port.findLinesByContactPaginated(ORG_ID, CONTACT_ID, {
      accountCodes: codes,
    });

    expect(port.findLinesByContactPaginatedLastFilters).toEqual({
      accountCodes: codes,
    });
  });
});
