/**
 * Phase 8.8 — W-3 concurrent race acceptance (annual-close).
 *
 * Per spec REQ-1.2 + REQ-2.5 + design rev 2 §5: `PrismaFiscalYearWriterTxAdapter
 * .markClosed` uses a guarded `UPDATE ... WHERE id=? AND status='OPEN'` that
 * compiles to `updateMany`; if `count !== 1` the predicate missed (row was
 * CLOSED by a concurrent annual-close already) and the writer throws
 * `FiscalYearAlreadyClosedError`, rolling back the whole TX.
 *
 * **Simulation choice — APPROXIMATION**: a true two-TX concurrent race is
 * non-trivial to make deterministic in vitest (requires either a sleep-and-
 * pre-update sidecar coordinator or driver-level transaction interception
 * that vitest cannot offer cheaply). Per orchestrator prompt: "an
 * APPROXIMATION acceptable: directly call `PrismaFiscalYearWriter.markClosed`
 * on an already-CLOSED FY and assert the error".
 *
 * This test uses that approximation. We seed a FiscalYear row directly with
 * `status='CLOSED'`, then call the writer's `markClosed` inside a fresh TX,
 * and verify the writer observes `count=0` from the guarded `updateMany` and
 * throws `FiscalYearAlreadyClosedError`. Discriminant: if the W-3 guard ever
 * regressed (e.g. dropped the `status='OPEN'` predicate, or stopped
 * asserting `count !== 1`), this test would pass through silently and
 * permit a lost-update bug to ship.
 *
 * **Failure mode declared per [[red_acceptance_failure_mode]]**: GREEN on
 * first run — Phase 4.4 GREEN already shipped the W-3 guard. This is a
 * characterization test that cements the contract going forward.
 *
 * Fixture stamp prefix `acw3-` (AnnualCloseW3Race).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import {
  FiscalYearAlreadyClosedError,
  FISCAL_YEAR_ALREADY_CLOSED,
} from "@/modules/annual-close/domain/errors/annual-close-errors";
import { PrismaFiscalYearWriterTxAdapter } from "@/modules/annual-close/infrastructure/prisma-fiscal-year-writer-tx.adapter";

const STAMP_PREFIX = "acw3";

describe("annual-close W-3 race acceptance — Postgres integration", () => {
  let testOrgId: string;
  let testUserId: string;
  let testFyId: string;
  const testYear = 2097;

  beforeAll(async () => {
    const stamp = Date.now();

    const user = await prisma.user.create({
      data: {
        clerkUserId: `${STAMP_PREFIX}-clerk-user-${stamp}`,
        email: `${STAMP_PREFIX}-${stamp}@test.local`,
        name: "AnnualCloseW3Race Integration Test User",
      },
    });
    testUserId = user.id;

    const org = await prisma.organization.create({
      data: {
        clerkOrgId: `${STAMP_PREFIX}-clerk-org-${stamp}`,
        name: `AnnualCloseW3Race Integration Test Org ${stamp}`,
        slug: `${STAMP_PREFIX}-org-${stamp}`,
      },
    });
    testOrgId = org.id;

    // Seed FY row directly as CLOSED (simulating: a concurrent annual-close
    // already committed before our second TX could call markClosed).
    const fy = await prisma.fiscalYear.create({
      data: {
        organizationId: testOrgId,
        year: testYear,
        status: "CLOSED",
        closedAt: new Date(`${testYear + 1}-01-15T12:00:00Z`),
        closedBy: testUserId,
        createdById: testUserId,
        justification: "Sembrado pre-CLOSED para acceptance W-3 race approximation.",
      },
    });
    testFyId = fy.id;
  });

  afterAll(async () => {
    await prisma.fiscalYear.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.auditLog.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.organization.delete({ where: { id: testOrgId } });
    await prisma.user.delete({ where: { id: testUserId } });
  });

  it("markClosed on already-CLOSED FY throws FiscalYearAlreadyClosedError (W-3 guard)", async () => {
    let thrown: unknown;
    await prisma
      .$transaction(async (tx) => {
        const adapter = new PrismaFiscalYearWriterTxAdapter(tx);
        // The writer issues UPDATE WHERE id=? AND status='OPEN' → 0 rows
        // affected because the row was already CLOSED at seed time.
        await adapter.markClosed({
          fiscalYearId: testFyId,
          closedBy: testUserId,
          closingEntryId: "fake-cc-id-for-race-test",
          openingEntryId: "fake-ca-id-for-race-test",
        });
      })
      .catch((e) => {
        thrown = e;
      });

    expect(thrown).toBeInstanceOf(FiscalYearAlreadyClosedError);
    const err = thrown as FiscalYearAlreadyClosedError;
    expect(err.code).toBe(FISCAL_YEAR_ALREADY_CLOSED);
    expect(err.statusCode).toBe(409);

    // Verify the FY row was NOT modified — closingEntryId stays NULL (we did
    // not set it during seed) and the seeded closedAt is unchanged.
    const fyAfter = await prisma.fiscalYear.findUniqueOrThrow({
      where: { id: testFyId },
    });
    expect(fyAfter.status).toBe("CLOSED");
    expect(fyAfter.closingEntryId).toBeNull();
    expect(fyAfter.openingEntryId).toBeNull();
  });
});
