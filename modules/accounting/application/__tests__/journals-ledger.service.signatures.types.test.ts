/**
 * Type-level regression — hex `JournalsService` / `LedgerService` PUBLIC
 * method signatures.
 *
 * ── Why this file exists ──
 * sub-POC 8 (`poc-accounting-shim-retirement`) repointed ~26 `app/`
 * consumers from the deleted `features/accounting/` shims directly to the
 * hex factories `makeJournalsService()` / `makeLedgerService()`. Design D1
 * assumed the hex factory methods have "identical signatures to the shim
 * methods" — that assumption was FALSE for the WRITE paths:
 *
 *   • `createEntry` — shim was 2-arg `(orgId, input)`; the hex is 3-arg
 *     `(orgId, input, audit)`. The shim derived the `AuditUserContext`
 *     internally from `input.createdById`; direct repoints must pass it.
 *   • Return shape — the shim's writes re-hydrated the `JournalEntryWithLines`
 *     DTO (`number: number`) via `hex.getById()`. The hex `createEntry`
 *     returns the `Journal` AGGREGATE directly, whose `number` getter is
 *     `number | null` (a fresh DRAFT may carry no correlativo yet).
 *
 * `app/api/organizations/[orgSlug]/agent/route.ts` was missed in the C2
 * repoint and still called the 2-arg form. `vitest run` did NOT catch it —
 * the route test mocks `makeJournalsService` with a `vi.fn()` that accepts
 * any arity. Only `next build`'s full `tsc` pass surfaced it.
 *
 * This file pins the real signatures at the type level so a future arity /
 * return-shape drift fails `vitest run` directly, not just `build`.
 */

import { describe, it, expectTypeOf } from "vitest";
import type {
  JournalsService,
  AuditUserContext,
  CreateJournalEntryInput,
  UpdateJournalEntryInput,
} from "../journals.service";
import type { LedgerService } from "../ledger.service";
import type { Journal } from "../../domain/journal.entity";

describe("JournalsService — public write-method signatures (D1 regression)", () => {
  it("createEntry requires the 3rd AuditUserContext arg and returns the Journal aggregate", () => {
    expectTypeOf<JournalsService["createEntry"]>().parameters.toEqualTypeOf<
      [string, CreateJournalEntryInput, AuditUserContext]
    >();
    expectTypeOf<JournalsService["createEntry"]>().returns.resolves.toEqualTypeOf<Journal>();
  });

  it("createAndPost takes (orgId, input, {userId, role}) and returns {journal, correlationId}", () => {
    expectTypeOf<JournalsService["createAndPost"]>().parameters.toEqualTypeOf<
      [string, CreateJournalEntryInput, { userId: string; role: string }]
    >();
    expectTypeOf<
      JournalsService["createAndPost"]
    >().returns.resolves.toEqualTypeOf<{ journal: Journal; correlationId: string }>();
  });

  it("updateEntry takes (orgId, entryId, input, context) and returns {journal, correlationId}", () => {
    expectTypeOf<JournalsService["updateEntry"]>().parameters.toEqualTypeOf<
      [
        string,
        string,
        UpdateJournalEntryInput,
        { userId: string; role?: string; justification?: string },
      ]
    >();
    expectTypeOf<
      JournalsService["updateEntry"]
    >().returns.resolves.toEqualTypeOf<{ journal: Journal; correlationId: string }>();
  });

  it("transitionStatus takes (orgId, entryId, target, context) and returns {journal, correlationId}", () => {
    expectTypeOf<JournalsService["transitionStatus"]>().parameters.toEqualTypeOf<
      [
        string,
        string,
        "POSTED" | "LOCKED" | "VOIDED",
        { userId: string; role: string; justification?: string },
      ]
    >();
    expectTypeOf<
      JournalsService["transitionStatus"]
    >().returns.resolves.toEqualTypeOf<{ journal: Journal; correlationId: string }>();
  });

  it("the Journal aggregate's `number` getter is `number | null` (DRAFT may have no correlativo)", () => {
    expectTypeOf<Journal["number"]>().toEqualTypeOf<number | null>();
  });
});

describe("LedgerService — public method signatures (D1 regression)", () => {
  it("getAccountLedger takes (orgId, accountId, dateRange?, periodId?)", () => {
    expectTypeOf<LedgerService["getAccountLedger"]>().parameters.toMatchTypeOf<
      [string, string, ...unknown[]]
    >();
  });

  it("getTrialBalance takes (orgId, periodId)", () => {
    expectTypeOf<LedgerService["getTrialBalance"]>().parameters.toEqualTypeOf<
      [string, string]
    >();
  });
});
