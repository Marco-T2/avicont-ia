import { describe, expect, it } from "vitest";

import type {
  JournalLedgerQueryPort,
  LedgerAggregateRow,
} from "../journal-ledger-query.port";

/**
 * Contract test for the contact-keyed read surface of `JournalLedgerQueryPort`
 * (contact-ledger-refactor — C1 RED).
 *
 * Mirrors the sister account-keyed contract (findLinesByAccountPaginated /
 * aggregateByAccount) one layer over: same port, same shape family, contact
 * as the keying axis instead of account.
 *
 * Expected failure mode for THIS commit (RED, per
 * [[red_acceptance_failure_mode]]): the in-test minimal mock implements ONLY
 * the methods that exist on the current port surface. The three new methods
 * (`findLinesByContactPaginated`, `findOpeningBalanceByContact`,
 * `aggregateOpenBalanceByContact`) are unimplemented, so each `await` should
 * throw `TypeError: ... is not a function`. NOT a value-mismatch failure —
 * if the failure mode is anything else, the GREEN step is wrong.
 *
 * Method access goes through `(port as PortWithContactReads)` — the new method
 * names are declared in this test's narrow widening type ONLY so the file
 * compiles BEFORE GREEN extends the production port. After GREEN the runtime
 * methods exist on the in-memory fake (and on the Prisma adapter in C2), so
 * these three tests turn green without any change to the test file itself.
 *
 * GREEN (next commit) adds the 3 method signatures + `ContactLedgerLineRow`
 * + `ContactLedgerPageResult` to the port and extends the in-memory fake at
 * `application/__tests__/fakes/in-memory-accounting-uow.ts` so the suite
 * stays green outside this file.
 */

const ORG_ID = "org-1";
const CONTACT_ID = "contact-1";

/**
 * Narrow widening: declares the EXPECTED method names so this test file
 * compiles regardless of port surface evolution. Runtime presence is the
 * actual contract under test.
 */
type PortWithContactReads = JournalLedgerQueryPort & {
  findLinesByContactPaginated: (
    organizationId: string,
    contactId: string,
    filters?: unknown,
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
  ) => Promise<LedgerAggregateRow>;
};

/**
 * Minimal in-test mock that satisfies the CURRENT port surface only. The
 * three new methods are deliberately absent — calling them must throw
 * `TypeError: ... is not a function` (the RED assertion target).
 */
function makeBareMock(): PortWithContactReads {
  return {} as unknown as PortWithContactReads;
}

describe("JournalLedgerQueryPort — contact-keyed read surface (C1 RED)", () => {
  it("findLinesByContactPaginated returns ContactLedgerPageResult shape", async () => {
    const port = makeBareMock();

    const result = await port.findLinesByContactPaginated(ORG_ID, CONTACT_ID);

    expect(result).toMatchObject({
      items: expect.any(Array),
      total: expect.any(Number),
      page: expect.any(Number),
      pageSize: expect.any(Number),
      totalPages: expect.any(Number),
    });
    expect(result).toHaveProperty("openingBalanceDelta");
  });

  it("findOpeningBalanceByContact returns a Decimal-coercible value", async () => {
    const port = makeBareMock();

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
    const port = makeBareMock();

    const aggregate = await port.aggregateOpenBalanceByContact(
      ORG_ID,
      CONTACT_ID,
    );

    expect(aggregate).toHaveProperty("_sum");
    expect(aggregate._sum).toHaveProperty("debit");
    expect(aggregate._sum).toHaveProperty("credit");
  });
});
