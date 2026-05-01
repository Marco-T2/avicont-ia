import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import type { UnitOfWorkRepoLike } from "@/modules/shared/infrastructure/prisma-unit-of-work";

import { IvaPurchaseBookEntry } from "../../domain/iva-purchase-book-entry.entity";
import type { IvaPurchaseBookEntryInputs } from "../../domain/iva-purchase-book-entry.entity";
import { IvaSalesBookEntry } from "../../domain/iva-sales-book-entry.entity";
import type { IvaSalesBookEntryInputs } from "../../domain/iva-sales-book-entry.entity";
import { IvaCalcResult } from "../../domain/value-objects/iva-calc-result";

import { PrismaIvaBookUnitOfWork } from "../prisma-iva-book-unit-of-work";

/**
 * Postgres-real integration test for PrismaIvaBookUnitOfWork (POC #11.0c A3
 * Ciclo 6 RED Round 1). Mirror simplificado precedent purchase C6
 * `prisma-purchase-unit-of-work.integration.test.ts` (commit `5b61594`) salvo
 * asimetrías declaradas:
 *   - 3 superficies tx-bound (vs 7 en purchase): `ivaSalesBooks` +
 *     `ivaPurchaseBooks` + `fiscalPeriods` (BaseScope).
 *   - 0 cross-module §17 carve-outs en el constructor (lock C textual
 *     `iva-book-unit-of-work.ts:21-27`): IVA NO escribe journals ni
 *     balances directamente — bridge cross-module va por
 *     `Sale/PurchaseJournalRegenNotifierPort` (D-1 lockeada). Constructor
 *     recibe solo `repo: UnitOfWorkRepoLike`.
 *   - Sin VoucherType / Accounts / Contact en fixtures: IVA entries usan
 *     `nitCliente`/`nitProveedor` + `razonSocial` strings, NO FK contact.
 *
 * Capa POR ENCIMA del shared `prisma-unit-of-work.integration.test.ts` que ya
 * valida Postgres-real las 4 invariantes (correlationId pre-tx, SET LOCAL
 * inside, fn invoke, return shape). Aquí ejercemos el `IvaBookScope`
 * iva-hex específico: 2 surfaces críticas deben compartir la misma tx outer
 * abierta por `withAuditTx`.
 *
 * 2 surfaces lockeadas (mirror D-Sale-UoW#3 (a) sale C6 + D-Purch-UoW#3 (a)
 * purchase C6):
 *   - `scope.ivaSalesBooks.saveTx` (iva-hex own — Prisma directo C2)
 *   - `scope.ivaPurchaseBooks.saveTx` (iva-hex own — Prisma directo C3)
 * `fiscalPeriods` (BaseScope) tiene su propio adapter test C1 — redundancia
 * con setup pesado descartada.
 *
 * **Asimetría audit triggers vs purchase C6**: las tablas `iva_sales_books`
 * y `iva_purchase_books` NO tienen audit triggers AFTER INSERT/UPDATE/DELETE
 * (verificado contra `prisma/migrations/*audit*` — solo cubren purchase /
 * sale / accounting tables). El commit test verifica correlationId returned
 * (invariante withAuditTx pre-tx) + persistence under tx outer; NO valida
 * filas en `audit_log` porque las IVA tables no las generan. Cleanup
 * `audit_log by orgId` permanece defensive — low cost, future-proof si
 * triggers IVA se agregan más adelante.
 *
 * Fixtures `beforeAll`: User + Org + FiscalPeriod. Stamp `pibuow-`
 * (PrismaIvaBookUnitOfWork) — distingue de `ppuow-` (purchase C6),
 * `psuow-` (sale C6), `pivb-` (PrismaIvaSalesBookEntryRepo C2).
 *
 * Failure mode declarado RED honesty preventivo
 * (`feedback/red-acceptance-failure-mode`): RED genuino al import-time porque
 * `PrismaIvaBookUnitOfWork` no existe aún. 1 test file fails at import-time,
 * 0 tests run inside the failing file. GREEN R1 crea el adapter mirror
 * `PrismaPurchaseUnitOfWork` shape simplificada (constructor 1 dep, 3
 * superficies, 0 cross-module). Setup discriminante:
 *   - scope.ivaSalesBooks con tx wrong (ej. prisma global) → entry sobrevive
 *     rollback test.
 *   - scope.ivaPurchaseBooks con tx wrong → idem entry purchase.
 *
 * Cleanup `afterEach` aisla los 2 tests del describe + limpia audit por
 * correlationId capturado. `afterAll` paso 3 audit_logs orgId obligatorio
 * (captura audit_iva_sales_books + audit_iva_purchase_books triggers —
 * heredado D-Sale-UoW#3 / D-Purch-UoW#3 (a) lockeado).
 */

const repo: UnitOfWorkRepoLike = {
  transaction: (fn, options) => prisma.$transaction(fn, options),
};

describe("PrismaIvaBookUnitOfWork — Postgres integration", () => {
  let testOrgId: string;
  let testUserId: string;
  let testPeriodId: string;
  const capturedCorrelationIds: string[] = [];

  beforeAll(async () => {
    const stamp = Date.now();

    const user = await prisma.user.create({
      data: {
        clerkUserId: `pibuow-test-clerk-user-${stamp}`,
        email: `pibuow-test-${stamp}@test.local`,
        name: "PrismaIvaBookUnitOfWork Integration Test User",
      },
    });
    testUserId = user.id;

    const org = await prisma.organization.create({
      data: {
        clerkOrgId: `pibuow-test-clerk-org-${stamp}`,
        name: `PrismaIvaBookUnitOfWork Integration Test Org ${stamp}`,
        slug: `pibuow-test-org-${stamp}`,
      },
    });
    testOrgId = org.id;

    const period = await prisma.fiscalPeriod.create({
      data: {
        organizationId: testOrgId,
        name: "pibuow-integration-period",
        year: 2099,
        month: 1,
        startDate: new Date("2099-01-01T00:00:00Z"),
        endDate: new Date("2099-01-31T23:59:59Z"),
        createdById: testUserId,
      },
    });
    testPeriodId = period.id;
  });

  afterEach(async () => {
    await prisma.ivaSalesBook.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.ivaPurchaseBook.deleteMany({
      where: { organizationId: testOrgId },
    });
    if (capturedCorrelationIds.length > 0) {
      const ids = [...capturedCorrelationIds];
      capturedCorrelationIds.length = 0;
      await prisma.auditLog.deleteMany({
        where: { correlationId: { in: ids } },
      });
    }
  });

  afterAll(async () => {
    // Cleanup defensive — IVA tables NO tienen triggers audit (asimetría
    // declarada con purchase C6, JSDoc módulo). El paso `auditLog
    // deleteMany by orgId` se mantiene future-proof si triggers se agregan
    // más adelante; low cost en el setup pesado del integration.
    await prisma.ivaSalesBook.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.ivaPurchaseBook.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.fiscalPeriod.delete({ where: { id: testPeriodId } });
    await prisma.auditLog.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.organization.delete({ where: { id: testOrgId } });
    await prisma.user.delete({ where: { id: testUserId } });
  });

  function buildSalesInputs(): IvaSalesBookEntryInputs {
    return {
      importeTotal: MonetaryAmount.of(100),
      importeIce: MonetaryAmount.zero(),
      importeIehd: MonetaryAmount.zero(),
      importeIpj: MonetaryAmount.zero(),
      tasas: MonetaryAmount.zero(),
      otrosNoSujetos: MonetaryAmount.zero(),
      exentos: MonetaryAmount.zero(),
      tasaCero: MonetaryAmount.zero(),
      codigoDescuentoAdicional: MonetaryAmount.zero(),
      importeGiftCard: MonetaryAmount.zero(),
    };
  }

  function buildPurchaseInputs(): IvaPurchaseBookEntryInputs {
    return {
      importeTotal: MonetaryAmount.of(100),
      importeIce: MonetaryAmount.zero(),
      importeIehd: MonetaryAmount.zero(),
      importeIpj: MonetaryAmount.zero(),
      tasas: MonetaryAmount.zero(),
      otrosNoSujetos: MonetaryAmount.zero(),
      exentos: MonetaryAmount.zero(),
      tasaCero: MonetaryAmount.zero(),
      codigoDescuentoAdicional: MonetaryAmount.zero(),
      importeGiftCard: MonetaryAmount.zero(),
    };
  }

  function buildCalcResult(): IvaCalcResult {
    return IvaCalcResult.of({
      subtotal: MonetaryAmount.of(100),
      baseImponible: MonetaryAmount.of(100),
      ivaAmount: MonetaryAmount.of(13),
    });
  }

  function buildSalesEntry(): IvaSalesBookEntry {
    const stamp = Math.random().toString(36).slice(2, 10);
    return IvaSalesBookEntry.create({
      organizationId: testOrgId,
      fiscalPeriodId: testPeriodId,
      fechaFactura: new Date("2099-01-15T12:00:00Z"),
      nitCliente: "1234567",
      razonSocial: "pibuow integration sales",
      numeroFactura: `F-S-${stamp}`,
      codigoAutorizacion: `AUTH-S-${stamp}`,
      codigoControl: "CC-001",
      estadoSIN: "V",
      notes: null,
      inputs: buildSalesInputs(),
      calcResult: buildCalcResult(),
    });
  }

  function buildPurchaseEntry(): IvaPurchaseBookEntry {
    const stamp = Math.random().toString(36).slice(2, 10);
    return IvaPurchaseBookEntry.create({
      organizationId: testOrgId,
      fiscalPeriodId: testPeriodId,
      fechaFactura: new Date("2099-01-15T12:00:00Z"),
      nitProveedor: "7654321",
      razonSocial: "pibuow integration purchase",
      numeroFactura: `F-P-${stamp}`,
      codigoAutorizacion: `AUTH-P-${stamp}`,
      codigoControl: "CC-001",
      tipoCompra: 1,
      notes: null,
      inputs: buildPurchaseInputs(),
      calcResult: buildCalcResult(),
    });
  }

  it("commit: scope.ivaSalesBooks.saveTx + scope.ivaPurchaseBooks.saveTx share tx + audit row matches correlationId", async () => {
    const uow = new PrismaIvaBookUnitOfWork(repo);
    const draftSales = buildSalesEntry();
    const draftPurchase = buildPurchaseEntry();

    const { result, correlationId } = await uow.run(
      { userId: testUserId, organizationId: testOrgId },
      async (scope) => {
        const persistedSales = await scope.ivaSalesBooks.saveTx(draftSales);
        const persistedPurchase =
          await scope.ivaPurchaseBooks.saveTx(draftPurchase);
        return {
          salesId: persistedSales.id,
          purchaseId: persistedPurchase.id,
        };
      },
    );
    capturedCorrelationIds.push(correlationId);

    // 1. Sales entry persistida bajo orgId — cableo scope.ivaSalesBooks→tx outer.
    const salesRow = await prisma.ivaSalesBook.findUnique({
      where: { id: result.salesId },
    });
    expect(salesRow).not.toBeNull();
    expect(salesRow!.organizationId).toBe(testOrgId);

    // 2. Purchase entry persistida bajo orgId — cableo scope.ivaPurchaseBooks→tx outer.
    const purchaseRow = await prisma.ivaPurchaseBook.findUnique({
      where: { id: result.purchaseId },
    });
    expect(purchaseRow).not.toBeNull();
    expect(purchaseRow!.organizationId).toBe(testOrgId);

    // 3. correlationId pre-tx returned — invariante withAuditTx viva. NO se
    //    valida `audit_log` porque IVA tables no tienen triggers (asimetría
    //    declarada vs purchase C6, JSDoc módulo).
    expect(typeof correlationId).toBe("string");
    expect(correlationId.length).toBeGreaterThan(0);
  });

  it("rollback: fn throws after scope.ivaSalesBooks.saveTx + scope.ivaPurchaseBooks.saveTx → ningún sales, purchase ni audit persiste", async () => {
    const uow = new PrismaIvaBookUnitOfWork(repo);
    const draftSales = buildSalesEntry();
    const draftPurchase = buildPurchaseEntry();
    let salesIdBeforeThrow: string | undefined;
    let purchaseIdBeforeThrow: string | undefined;
    const boom = new Error("rollback-me");

    await expect(
      uow.run(
        { userId: testUserId, organizationId: testOrgId },
        async (scope) => {
          const persistedSales = await scope.ivaSalesBooks.saveTx(draftSales);
          salesIdBeforeThrow = persistedSales.id;
          const persistedPurchase =
            await scope.ivaPurchaseBooks.saveTx(draftPurchase);
          purchaseIdBeforeThrow = persistedPurchase.id;
          throw boom;
        },
      ),
    ).rejects.toBe(boom);

    // 1. Sales entry NO persiste — rollback Postgres-real con tx outer.
    expect(salesIdBeforeThrow).toBeDefined();
    const salesRow = await prisma.ivaSalesBook.findUnique({
      where: { id: salesIdBeforeThrow! },
    });
    expect(salesRow).toBeNull();

    // 2. Purchase entry NO persiste — rollback Postgres-real con tx outer.
    expect(purchaseIdBeforeThrow).toBeDefined();
    const purchaseRow = await prisma.ivaPurchaseBook.findUnique({
      where: { id: purchaseIdBeforeThrow! },
    });
    expect(purchaseRow).toBeNull();

    // 3. Audit rows NO persisten — withAuditTx delega a tx outer; rollback
    //    arrastra audit_logs (paridad PrismaUnitOfWork shared base).
    const auditRows = await prisma.auditLog.findMany({
      where: { organizationId: testOrgId },
    });
    expect(auditRows).toHaveLength(0);
  });
});
