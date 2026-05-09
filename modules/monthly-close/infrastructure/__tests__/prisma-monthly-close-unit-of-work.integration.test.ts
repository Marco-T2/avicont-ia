import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import type { UnitOfWorkRepoLike } from "@/modules/shared/infrastructure/prisma-unit-of-work";

import { PrismaMonthlyCloseUnitOfWork } from "../prisma-monthly-close-unit-of-work";

/**
 * Postgres-real integration test for PrismaMonthlyCloseUnitOfWork (POC nuevo
 * monthly-close C5 RED-α file 1). Mirror simplificado precedent
 * `prisma-iva-book-unit-of-work.integration.test.ts` + `prisma-accounting-unit-of-work.integration.test.ts`
 * (commit `5b61594` family) salvo asimetrías declaradas:
 *   - 2 superficies tx-bound (`scope.locking.lockDispatches` +
 *     `scope.fiscalPeriods.markClosed` BaseScope) + correlationId — 1-arg ctor.
 *   - Fixtures simplificados: User + Org + FiscalPeriod + 1 Dispatch POSTED
 *     (single entity ejercida en commit + rollback discriminantes).
 *   - JournalEntry / Sale / Purchase / Payment NO sembrados (cobertura
 *     5-entity lock cascade STRICT ORDER vive en file 2 service behavioral
 *     test via composition root canónico).
 *
 * Capa POR ENCIMA del unit + contract test (no aplica — POC nuevo monthly-close
 * NO incluye unit test composition-root dedicado, file 1 ejerce UoW directo) y
 * POR ENCIMA del shared `prisma-unit-of-work.integration.test.ts` que ya valida
 * Postgres-real las 4 invariantes inherited (correlationId pre-tx, SET LOCAL
 * inside, fn invoke, return shape). Aquí ejercemos el `MonthlyCloseScope`
 * shape específico: 2 surfaces deben compartir la misma tx outer abierta por
 * `withAuditTx` con timeout 30_000 wiring legacy parity preservation.
 *
 * **Asimetría timeout vs precedent**: PrismaMonthlyCloseUnitOfWork pasa 4to
 * arg `{timeout: 30_000}` a `withAuditTx` (Lock #5 1ra evidencia POC monthly-
 * close). El tiempo no es observable en estos tests (las queries de un solo
 * dispatch terminan en milisegundos), pero el wiring queda ejercido sin lanzar
 * por construcción del UoW.
 *
 * **Asimetría audit cleanup**: dispatch + journal_entries / sales / purchases /
 * payments tienen audit triggers AFTER UPDATE → la transacción commit produce
 * 1 row `dispatches` (lock POSTED→LOCKED) + 1 row `fiscal_periods`
 * (STATUS_CHANGE markClosed). Se valida correlationId match defensive con
 * `entityType in (dispatches, fiscal_periods)`.
 *
 * Stamp `pmcuow-` (PrismaMonthlyCloseUnitOfWork) — distingue de `pibuow-`
 * (iva-books C6), `paouw-` (accounting C5 P8), `uow-` (shared base).
 *
 * Failure mode declarado RED honesty
 * (`feedback/red-acceptance-failure-mode`): C3 GREEN ya cementó
 * `PrismaMonthlyCloseUnitOfWork` + 4 adapters (commit `a80e6c3`). Los 2 tests
 * PASAN al primer correr — NOT RED genuino, caracterización con setup
 * discriminante:
 *   - scope.locking con tx wrong (ej. prisma global) → dispatch sobrevive el
 *     rollback test.
 *   - scope.fiscalPeriods.markClosed con tx wrong → period queda CLOSED tras
 *     rollback test, dispatch sigue POSTED tras commit test mismatch.
 *
 * Cleanup `afterEach` aisla los 2 tests del describe + limpia audit por
 * correlationId capturado. `afterAll` paso 3 audit_logs orgId obligatorio
 * (captura audit_dispatches + audit_fiscal_periods triggers — heredado
 * P2 C3-B convention).
 */

const repo: UnitOfWorkRepoLike = {
  transaction: (fn, options) => prisma.$transaction(fn, options),
};

describe("PrismaMonthlyCloseUnitOfWork — Postgres integration", () => {
  let testOrgId: string;
  let testUserId: string;
  let testPeriodId: string;
  let testContactId: string;
  const capturedCorrelationIds: string[] = [];

  beforeAll(async () => {
    const stamp = Date.now();

    const user = await prisma.user.create({
      data: {
        clerkUserId: `pmcuow-test-clerk-user-${stamp}`,
        email: `pmcuow-test-${stamp}@test.local`,
        name: "PrismaMonthlyCloseUnitOfWork Integration Test User",
      },
    });
    testUserId = user.id;

    const org = await prisma.organization.create({
      data: {
        clerkOrgId: `pmcuow-test-clerk-org-${stamp}`,
        name: `PrismaMonthlyCloseUnitOfWork Integration Test Org ${stamp}`,
        slug: `pmcuow-test-org-${stamp}`,
      },
    });
    testOrgId = org.id;

    const period = await prisma.fiscalPeriod.create({
      data: {
        organizationId: testOrgId,
        name: "pmcuow-integration-period",
        year: 2099,
        month: 1,
        startDate: new Date("2099-01-01T00:00:00Z"),
        endDate: new Date("2099-01-31T23:59:59Z"),
        status: "OPEN",
        createdById: testUserId,
      },
    });
    testPeriodId = period.id;

    const contact = await prisma.contact.create({
      data: {
        organizationId: testOrgId,
        type: "CLIENTE",
        name: "pmcuow integration contact",
      },
    });
    testContactId = contact.id;
  });

  afterEach(async () => {
    // Aislamiento entre tests: dispatch primero (sin children), luego
    // restaurar period a OPEN si quedó CLOSED por commit test, audit
    // por correlationId.
    await prisma.dispatch.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.fiscalPeriod.update({
      where: { id: testPeriodId },
      data: { status: "OPEN", closedAt: null, closedBy: null },
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
    // FK-safe + paso 3 obligatorio audit_logs por orgId.
    await prisma.dispatch.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.contact.delete({ where: { id: testContactId } });
    await prisma.fiscalPeriod.delete({ where: { id: testPeriodId } });
    await prisma.auditLog.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.organization.delete({ where: { id: testOrgId } });
    await prisma.user.delete({ where: { id: testUserId } });
  });

  async function seedPostedDispatch(): Promise<string> {
    const dispatch = await prisma.dispatch.create({
      data: {
        organizationId: testOrgId,
        dispatchType: "NOTA_DESPACHO",
        status: "POSTED",
        sequenceNumber: Math.floor(Math.random() * 1_000_000),
        date: new Date("2099-01-15T12:00:00Z"),
        contactId: testContactId,
        periodId: testPeriodId,
        description: "pmcuow integration POSTED dispatch",
        totalAmount: "100.00",
        createdById: testUserId,
      },
    });
    return dispatch.id;
  }

  it("commit: scope.locking.lockDispatches + scope.fiscalPeriods.markClosed share tx + audit row matches correlationId", async () => {
    const dispatchId = await seedPostedDispatch();
    const uow = new PrismaMonthlyCloseUnitOfWork(repo);

    const { result, correlationId } = await uow.run(
      { userId: testUserId, organizationId: testOrgId },
      async (scope) => {
        const lockedCount = await scope.locking.lockDispatches(
          testOrgId,
          testPeriodId,
        );
        const { closedAt, closedBy } = await scope.fiscalPeriods.markClosed(
          testOrgId,
          testPeriodId,
          testUserId,
        );
        return { lockedCount, closedAt, closedBy };
      },
    );
    capturedCorrelationIds.push(correlationId);

    // 1. Dispatch transitioned POSTED→LOCKED — cableo scope.locking→tx outer.
    expect(result.lockedCount).toBe(1);
    const dispatchRow = await prisma.dispatch.findUniqueOrThrow({
      where: { id: dispatchId },
    });
    expect(dispatchRow.status).toBe("LOCKED");

    // 2. Period transitioned OPEN→CLOSED — cableo scope.fiscalPeriods→tx outer
    //    (BaseScope shared cumulative POC #9 inside MonthlyCloseScope).
    const periodRow = await prisma.fiscalPeriod.findUniqueOrThrow({
      where: { id: testPeriodId },
    });
    expect(periodRow.status).toBe("CLOSED");
    expect(periodRow.closedBy).toBe(testUserId);
    expect(result.closedBy).toBe(testUserId);
    expect(result.closedAt).toBeInstanceOf(Date);

    // 3. correlationId pre-tx returned + audit rows comparten correlationId
    //    (invariantes withAuditTx vivas through MonthlyCloseScope).
    expect(typeof correlationId).toBe("string");
    expect(correlationId.length).toBeGreaterThan(0);

    const auditRows = await prisma.auditLog.findMany({
      where: { correlationId, organizationId: testOrgId },
    });
    expect(auditRows.length).toBeGreaterThan(0);
    expect(auditRows.every((r) => r.changedById === testUserId)).toBe(true);
    const entityTypes = new Set(auditRows.map((r) => r.entityType));
    expect(entityTypes.has("dispatches")).toBe(true);
    expect(entityTypes.has("fiscal_periods")).toBe(true);
  });

  it("rollback: fn throws after lockDispatches + markClosed → ningún dispatch lock, ningún period CLOSED ni audit persiste", async () => {
    const dispatchId = await seedPostedDispatch();
    const uow = new PrismaMonthlyCloseUnitOfWork(repo);
    let scopeIdBeforeThrow: string | undefined;
    const boom = new Error("rollback-me");

    await expect(
      uow.run(
        { userId: testUserId, organizationId: testOrgId },
        async (scope) => {
          scopeIdBeforeThrow = scope.correlationId;
          await scope.locking.lockDispatches(testOrgId, testPeriodId);
          await scope.fiscalPeriods.markClosed(
            testOrgId,
            testPeriodId,
            testUserId,
          );
          throw boom;
        },
      ),
    ).rejects.toBe(boom);

    expect(scopeIdBeforeThrow).toBeDefined();
    capturedCorrelationIds.push(scopeIdBeforeThrow!);

    // 1. Dispatch sigue POSTED — rollback Postgres-real con tx outer.
    //    Si scope.locking usara tx distinta, el dispatch quedaría LOCKED.
    const dispatchRow = await prisma.dispatch.findUniqueOrThrow({
      where: { id: dispatchId },
    });
    expect(dispatchRow.status).toBe("POSTED");

    // 2. Period sigue OPEN — rollback Postgres-real con tx outer.
    //    Si scope.fiscalPeriods usara tx distinta, period quedaría CLOSED.
    const periodRow = await prisma.fiscalPeriod.findUniqueOrThrow({
      where: { id: testPeriodId },
    });
    expect(periodRow.status).toBe("OPEN");
    expect(periodRow.closedAt).toBeNull();
    expect(periodRow.closedBy).toBeNull();

    // 3. Audit rows NO persisten — withAuditTx delega a tx outer; rollback
    //    arrastra audit_logs (paridad PrismaUnitOfWork shared base).
    const auditRows = await prisma.auditLog.findMany({
      where: { correlationId: scopeIdBeforeThrow! },
    });
    expect(auditRows.length).toBe(0);
  });
});
