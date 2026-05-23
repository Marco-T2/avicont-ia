import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import type { CreditConsumptionPort } from "../../domain/ports/credit-consumption.port";
import { PrismaCreditConsumptionAdapter } from "../adapters/prisma-credit-consumption.adapter";

/**
 * Postgres-real integration test for PrismaCreditConsumptionAdapter
 * (pagos-cobros-fifo Phase 3 task 3.1). Exercises the CreditConsumption bridge
 * table — the QB-style LinkedTxn that makes credit application reversible
 * without mutating the source payment journal (design v2 §CENTERPIECE).
 *
 * DEC-1: the port exchanges MonetaryAmount; the Prisma Decimal value-form is
 * confined to the adapter. This test asserts round-trip equality via
 * MonetaryAmount, never via Prisma.Decimal.
 */
describe("PrismaCreditConsumptionAdapter — Postgres integration", () => {
  let testOrgId: string;
  let testUserId: string;
  let testPeriodId: string;
  let testContactId: string;
  let sourcePaymentId: string;
  let consumerPaymentId: string;
  let receivableId: string;

  beforeAll(async () => {
    const stamp = Date.now();

    const user = await prisma.user.create({
      data: {
        clerkUserId: `cc-test-clerk-user-${stamp}`,
        email: `cc-test-${stamp}@test.local`,
        name: "CreditConsumption Integration Test User",
      },
    });
    testUserId = user.id;

    const org = await prisma.organization.create({
      data: {
        clerkOrgId: `cc-test-clerk-org-${stamp}`,
        name: `CreditConsumption Integration Test Org ${stamp}`,
        slug: `cc-test-org-${stamp}`,
      },
    });
    testOrgId = org.id;

    const period = await prisma.fiscalPeriod.create({
      data: {
        organizationId: testOrgId,
        name: "cc-integration-period",
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
        name: "CC Test Contact",
      },
    });
    testContactId = contact.id;

    const source = await prisma.payment.create({
      data: {
        organizationId: testOrgId,
        status: "POSTED",
        method: "EFECTIVO",
        date: new Date("2099-01-10T00:00:00Z"),
        amount: "300.00",
        description: "CC source payment",
        periodId: testPeriodId,
        contactId: testContactId,
        createdById: testUserId,
      },
    });
    sourcePaymentId = source.id;

    const consumer = await prisma.payment.create({
      data: {
        organizationId: testOrgId,
        status: "POSTED",
        method: "EFECTIVO",
        date: new Date("2099-01-12T00:00:00Z"),
        amount: "50.00",
        description: "CC consumer payment",
        periodId: testPeriodId,
        contactId: testContactId,
        createdById: testUserId,
      },
    });
    consumerPaymentId = consumer.id;

    const receivable = await prisma.accountsReceivable.create({
      data: {
        organizationId: testOrgId,
        contactId: testContactId,
        description: "CC test receivable",
        amount: "100.00",
        paid: "0.00",
        balance: "100.00",
        dueDate: new Date("2099-02-01T00:00:00Z"),
        status: "PENDING",
      },
    });
    receivableId = receivable.id;
  });

  beforeEach(async () => {
    await prisma.creditConsumption.deleteMany({
      where: { organizationId: testOrgId },
    });
  });

  afterAll(async () => {
    await prisma.creditConsumption.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.accountsReceivable.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.payment.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.contact.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.fiscalPeriod.delete({ where: { id: testPeriodId } });
    await prisma.auditLog.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.organization.delete({ where: { id: testOrgId } });
    await prisma.user.delete({ where: { id: testUserId } });
  });

  it("instantiates and satisfies CreditConsumptionPort", () => {
    const adapter: CreditConsumptionPort = new PrismaCreditConsumptionAdapter();
    expect(adapter).toBeDefined();
  });

  it("writeTx persists a link, findByConsumerPaymentIdTx reads it back with MonetaryAmount equality", async () => {
    const adapter = new PrismaCreditConsumptionAdapter();

    await prisma.$transaction(async (tx) => {
      await adapter.writeTx(tx, {
        organizationId: testOrgId,
        consumerPaymentId,
        sourcePaymentId,
        receivableId,
        amount: MonetaryAmount.of(100),
      });
    });

    const links = await prisma.$transaction((tx) =>
      adapter.findByConsumerPaymentIdTx(tx, testOrgId, consumerPaymentId),
    );

    expect(links).toHaveLength(1);
    expect(links[0].sourcePaymentId).toBe(sourcePaymentId);
    expect(links[0].receivableId).toBe(receivableId);
    expect(links[0].consumerPaymentId).toBe(consumerPaymentId);
    expect(links[0].amount.equals(MonetaryAmount.of(100))).toBe(true);
  });

  it("findByConsumerPaymentIdTx returns empty array when no links exist for the consumer", async () => {
    const adapter = new PrismaCreditConsumptionAdapter();
    const links = await prisma.$transaction((tx) =>
      adapter.findByConsumerPaymentIdTx(tx, testOrgId, consumerPaymentId),
    );
    expect(links).toEqual([]);
  });

  it("findByConsumerPaymentIdTx returns multiple links for the same consumer (R-3 distinct rows)", async () => {
    const adapter = new PrismaCreditConsumptionAdapter();

    await prisma.$transaction(async (tx) => {
      await adapter.writeTx(tx, {
        organizationId: testOrgId,
        consumerPaymentId,
        sourcePaymentId,
        receivableId,
        amount: MonetaryAmount.of(40),
      });
      await adapter.writeTx(tx, {
        organizationId: testOrgId,
        consumerPaymentId,
        sourcePaymentId,
        receivableId,
        amount: MonetaryAmount.of(40),
      });
    });

    const links = await prisma.$transaction((tx) =>
      adapter.findByConsumerPaymentIdTx(tx, testOrgId, consumerPaymentId),
    );
    expect(links).toHaveLength(2);
    expect(links.every((l) => l.amount.equals(MonetaryAmount.of(40)))).toBe(
      true,
    );
  });

  it("deleteByConsumerPaymentIdTx removes all links for the consumer", async () => {
    const adapter = new PrismaCreditConsumptionAdapter();

    await prisma.$transaction(async (tx) => {
      await adapter.writeTx(tx, {
        organizationId: testOrgId,
        consumerPaymentId,
        sourcePaymentId,
        receivableId,
        amount: MonetaryAmount.of(100),
      });
    });

    await prisma.$transaction(async (tx) => {
      await adapter.deleteByConsumerPaymentIdTx(tx, testOrgId, consumerPaymentId);
    });

    const remaining = await prisma.creditConsumption.findMany({
      where: { organizationId: testOrgId, consumerPaymentId },
    });
    expect(remaining).toHaveLength(0);
  });
});
