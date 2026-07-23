import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { Receivable } from "@/modules/receivables/domain/receivable.entity";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

import { PrismaReceivablesRepository } from "../prisma-receivables.repository";

/**
 * Postgres-real integration test for the `atomically()` money-atomicity guard
 * (unified-comprobante-source-of-truth, defect H2).
 *
 * REGRESSION / CHARACTERIZATION — expected GREEN on current code. The unit
 * suite's mocks lack `$transaction`, so both `atomically` branches (root-client
 * real-tx wrap + Prisma 7 nested-savepoint) were UNTESTED against a real DB
 * (adversarial-verify gap). RED-ability is proven by mutation-check: bypassing
 * the `$transaction` wrap in `atomically` makes the rollback tests observe a
 * persisted PARTIAL state (AR status changed, JE.paymentStatus stale) and go
 * RED. Expected failure mode under mutation: assertion mismatch on the AR
 * `status` column ("PAID" persisted where "PENDING" is asserted) — NOT a
 * thrown-error change.
 *
 * Failure injection is honest: a Proxy over the REAL client makes only
 * `journalEntry.updateMany` (the SECOND write of the dual write) throw; the
 * first write (`accountsReceivable.update`) executes against real postgres
 * inside whatever tx `atomically` opened. Injection applies at BOTH levels
 * (base client and `$transaction`-provided inner client) so a mutated
 * `atomically` that skips the wrap still hits the forced failure and exposes
 * the partial autocommit.
 *
 * Cleanup follows precedent EXACT `prisma-sale-unit-of-work.integration.test.ts`
 * (C3-B): FK-safe child→parent + audit_logs paso 3 (journal_entries and
 * fiscal_periods carry AFTER triggers; accounts_receivable does not).
 *
 * save()-path sister quartet (settlement-invariant-hardening, (c)): the same
 * four shapes over `save()`'s dual write — AR create + D2 creation stamp with
 * P5 dueDate — starting from an UNSTAMPED JE (paymentStatus/dueDate NULL, no
 * linked aux). Under the same mutation the save() rollback tests observe a
 * persisted AR row where absence is asserted.
 */

const FORCED = "forced-second-write-failure: journalEntry.updateMany";

/**
 * Wraps a real Prisma client (root or tx-bound) so `journalEntry.updateMany`
 * throws, both directly and inside any `$transaction` it opens. Everything
 * else passes through to the real client — real writes, real rollbacks.
 */
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

type RepoDb = ConstructorParameters<typeof PrismaReceivablesRepository>[0];

describe("PrismaReceivablesRepository — atomically() Postgres integration", () => {
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
        clerkUserId: `prr-atom-clerk-user-${stamp}`,
        email: `prr-atom-${stamp}@test.local`,
        name: "PrismaReceivablesRepository Atomicity Integration Test User",
      },
    });
    testUserId = user.id;

    const org = await prisma.organization.create({
      data: {
        clerkOrgId: `prr-atom-clerk-org-${stamp}`,
        name: `PrismaReceivablesRepository Atomicity Test Org ${stamp}`,
        slug: `prr-atom-org-${stamp}`,
      },
    });
    testOrgId = org.id;

    const period = await prisma.fiscalPeriod.create({
      data: {
        organizationId: testOrgId,
        name: "prr-atom-integration-period",
        year: 2099,
        month: 2,
        startDate: new Date("2099-02-01T00:00:00Z"),
        endDate: new Date("2099-02-28T23:59:59Z"),
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
        name: "Test Customer",
        type: "CLIENTE",
        nit: "1234567",
      },
    });
    testContactId = contact.id;
  });

  afterEach(async () => {
    // Child→parent: AR references JE via journalEntryId FK.
    await prisma.accountsReceivable.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.journalEntry.deleteMany({
      where: { organizationId: testOrgId },
    });
    // Paso 3: audit_journal_entries trigger fires on create/update/delete.
    await prisma.auditLog.deleteMany({ where: { organizationId: testOrgId } });
  });

  afterAll(async () => {
    await prisma.accountsReceivable.deleteMany({
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

  /** JE(paymentStatus=PENDING) + linked AR(status=PENDING) disposable pair. */
  async function createLinkedFixture(): Promise<{ jeId: string; arId: string }> {
    jeNumber += 1;
    const je = await prisma.journalEntry.create({
      data: {
        organizationId: testOrgId,
        number: jeNumber,
        date: new Date("2099-02-15T12:00:00Z"),
        description: "prr-atom fixture journal",
        periodId: testPeriodId,
        voucherTypeId: testVoucherTypeId,
        createdById: testUserId,
        paymentStatus: "PENDING",
        // Mirrors the linked AR row's dueDate below: the co-population CHECK
        // (journal_entries_settlement_copopulation_check) forbids a stamped
        // JE without dueDate — production stamps both via the settlement sync.
        dueDate: new Date("2099-03-15T12:00:00Z"),
      },
    });
    const ar = await prisma.accountsReceivable.create({
      data: {
        organizationId: testOrgId,
        contactId: testContactId,
        description: "prr-atom fixture receivable",
        amount: 100,
        paid: 0,
        balance: 100,
        dueDate: new Date("2099-03-15T12:00:00Z"),
        status: "PENDING",
        journalEntryId: je.id,
      },
    });
    return { jeId: je.id, arId: ar.id };
  }

  /** PAID version of the fixture entity — drives the dual write via update(). */
  function paidEntity(arId: string, jeId: string): Receivable {
    return Receivable.fromPersistence({
      id: arId,
      organizationId: testOrgId,
      contactId: testContactId,
      description: "prr-atom fixture receivable",
      amount: MonetaryAmount.of(100),
      paid: MonetaryAmount.of(100),
      balance: MonetaryAmount.of(0),
      dueDate: new Date("2099-03-15T12:00:00Z"),
      status: "PAID",
      sourceType: null,
      sourceId: null,
      journalEntryId: jeId,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /** Unstamped JE: paymentStatus/dueDate NULL, NO linked aux (save()-path fixture). */
  async function createUnstampedFixture(): Promise<{ jeId: string }> {
    jeNumber += 1;
    const je = await prisma.journalEntry.create({
      data: {
        organizationId: testOrgId,
        number: jeNumber,
        date: new Date("2099-02-15T12:00:00Z"),
        description: "prr-atom unstamped fixture journal",
        periodId: testPeriodId,
        voucherTypeId: testVoucherTypeId,
        createdById: testUserId,
        // paymentStatus/dueDate intentionally ABSENT → NULL/NULL (pre-stamp).
      },
    });
    return { jeId: je.id };
  }

  const SAVE_DUE = new Date("2099-03-20T12:00:00Z");

  /** Fresh PENDING entity linked to the unstamped JE — drives save()'s dual write. */
  function pendingEntity(jeId: string): Receivable {
    return Receivable.create({
      organizationId: testOrgId,
      contactId: testContactId,
      description: "prr-atom save() fixture receivable",
      amount: 100,
      dueDate: SAVE_DUE,
      journalEntryId: jeId,
    });
  }

  it("root client commit: update() dual write lands atomically — AR.status y JE.paymentStatus consistentes", async () => {
    const { jeId, arId } = await createLinkedFixture();
    const repo = new PrismaReceivablesRepository();

    await repo.update(paidEntity(arId, jeId));

    const arRow = await prisma.accountsReceivable.findUnique({
      where: { id: arId },
    });
    const jeRow = await prisma.journalEntry.findUnique({ where: { id: jeId } });
    expect(arRow!.status).toBe("PAID");
    expect(jeRow!.paymentStatus).toBe("PAID");
  });

  it("root client rollback: second write fails → BOTH writes roll back (real $transaction wrap)", async () => {
    const { jeId, arId } = await createLinkedFixture();
    const failingRepo = new PrismaReceivablesRepository(
      withFailingSecondWrite(prisma) as unknown as RepoDb,
    );

    await expect(failingRepo.update(paidEntity(arId, jeId))).rejects.toThrow(
      FORCED,
    );

    // Si atomically NO envolviera en $transaction, el primer write habría
    // autocommiteado y status sería "PAID" (drift silencioso H2).
    const arRow = await prisma.accountsReceivable.findUnique({
      where: { id: arId },
    });
    const jeRow = await prisma.journalEntry.findUnique({ where: { id: jeId } });
    expect(arRow!.status).toBe("PENDING");
    expect(jeRow!.paymentStatus).toBe("PENDING");
  });

  it("nested savepoint commit: tx-bound repo update() inside outer $transaction lands atomically", async () => {
    const { jeId, arId } = await createLinkedFixture();

    await prisma.$transaction(async (tx) => {
      const txRepo = new PrismaReceivablesRepository().withTransaction(
        tx as Prisma.TransactionClient,
      );
      await txRepo.update(paidEntity(arId, jeId));
    });

    const arRow = await prisma.accountsReceivable.findUnique({
      where: { id: arId },
    });
    const jeRow = await prisma.journalEntry.findUnique({ where: { id: jeId } });
    expect(arRow!.status).toBe("PAID");
    expect(jeRow!.paymentStatus).toBe("PAID");
  });

  it("nested savepoint rollback: forced failure rolls back to savepoint WITHOUT killing the outer tx", async () => {
    const { jeId, arId } = await createLinkedFixture();
    let caught: unknown;

    await prisma.$transaction(async (tx) => {
      const failingTx = withFailingSecondWrite(
        tx as object,
      ) as Prisma.TransactionClient;
      const txRepo = new PrismaReceivablesRepository().withTransaction(failingTx);
      try {
        await txRepo.update(paidEntity(arId, jeId));
      } catch (e) {
        caught = e;
      }
      // El outer tx debe seguir vivo tras el rollback del savepoint interno —
      // este write commitea con el outer y lo prueba.
      await (tx as Prisma.TransactionClient).accountsReceivable.update({
        where: { id: arId },
        data: { notes: "outer-survived" },
      });
    });

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain(FORCED);

    const arRow = await prisma.accountsReceivable.findUnique({
      where: { id: arId },
    });
    const jeRow = await prisma.journalEntry.findUnique({ where: { id: jeId } });
    // Savepoint rollback: dual write revertido, AR.status == JE.paymentStatus.
    expect(arRow!.status).toBe("PENDING");
    expect(jeRow!.paymentStatus).toBe("PENDING");
    // Outer tx NO fue matado por el fallo interno.
    expect(arRow!.notes).toBe("outer-survived");
  });

  // ── save()-path sister quartet (settlement-invariant-hardening, (c)) ──────

  it("root client commit: save() dual write lands atomically — AR creada + JE stamped {PENDING, entity.dueDate}", async () => {
    const { jeId } = await createUnstampedFixture();
    const entity = pendingEntity(jeId);

    await new PrismaReceivablesRepository().save(entity);

    const arRow = await prisma.accountsReceivable.findUnique({
      where: { id: entity.id },
    });
    const jeRow = await prisma.journalEntry.findUnique({ where: { id: jeId } });
    expect(arRow!.status).toBe("PENDING");
    expect(arRow!.journalEntryId).toBe(jeId);
    // D2 creation stamp + P5 dueDate — ambos desde la entity, no hardcodeados.
    expect(jeRow!.paymentStatus).toBe("PENDING");
    expect(jeRow!.dueDate).toEqual(SAVE_DUE);
  });

  it("root client rollback: second write fails → AR create revertido y JE queda NULL/NULL", async () => {
    const { jeId } = await createUnstampedFixture();
    const entity = pendingEntity(jeId);
    const failingRepo = new PrismaReceivablesRepository(
      withFailingSecondWrite(prisma) as unknown as RepoDb,
    );

    await expect(failingRepo.save(entity)).rejects.toThrow(FORCED);

    // Sin el $transaction wrap, el create habría autocommiteado y la AR
    // existiría huérfana de stamp (drift silencioso H2, dirección save()).
    const arRow = await prisma.accountsReceivable.findUnique({
      where: { id: entity.id },
    });
    const jeRow = await prisma.journalEntry.findUnique({ where: { id: jeId } });
    expect(arRow).toBeNull();
    expect(jeRow!.paymentStatus).toBeNull();
    expect(jeRow!.dueDate).toBeNull();
  });

  it("nested savepoint commit: tx-bound repo save() inside outer $transaction lands atomically", async () => {
    const { jeId } = await createUnstampedFixture();
    const entity = pendingEntity(jeId);

    await prisma.$transaction(async (tx) => {
      const txRepo = new PrismaReceivablesRepository().withTransaction(
        tx as Prisma.TransactionClient,
      );
      await txRepo.save(entity);
    });

    const arRow = await prisma.accountsReceivable.findUnique({
      where: { id: entity.id },
    });
    const jeRow = await prisma.journalEntry.findUnique({ where: { id: jeId } });
    expect(arRow!.status).toBe("PENDING");
    expect(jeRow!.paymentStatus).toBe("PENDING");
    expect(jeRow!.dueDate).toEqual(SAVE_DUE);
  });

  it("nested savepoint rollback: forced failure rolls back save() WITHOUT killing the outer tx", async () => {
    const { jeId } = await createUnstampedFixture();
    const entity = pendingEntity(jeId);
    let caught: unknown;

    await prisma.$transaction(async (tx) => {
      const failingTx = withFailingSecondWrite(
        tx as object,
      ) as Prisma.TransactionClient;
      const txRepo = new PrismaReceivablesRepository().withTransaction(failingTx);
      try {
        await txRepo.save(entity);
      } catch (e) {
        caught = e;
      }
      // El outer tx debe seguir vivo tras el rollback del savepoint interno —
      // la AR no existe, así que el write de prueba va sobre la JE fixture.
      await (tx as Prisma.TransactionClient).journalEntry.update({
        where: { id: jeId },
        data: { description: "outer-survived" },
      });
    });

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain(FORCED);

    const arRow = await prisma.accountsReceivable.findUnique({
      where: { id: entity.id },
    });
    const jeRow = await prisma.journalEntry.findUnique({ where: { id: jeId } });
    // Savepoint rollback: AR create revertido, JE sin stamp.
    expect(arRow).toBeNull();
    expect(jeRow!.paymentStatus).toBeNull();
    expect(jeRow!.dueDate).toBeNull();
    // Outer tx NO fue matado por el fallo interno.
    expect(jeRow!.description).toBe("outer-survived");
  });
});
