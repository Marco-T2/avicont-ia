import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { Payable } from "@/modules/payables/domain/payable.entity";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

import { PrismaPayablesRepository } from "../prisma-payables.repository";

/**
 * Postgres-real integration test for the `atomically()` money-atomicity guard
 * (unified-comprobante-source-of-truth) — payables sister of
 * `prisma-receivables.repository.integration.test.ts` (paired-sister EXACT
 * mirror; payables adopted the H2 fix from the start).
 *
 * REGRESSION / CHARACTERIZATION — expected GREEN on current code. Unit-test
 * mocks lack `$transaction`, so both `atomically` branches (root-client
 * real-tx wrap + Prisma 7 nested-savepoint) were UNTESTED against a real DB
 * (adversarial-verify gap). RED-ability proven by mutation-check: bypassing
 * the `$transaction` wrap makes the rollback tests observe persisted PARTIAL
 * state and go RED. Expected failure mode under mutation: assertion mismatch
 * on the AP `status` column ("PAID" persisted where "PENDING" is asserted).
 *
 * Failure injection: Proxy over the REAL client — only the SECOND write
 * (`journalEntry.updateMany`) throws; the first (`accountsPayable.update`)
 * hits real postgres. See the receivables sister header for the full design.
 */

const FORCED = "forced-second-write-failure: journalEntry.updateMany";

/** See receivables sister — injects at base-client AND inner-tx level. */
function withFailingSecondWrite<T extends object>(client: T): T {
  return new Proxy(client, {
    get(target, prop) {
      if (prop === "journalEntry") {
        const je = Reflect.get(target, prop) as object;
        return new Proxy(je, {
          get(jeTarget, jeProp) {
            if (jeProp === "updateMany") {
              return async () => {
                throw new Error(FORCED);
              };
            }
            return Reflect.get(jeTarget, jeProp);
          },
        });
      }
      if (prop === "$transaction") {
        const txFn = Reflect.get(target, prop);
        if (typeof txFn !== "function") return txFn;
        return (fn: (tx: unknown) => Promise<unknown>, opts?: unknown) =>
          (txFn as (...args: unknown[]) => Promise<unknown>).call(
            target,
            (inner: unknown) => fn(withFailingSecondWrite(inner as object)),
            opts,
          );
      }
      return Reflect.get(target, prop);
    },
  });
}

type RepoDb = ConstructorParameters<typeof PrismaPayablesRepository>[0];

describe("PrismaPayablesRepository — atomically() Postgres integration", () => {
  let testOrgId: string;
  let testUserId: string;
  let testPeriodId: string;
  let testVoucherTypeId: string;
  let testContactId: string;
  let jeNumber = 0;

  beforeAll(async () => {
    const stamp = Date.now();

    const user = await prisma.user.create({
      data: {
        clerkUserId: `ppr-atom-clerk-user-${stamp}`,
        email: `ppr-atom-${stamp}@test.local`,
        name: "PrismaPayablesRepository Atomicity Integration Test User",
      },
    });
    testUserId = user.id;

    const org = await prisma.organization.create({
      data: {
        clerkOrgId: `ppr-atom-clerk-org-${stamp}`,
        name: `PrismaPayablesRepository Atomicity Test Org ${stamp}`,
        slug: `ppr-atom-org-${stamp}`,
      },
    });
    testOrgId = org.id;

    const period = await prisma.fiscalPeriod.create({
      data: {
        organizationId: testOrgId,
        name: "ppr-atom-integration-period",
        year: 2099,
        month: 3,
        startDate: new Date("2099-03-01T00:00:00Z"),
        endDate: new Date("2099-03-31T23:59:59Z"),
        createdById: testUserId,
      },
    });
    testPeriodId = period.id;

    const voucherType = await prisma.voucherTypeCfg.create({
      data: {
        organizationId: testOrgId,
        code: "TEST",
        prefix: "T",
        name: "Test Voucher",
        isActive: true,
        isAdjustment: false,
      },
    });
    testVoucherTypeId = voucherType.id;

    const contact = await prisma.contact.create({
      data: {
        organizationId: testOrgId,
        name: "Test Vendor",
        type: "PROVEEDOR",
        nit: "7654321",
      },
    });
    testContactId = contact.id;
  });

  afterEach(async () => {
    // Child→parent: AP references JE via journalEntryId FK.
    await prisma.accountsPayable.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.journalEntry.deleteMany({
      where: { organizationId: testOrgId },
    });
    // Paso 3: audit_journal_entries trigger fires on create/update/delete.
    await prisma.auditLog.deleteMany({ where: { organizationId: testOrgId } });
  });

  afterAll(async () => {
    await prisma.accountsPayable.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.journalEntry.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.contact.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.voucherTypeCfg.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.fiscalPeriod.delete({ where: { id: testPeriodId } });
    // Después de fiscalPeriod.delete — su AFTER DELETE trigger escribe audit.
    await prisma.auditLog.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.organization.delete({ where: { id: testOrgId } });
    await prisma.user.delete({ where: { id: testUserId } });
  });

  /** JE(paymentStatus=PENDING) + linked AP(status=PENDING) disposable pair. */
  async function createLinkedFixture(): Promise<{ jeId: string; apId: string }> {
    jeNumber += 1;
    const je = await prisma.journalEntry.create({
      data: {
        organizationId: testOrgId,
        number: jeNumber,
        date: new Date("2099-03-15T12:00:00Z"),
        description: "ppr-atom fixture journal",
        periodId: testPeriodId,
        voucherTypeId: testVoucherTypeId,
        createdById: testUserId,
        paymentStatus: "PENDING",
      },
    });
    const ap = await prisma.accountsPayable.create({
      data: {
        organizationId: testOrgId,
        contactId: testContactId,
        description: "ppr-atom fixture payable",
        amount: 100,
        paid: 0,
        balance: 100,
        dueDate: new Date("2099-04-15T12:00:00Z"),
        status: "PENDING",
        journalEntryId: je.id,
      },
    });
    return { jeId: je.id, apId: ap.id };
  }

  /** PAID version of the fixture entity — drives the dual write via update(). */
  function paidEntity(apId: string, jeId: string): Payable {
    return Payable.fromPersistence({
      id: apId,
      organizationId: testOrgId,
      contactId: testContactId,
      description: "ppr-atom fixture payable",
      amount: MonetaryAmount.of(100),
      paid: MonetaryAmount.of(100),
      balance: MonetaryAmount.of(0),
      dueDate: new Date("2099-04-15T12:00:00Z"),
      status: "PAID",
      sourceType: null,
      sourceId: null,
      journalEntryId: jeId,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  it("root client commit: update() dual write lands atomically — AP.status y JE.paymentStatus consistentes", async () => {
    const { jeId, apId } = await createLinkedFixture();
    const repo = new PrismaPayablesRepository();

    await repo.update(paidEntity(apId, jeId));

    const apRow = await prisma.accountsPayable.findUnique({
      where: { id: apId },
    });
    const jeRow = await prisma.journalEntry.findUnique({ where: { id: jeId } });
    expect(apRow!.status).toBe("PAID");
    expect(jeRow!.paymentStatus).toBe("PAID");
  });

  it("root client rollback: second write fails → BOTH writes roll back (real $transaction wrap)", async () => {
    const { jeId, apId } = await createLinkedFixture();
    const failingRepo = new PrismaPayablesRepository(
      withFailingSecondWrite(prisma) as unknown as RepoDb,
    );

    await expect(failingRepo.update(paidEntity(apId, jeId))).rejects.toThrow(
      FORCED,
    );

    // Si atomically NO envolviera en $transaction, el primer write habría
    // autocommiteado y status sería "PAID" (drift silencioso, sibling H2).
    const apRow = await prisma.accountsPayable.findUnique({
      where: { id: apId },
    });
    const jeRow = await prisma.journalEntry.findUnique({ where: { id: jeId } });
    expect(apRow!.status).toBe("PENDING");
    expect(jeRow!.paymentStatus).toBe("PENDING");
  });

  it("nested savepoint commit: tx-bound repo update() inside outer $transaction lands atomically", async () => {
    const { jeId, apId } = await createLinkedFixture();

    await prisma.$transaction(async (tx) => {
      const txRepo = new PrismaPayablesRepository().withTransaction(
        tx as Prisma.TransactionClient,
      );
      await txRepo.update(paidEntity(apId, jeId));
    });

    const apRow = await prisma.accountsPayable.findUnique({
      where: { id: apId },
    });
    const jeRow = await prisma.journalEntry.findUnique({ where: { id: jeId } });
    expect(apRow!.status).toBe("PAID");
    expect(jeRow!.paymentStatus).toBe("PAID");
  });

  it("nested savepoint rollback: forced failure rolls back to savepoint WITHOUT killing the outer tx", async () => {
    const { jeId, apId } = await createLinkedFixture();
    let caught: unknown;

    await prisma.$transaction(async (tx) => {
      const failingTx = withFailingSecondWrite(
        tx as object,
      ) as Prisma.TransactionClient;
      const txRepo = new PrismaPayablesRepository().withTransaction(failingTx);
      try {
        await txRepo.update(paidEntity(apId, jeId));
      } catch (e) {
        caught = e;
      }
      // El outer tx debe seguir vivo tras el rollback del savepoint interno —
      // este write commitea con el outer y lo prueba.
      await (tx as Prisma.TransactionClient).accountsPayable.update({
        where: { id: apId },
        data: { notes: "outer-survived" },
      });
    });

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain(FORCED);

    const apRow = await prisma.accountsPayable.findUnique({
      where: { id: apId },
    });
    const jeRow = await prisma.journalEntry.findUnique({ where: { id: jeId } });
    // Savepoint rollback: dual write revertido, AP.status == JE.paymentStatus.
    expect(apRow!.status).toBe("PENDING");
    expect(jeRow!.paymentStatus).toBe("PENDING");
    // Outer tx NO fue matado por el fallo interno.
    expect(apRow!.notes).toBe("outer-survived");
  });
});
