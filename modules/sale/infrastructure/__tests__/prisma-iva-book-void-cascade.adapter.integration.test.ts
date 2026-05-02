import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { PrismaIvaBookVoidCascadeAdapter } from "../prisma-iva-book-void-cascade.adapter";

/**
 * Postgres-real integration test for PrismaIvaBookVoidCascadeAdapter
 * (POC #11.0a A3 Ciclo 5b). Tx-bound write port: adapter recibe
 * `Prisma.TransactionClient` por c2 DI vía SaleScope (Ciclo 4 D-2). Tests
 * ejecutan `prisma.$transaction(async (tx) => { ... })` y verifican
 * post-commit reading via top-level prisma.
 *
 * Opción β Prisma directo lockeada (paralelo Ciclo 3 SaleRepo): mirror exacto
 * `voidCascadeTx:1205-1211` legacy — `IvaBooksService.markVoidedFromSale`
 * NO existe. JSDoc del port actualizada en mismo commit (piggyback). (Legacy
 * `IvaBooksService` deleted POC siguiente A2-C3, engram
 * `poc-siguiente/a2/c3/closed` — adapter Prisma directo permanece como
 * implementación final hex.)
 *
 * Paridad regla #1: `findUnique({where:{saleId}})` SIN filter
 * `organizationId` (mirror legacy bit-exact). `_organizationId` queda anotado
 * como D1 drift candidate paralelo D2 para auditoría POC #11.0a end.
 */

describe("PrismaIvaBookVoidCascadeAdapter — Postgres integration", () => {
  let testUserId: string;
  let testOrgId: string;
  let testPeriodId: string;
  let testContactId: string;

  beforeAll(async () => {
    const stamp = Date.now();

    const user = await prisma.user.create({
      data: {
        clerkUserId: `pivc-test-clerk-user-${stamp}`,
        email: `pivc-test-${stamp}@test.local`,
        name: "PrismaIvaBookVoidCascadeAdapter Integration Test User",
      },
    });
    testUserId = user.id;

    const org = await prisma.organization.create({
      data: {
        clerkOrgId: `pivc-test-clerk-org-${stamp}`,
        name: `PrismaIvaBookVoidCascadeAdapter Integration Test Org ${stamp}`,
        slug: `pivc-test-org-${stamp}`,
      },
    });
    testOrgId = org.id;

    const period = await prisma.fiscalPeriod.create({
      data: {
        organizationId: testOrgId,
        name: "pivc-integration-period",
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
        name: "Test Customer",
        type: "CLIENTE",
        nit: "1234567",
      },
    });
    testContactId = contact.id;
  });

  afterEach(async () => {
    await prisma.ivaSalesBook.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.sale.deleteMany({ where: { organizationId: testOrgId } });
  });

  afterAll(async () => {
    await prisma.ivaSalesBook.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.sale.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.contact.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.fiscalPeriod.delete({ where: { id: testPeriodId } });
    await prisma.auditLog.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.organization.delete({ where: { id: testOrgId } });
    await prisma.user.delete({ where: { id: testUserId } });
  });

  async function seedSaleDirect(sequenceNumber: number): Promise<string> {
    const id = crypto.randomUUID();
    await prisma.sale.create({
      data: {
        id,
        organizationId: testOrgId,
        status: "DRAFT",
        sequenceNumber,
        date: new Date("2099-01-15T12:00:00Z"),
        contactId: testContactId,
        periodId: testPeriodId,
        description: "pivc seeded sale",
        totalAmount: new Prisma.Decimal("120.50"),
        createdById: testUserId,
      },
    });
    return id;
  }

  async function seedIvaSalesBook(opts: {
    saleId: string;
    status: "ACTIVE" | "VOIDED";
    sequenceTag: string;
  }): Promise<string> {
    const id = crypto.randomUUID();
    await prisma.ivaSalesBook.create({
      data: {
        id,
        organizationId: testOrgId,
        fiscalPeriodId: testPeriodId,
        saleId: opts.saleId,
        fechaFactura: new Date("2099-01-15T12:00:00Z"),
        nitCliente: "1234567",
        razonSocial: "Test Customer",
        numeroFactura: `pivc-${opts.sequenceTag}`,
        codigoAutorizacion: `pivc-auth-${opts.sequenceTag}`,
        estadoSIN: "V",
        status: opts.status,
      },
    });
    return id;
  }

  it("markVoidedFromSale: ACTIVE book exists — updates status to VOIDED", async () => {
    // RED honesty preventivo: FAILS pre-implementación por module resolution
    // failure (`PrismaIvaBookVoidCascadeAdapter` no existe). Post-GREEN:
    // PASSES porque adapter ejecuta `tx.ivaSalesBook.update({where:{id},
    // data:{status:"VOIDED"}})` (mirror legacy `voidCascadeTx:1207-1210`).
    const saleId = await seedSaleDirect(1);
    const ivaBookId = await seedIvaSalesBook({
      saleId,
      status: "ACTIVE",
      sequenceTag: "active",
    });

    await prisma.$transaction(async (tx) => {
      const adapter = new PrismaIvaBookVoidCascadeAdapter(tx);
      await adapter.markVoidedFromSale(testOrgId, saleId);
    });

    const post = await prisma.ivaSalesBook.findUnique({
      where: { id: ivaBookId },
    });
    expect(post).not.toBeNull();
    expect(post!.status).toBe("VOIDED");
  });

  it("markVoidedFromSale: already VOIDED book — no-op (no update side-effect)", async () => {
    // RED honesty: FAILS pre-implementación por module resolution failure.
    // Post-GREEN: adapter chequea `if (ivaBook && ivaBook.status !== "VOIDED")`
    // y skip-update (mirror legacy `voidCascadeTx:1206`). Verificación:
    // `updatedAt` pre-call === post-call (Prisma `@updatedAt` muta solo
    // cuando hay write).
    const saleId = await seedSaleDirect(2);
    const ivaBookId = await seedIvaSalesBook({
      saleId,
      status: "VOIDED",
      sequenceTag: "voided",
    });
    const pre = await prisma.ivaSalesBook.findUnique({
      where: { id: ivaBookId },
    });
    const preUpdatedAt = pre!.updatedAt.getTime();

    await prisma.$transaction(async (tx) => {
      const adapter = new PrismaIvaBookVoidCascadeAdapter(tx);
      await adapter.markVoidedFromSale(testOrgId, saleId);
    });

    const post = await prisma.ivaSalesBook.findUnique({
      where: { id: ivaBookId },
    });
    expect(post!.status).toBe("VOIDED");
    expect(post!.updatedAt.getTime()).toBe(preUpdatedAt);
  });

  it("markVoidedFromSale: no book exists for saleId — no-op (no error, no insert)", async () => {
    // RED honesty: FAILS pre-implementación por module resolution failure.
    // Post-GREEN: findUnique → null → adapter skip-update (mirror legacy
    // `voidCascadeTx:1205-1206` `if (ivaBook && ...)`). Sin throw, sin
    // insert side-effect.
    const arbitrarySaleId = "00000000-0000-0000-0000-000000000000";

    await prisma.$transaction(async (tx) => {
      const adapter = new PrismaIvaBookVoidCascadeAdapter(tx);
      await adapter.markVoidedFromSale(testOrgId, arbitrarySaleId);
    });

    const count = await prisma.ivaSalesBook.count({
      where: { organizationId: testOrgId },
    });
    expect(count).toBe(0);
  });
});
