import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { Payment } from "@/modules/payment/domain/payment.entity";
import { AllocationTarget } from "@/modules/payment/domain/value-objects/allocation-target";
import { PrismaPaymentsRepository } from "@/modules/payment/infrastructure/prisma-payments.repository";

/**
 * RED-α hotfix-correctivo Payment c0-hotfix-allocations-nested-create — bug
 * runtime in-the-wild post-POC pagination-replication closed: `saveTx` +
 * `save` invocan `payment.create({ data: { ..., allocations: { create: [...] } } })`
 * pero `allocationsToPrismaCreate` mapper SIEMPRE incluye `paymentId`. Prisma
 * nested write `allocations: { create: [...] }` espera shape
 * `PaymentAllocationUncheckedCreateWithoutPaymentInput` (SIN `paymentId` —
 * Prisma infiere por relación parent), NO `PaymentAllocationCreateInput`
 * (CON `paymentId`). Stack trace runtime: "Unknown argument `paymentId`".
 *
 * Pre-fix: este test FALLA con `PrismaClientValidationError` por shape
 * mismatch en nested create.
 *
 * Post-fix Opción A: split mapper en `allocationsToPrismaNestedCreate`
 * (SIN `paymentId`, para `save`/`saveTx` nested write) +
 * `allocationsToPrismaCreateMany` (CON `paymentId`, para `update`/`updateTx`
 * standalone `paymentAllocation.createMany`). Mirror precedent EXACT
 * Sale+Purchase canonical `buildDetailCreate(d): Prisma.XDetailUncheckedCreateWithoutXInput`
 * + callsite createMany añade `XId: parent.id, ...buildDetailCreate(d)` explicit
 * spread.
 *
 * Cleanup convention sigue precedent EXACT
 * `prisma-journal-entries.repo.integration.test.ts` (POC #10 C3-B): FK-safe
 * order child→parent, audit_logs paso 3 obligatorio captura triggers.
 */

describe("PrismaPaymentsRepository — c0-hotfix-allocations-nested-create integration (RED-α)", () => {
  let testOrgId: string;
  let testUserId: string;
  let testPeriodId: string;
  let testContactId: string;
  let testReceivableId: string;

  beforeAll(async () => {
    const stamp = Date.now();

    const user = await prisma.user.create({
      data: {
        clerkUserId: `pp-hotfix-clerk-user-${stamp}`,
        email: `pp-hotfix-${stamp}@test.local`,
        name: "PrismaPaymentsRepository Hotfix Integration Test User",
      },
    });
    testUserId = user.id;

    const org = await prisma.organization.create({
      data: {
        clerkOrgId: `pp-hotfix-clerk-org-${stamp}`,
        name: `PrismaPaymentsRepository Hotfix Integration Test Org ${stamp}`,
        slug: `pp-hotfix-org-${stamp}`,
      },
    });
    testOrgId = org.id;

    const period = await prisma.fiscalPeriod.create({
      data: {
        organizationId: testOrgId,
        name: "pp-hotfix-period",
        year: 2099,
        month: 1,
        startDate: new Date("2099-01-01T00:00:00Z"),
        endDate: new Date("2099-01-31T23:59:59Z"),
        createdById: testUserId,
      },
    });
    testPeriodId = period.id;

    const contact = await prisma.contact.create({
      data: {
        organizationId: testOrgId,
        type: "CLIENTE",
        name: "Hotfix Test Client",
      },
    });
    testContactId = contact.id;

    const receivable = await prisma.accountsReceivable.create({
      data: {
        organizationId: testOrgId,
        contactId: testContactId,
        description: "Hotfix test receivable",
        amount: "1000",
        balance: "1000",
        dueDate: new Date("2099-02-01T00:00:00Z"),
      },
    });
    testReceivableId = receivable.id;
  });

  afterEach(async () => {
    await prisma.paymentAllocation.deleteMany({
      where: { payment: { organizationId: testOrgId } },
    });
    await prisma.payment.deleteMany({
      where: { organizationId: testOrgId },
    });
  });

  afterAll(async () => {
    await prisma.paymentAllocation.deleteMany({
      where: { payment: { organizationId: testOrgId } },
    });
    await prisma.payment.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.accountsReceivable.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.fiscalPeriod.delete({ where: { id: testPeriodId } });
    await prisma.contact.delete({ where: { id: testContactId } });
    await prisma.auditLog.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.organization.delete({ where: { id: testOrgId } });
    await prisma.user.delete({ where: { id: testUserId } });
  });

  function buildPaymentWithAllocation(): Payment {
    return Payment.create({
      organizationId: testOrgId,
      method: "EFECTIVO",
      date: new Date("2099-01-15T00:00:00Z"),
      amount: "640",
      description: "Hotfix test payment con allocation",
      periodId: testPeriodId,
      contactId: testContactId,
      createdById: testUserId,
      allocations: [
        {
          target: AllocationTarget.forReceivable(testReceivableId),
          amount: "640",
        },
      ],
    });
  }

  it("saveTx: persists payment + allocations via nested create without `paymentId` argument rejection", async () => {
    const payment = buildPaymentWithAllocation();

    await prisma.$transaction(async (tx) => {
      const repo = new PrismaPaymentsRepository();
      await repo.saveTx(tx, payment);
    });

    const persisted = await prisma.payment.findUnique({
      where: { id: payment.id },
      include: { allocations: true },
    });

    expect(persisted).not.toBeNull();
    expect(persisted!.allocations).toHaveLength(1);
    expect(persisted!.allocations[0]!.receivableId).toBe(testReceivableId);
    expect(persisted!.allocations[0]!.paymentId).toBe(payment.id);
    expect(persisted!.allocations[0]!.amount.toString()).toBe("640");
  });

  it("save: persists payment + allocations via nested create without `paymentId` argument rejection (paired sister saveTx)", async () => {
    const payment = buildPaymentWithAllocation();

    const repo = new PrismaPaymentsRepository();
    await repo.save(payment);

    const persisted = await prisma.payment.findUnique({
      where: { id: payment.id },
      include: { allocations: true },
    });

    expect(persisted).not.toBeNull();
    expect(persisted!.allocations).toHaveLength(1);
    expect(persisted!.allocations[0]!.receivableId).toBe(testReceivableId);
    expect(persisted!.allocations[0]!.paymentId).toBe(payment.id);
    expect(persisted!.allocations[0]!.amount.toString()).toBe("640");
  });
});
