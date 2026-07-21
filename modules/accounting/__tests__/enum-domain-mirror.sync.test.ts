/**
 * Enum domain-mirror SYNC sentinel ([PRISMA] cluster, D1 paydown).
 *
 * Domain/application code no longer imports Prisma enums (R5); it imports
 * domain-owned mirrors instead. That decoupling is only safe while mirror and
 * schema agree, so this test deep-compares EVERY mirror against its
 * Prisma-generated counterpart. Add/rename/remove a member in
 * `prisma/schema.prisma`, regenerate, and the matching assertion here fails
 * loudly — the mirror (and its consumers) must be updated in the same change.
 *
 * This file lives in `modules/accounting/__tests__/` (module root, like
 * exporters-tz-safe.poc-date-calendar.test.ts) precisely because it MUST
 * import both sides: the R5 globs cover only `{domain,application,
 * presentation}/**`, so the Prisma import here is legal, not an exemption.
 *
 * Two mirror shapes exist, compared accordingly:
 *  - const-object mirrors (account-classification.ts, Prisma's own shape):
 *    `toEqual` on the objects — catches key drift AND key↔value mismatches.
 *  - `as const` array VOs (journal-entry-status, receivable/payable status —
 *    they predate D1 and also carry transition rules): sorted-members equality
 *    against `Object.values()` of the Prisma enum.
 */

import { describe, it, expect } from "vitest";
import {
  AccountType as PrismaAccountType,
  AccountSubtype as PrismaAccountSubtype,
  AccountNature as PrismaAccountNature,
  JournalEntryStatus as PrismaJournalEntryStatus,
  ReceivableStatus as PrismaReceivableStatus,
  PayableStatus as PrismaPayableStatus,
} from "@/generated/prisma/enums";
import {
  AccountType,
  AccountSubtype,
  AccountNature,
} from "@/modules/accounting/domain/value-objects/account-classification";
import { JOURNAL_ENTRY_STATUSES } from "@/modules/accounting/domain/value-objects/journal-entry-status";
import { RECEIVABLE_STATUSES } from "@/modules/receivables/domain/value-objects/receivable-status";
import { PAYABLE_STATUSES } from "@/modules/payables/domain/value-objects/payable-status";

const sorted = (values: readonly string[]) => [...values].sort();

describe("domain enum mirrors stay in sync with the Prisma schema", () => {
  // ── const-object mirrors — exact shape equality ──

  it("AccountType mirror === Prisma AccountType", () => {
    expect(AccountType).toEqual(PrismaAccountType);
  });

  it("AccountSubtype mirror === Prisma AccountSubtype", () => {
    expect(AccountSubtype).toEqual(PrismaAccountSubtype);
  });

  it("AccountNature mirror === Prisma AccountNature", () => {
    expect(AccountNature).toEqual(PrismaAccountNature);
  });

  // ── array-based VO mirrors — same member set ──

  it("JOURNAL_ENTRY_STATUSES covers Prisma JournalEntryStatus exactly", () => {
    expect(sorted(JOURNAL_ENTRY_STATUSES)).toEqual(
      sorted(Object.values(PrismaJournalEntryStatus)),
    );
  });

  it("RECEIVABLE_STATUSES covers Prisma ReceivableStatus exactly", () => {
    // accounting-helpers.ts types computeReceivableStatus against this VO.
    expect(sorted(RECEIVABLE_STATUSES)).toEqual(
      sorted(Object.values(PrismaReceivableStatus)),
    );
  });

  it("PAYABLE_STATUSES covers Prisma PayableStatus exactly", () => {
    // accounting-helpers.ts types computePayableStatus against this VO.
    expect(sorted(PAYABLE_STATUSES)).toEqual(
      sorted(Object.values(PrismaPayableStatus)),
    );
  });
});
