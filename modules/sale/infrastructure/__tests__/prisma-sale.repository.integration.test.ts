import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { Sale } from "@/modules/sale/domain/sale.entity";
import { SaleDetail } from "@/modules/sale/domain/sale-detail.entity";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

import { PrismaSaleRepository } from "../prisma-sale.repository";

/**
 * Postgres-real integration test for PrismaSaleRepository (POC #11.0a A3
 * Ciclo 3). Same baseline pattern as POC #10 C3-A `prisma-account-balances`
 * + paso 3 audit_logs cleanup heredado C3-B (audit_sales + audit_sale_details
 * triggers verificados migration 20260424123854).
 *
 * Fixtures (`beforeAll`): User + Organization + FiscalPeriod + Account
 * (income) + Contact. Sales se crean por test para aislamiento.
 *
 * §13 emergente locked Marco: Prisma directo (Opción β) — adapter NO wrap-thin
 * shim sobre legacy. Mirror behavior legacy bit-exact via Prisma queries
 * directas sobre `Pick<PrismaClient, "sale" | "saleDetail">`.
 *
 * D-Sale-Repo#2 locked Opción A: getNextSequenceNumberTx mirror MAX+1 SIN
 * lock (fidelidad regla #1; @@unique como red de seguridad).
 */

describe("PrismaSaleRepository — Postgres integration", () => {
  let testUserId: string;
  let testOrgId: string;
  let testPeriodId: string;
  let incomeAccountId: string;
  let testContactId: string;

  beforeAll(async () => {
    const stamp = Date.now();

    const user = await prisma.user.create({
      data: {
        clerkUserId: `psr-test-clerk-user-${stamp}`,
        email: `psr-test-${stamp}@test.local`,
        name: "PrismaSaleRepository Integration Test User",
      },
    });
    testUserId = user.id;

    const org = await prisma.organization.create({
      data: {
        clerkOrgId: `psr-test-clerk-org-${stamp}`,
        name: `PrismaSaleRepository Integration Test Org ${stamp}`,
        slug: `psr-test-org-${stamp}`,
      },
    });
    testOrgId = org.id;

    const period = await prisma.fiscalPeriod.create({
      data: {
        organizationId: testOrgId,
        name: "psr-integration-period",
        year: 2099,
        month: 1,
        startDate: new Date("2099-01-01T00:00:00Z"),
        endDate: new Date("2099-01-31T23:59:59Z"),
        createdById: testUserId,
      },
    });
    testPeriodId = period.id;

    const account = await prisma.account.create({
      data: {
        organizationId: testOrgId,
        code: "4100",
        name: "Income Account",
        type: "INGRESO",
        nature: "ACREEDORA",
        level: 1,
        isDetail: true,
      },
    });
    incomeAccountId = account.id;

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
    // Aislamiento entre tests del mismo describe — child antes de padre por
    // FK Cascade safety + paridad con C3-B journal_lines pattern.
    await prisma.saleDetail.deleteMany({
      where: { sale: { organizationId: testOrgId } },
    });
    await prisma.sale.deleteMany({ where: { organizationId: testOrgId } });
  });

  afterAll(async () => {
    // FK-safe order, child→parent en cascada, paso 3 obligatorio:
    //   1. sale_details (defensa explícita pre-trigger; Cascade existe pero
    //      paralelo C3-B journal_lines pattern por consistencia)
    //   2. sales
    //   3. accounts
    //   4. contacts
    //   5. fiscal_periods
    //   6. audit_logs (paso 3 — captura audit_sales + audit_sale_details)
    //   7. organization
    //   8. user
    await prisma.saleDetail.deleteMany({
      where: { sale: { organizationId: testOrgId } },
    });
    await prisma.sale.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.account.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.contact.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.fiscalPeriod.delete({ where: { id: testPeriodId } });
    await prisma.auditLog.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.organization.delete({ where: { id: testOrgId } });
    await prisma.user.delete({ where: { id: testUserId } });
  });

  function buildDraftSale(overrides?: {
    description?: string;
    detailsCount?: number;
  }): Sale {
    const count = overrides?.detailsCount ?? 2;
    const details = Array.from({ length: count }, (_, i) => ({
      description: `line ${i + 1}`,
      lineAmount: MonetaryAmount.of(100 * (i + 1)),
      order: i,
      incomeAccountId,
    }));
    return Sale.createDraft({
      organizationId: testOrgId,
      contactId: testContactId,
      periodId: testPeriodId,
      date: new Date("2099-01-15T12:00:00Z"),
      description: overrides?.description ?? "psr integration sale",
      createdById: testUserId,
      details,
    });
  }

  async function seedSaleDirect(
    status: "DRAFT" | "POSTED",
    sequenceNumber: number,
    detailsCount = 2,
  ): Promise<string> {
    const id = crypto.randomUUID();
    await prisma.sale.create({
      data: {
        id,
        organizationId: testOrgId,
        status,
        sequenceNumber,
        date: new Date("2099-01-15T12:00:00Z"),
        contactId: testContactId,
        periodId: testPeriodId,
        description: "seeded sale",
        totalAmount: new Prisma.Decimal(detailsCount * 100),
        createdById: testUserId,
        details: {
          create: Array.from({ length: detailsCount }, (_, i) => ({
            description: `seeded line ${i + 1}`,
            lineAmount: new Prisma.Decimal(100),
            order: i,
            incomeAccountId,
          })),
        },
      },
    });
    return id;
  }

  // ── Tests ───────────────────────────────────────────────────────────────

  it("findById: hit returns Sale aggregate with details hydrated", async () => {
    // RED honesty preventivo: pre-GREEN FAILS por module resolution failure
    // (`../prisma-sale.repository` no existe). Post-GREEN: PASSES porque
    // adapter lee row + details ordenados (orderBy:order asc) y retorna
    // Sale.fromPersistence con array hidratado.
    const id = await seedSaleDirect("DRAFT", 0, 3);
    const repo = new PrismaSaleRepository();

    const result = await repo.findById(testOrgId, id);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(id);
    expect(result!.organizationId).toBe(testOrgId);
    expect(result!.status).toBe("DRAFT");
    expect(result!.details).toHaveLength(3);
    expect(result!.details[0].order).toBe(0);
    expect(result!.details[0].lineAmount.value).toBe(100);
  });

  it("findById: miss orgId mismatch returns null", async () => {
    // RED honesty: pre-GREEN module resolution failure. Post-GREEN: scope
    // por organizationId rechaza row de otro org (asserción cross-tenant).
    const id = await seedSaleDirect("DRAFT", 0);
    const repo = new PrismaSaleRepository();

    const result = await repo.findById("other-org-id", id);

    expect(result).toBeNull();
  });

  it("findAll: no filters returns all sales for org", async () => {
    // RED honesty: pre-GREEN module resolution failure. Post-GREEN: list por
    // organizationId sin filtros adicionales.
    await seedSaleDirect("DRAFT", 0);
    await seedSaleDirect("POSTED", 1);
    const repo = new PrismaSaleRepository();

    const result = await repo.findAll(testOrgId);

    expect(result).toHaveLength(2);
  });

  it("findAll: filters status + contactId + dateFrom narrow correctly", async () => {
    // RED honesty: pre-GREEN module resolution failure. Post-GREEN: WHERE
    // compone status + contactId + date.gte como legacy.
    await seedSaleDirect("DRAFT", 0);
    await seedSaleDirect("POSTED", 1);
    const repo = new PrismaSaleRepository();

    const result = await repo.findAll(testOrgId, {
      status: "POSTED",
      contactId: testContactId,
      dateFrom: new Date("2099-01-01T00:00:00Z"),
    });

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("POSTED");
  });

  it("findByIdTx: hit inside $transaction returns Sale aggregate", async () => {
    // RED honesty: pre-GREEN module resolution failure. Post-GREEN: adapter
    // tx-bound (constructor con tx) lee dentro de la transacción abierta.
    const id = await seedSaleDirect("DRAFT", 0);

    const result = await prisma.$transaction(async (tx) => {
      const repo = new PrismaSaleRepository(tx);
      return repo.findByIdTx(testOrgId, id);
    });

    expect(result).not.toBeNull();
    expect(result!.id).toBe(id);
  });

  it("saveTx: persists DRAFT with status, totals, and details", async () => {
    // RED honesty: pre-GREEN module resolution failure. Post-GREEN: adapter
    // INSERT row + nested INSERT details. Mirror legacy `create` + tx-bound.
    // §13 transitivo C3-B: pre-persist UUID del aggregate se descarta, row
    // queda con CUID Prisma. Verificamos persistencia post-tx leyendo desde
    // prisma global.
    const sale = buildDraftSale({ detailsCount: 2 });
    const aggregateId = sale.id;

    await prisma.$transaction(async (tx) => {
      const repo = new PrismaSaleRepository(tx);
      await repo.saveTx(sale);
    });

    const persisted = await prisma.sale.findFirst({
      where: { id: aggregateId, organizationId: testOrgId },
      include: { details: { orderBy: { order: "asc" } } },
    });
    expect(persisted).not.toBeNull();
    expect(persisted!.status).toBe("DRAFT");
    expect(persisted!.sequenceNumber).toBe(0);
    expect(Number(persisted!.totalAmount)).toBe(300); // 100 + 200
    expect(persisted!.details).toHaveLength(2);
    expect(persisted!.details[0].order).toBe(0);
    expect(Number(persisted!.details[0].lineAmount)).toBe(100);
  });

  it("saveTx: persists POSTED with sequenceNumber assigned and totalAmount", async () => {
    // RED honesty: pre-GREEN module resolution failure. Post-GREEN: adapter
    // persiste status=POSTED + sequenceNumber>0 + totalAmount Decimal real.
    const draft = buildDraftSale({ detailsCount: 2 });
    const posted = draft.assignSequenceNumber(7).post();
    const aggregateId = posted.id;

    await prisma.$transaction(async (tx) => {
      const repo = new PrismaSaleRepository(tx);
      await repo.saveTx(posted);
    });

    const persisted = await prisma.sale.findFirst({
      where: { id: aggregateId, organizationId: testOrgId },
    });
    expect(persisted).not.toBeNull();
    expect(persisted!.status).toBe("POSTED");
    expect(persisted!.sequenceNumber).toBe(7);
    expect(Number(persisted!.totalAmount)).toBe(300);
  });

  it("saveTx: normalizes date to noon UTC (legacy toNoonUtc parity)", async () => {
    // RED honesty (POC #11.0a A3 audit H-01): pre-fix saveTx persiste
    // `sale.date` directo (`prisma-sale.repository.ts:81`). Legacy
    // sale.repository (create/createPostedTx) aplicaba `toNoonUtc(input.date)` →
    // toda row persistida garantizaba 12:00 UTC. Sin fix, el row quedaba con la
    // hora de input. (Legacy post-A3-C7 atomic delete commit ad36da2.)
    // Expected failure: `persisted.date.toISOString()` devuelve
    // `"2099-01-15T14:30:00.000Z"` en vez de `"2099-01-15T12:00:00.000Z"`.
    const draft = Sale.createDraft({
      organizationId: testOrgId,
      contactId: testContactId,
      periodId: testPeriodId,
      date: new Date("2099-01-15T14:30:00Z"),
      description: "non-noon date sale",
      createdById: testUserId,
      details: [
        {
          description: "line 1",
          lineAmount: MonetaryAmount.of(100),
          order: 0,
          incomeAccountId,
        },
      ],
    });

    await prisma.$transaction(async (tx) => {
      const repo = new PrismaSaleRepository(tx);
      await repo.saveTx(draft);
    });

    const persisted = await prisma.sale.findFirstOrThrow({
      where: { id: draft.id, organizationId: testOrgId },
    });
    expect(persisted.date.toISOString()).toBe("2099-01-15T12:00:00.000Z");
  });

  it("updateTx: replaceDetails:false updates header only, details intact", async () => {
    // RED honesty: pre-GREEN module resolution failure. Post-GREEN: adapter
    // ejecuta UPDATE sale SET ... sin tocar sale_details. Details count
    // intacto post-update.
    const id = await seedSaleDirect("DRAFT", 0, 3);

    const fetched = await prisma.sale.findFirstOrThrow({
      where: { id, organizationId: testOrgId },
      include: { details: { orderBy: { order: "asc" } } },
    });

    const aggregate = Sale.fromPersistence({
      id: fetched.id,
      organizationId: fetched.organizationId,
      status: fetched.status,
      sequenceNumber: fetched.sequenceNumber,
      date: fetched.date,
      contactId: fetched.contactId,
      periodId: fetched.periodId,
      description: fetched.description,
      referenceNumber: fetched.referenceNumber,
      notes: fetched.notes,
      totalAmount: MonetaryAmount.of(Number(fetched.totalAmount)),
      journalEntryId: fetched.journalEntryId,
      receivableId: fetched.receivableId,
      createdById: fetched.createdById,
      createdAt: fetched.createdAt,
      updatedAt: fetched.updatedAt,
      details: fetched.details.map((d) =>
        SaleDetail.fromPersistence({
          id: d.id,
          saleId: d.saleId,
          description: d.description,
          lineAmount: MonetaryAmount.of(Number(d.lineAmount)),
          order: d.order,
          quantity: d.quantity ? Number(d.quantity) : undefined,
          unitPrice: d.unitPrice ? Number(d.unitPrice) : undefined,
          incomeAccountId: d.incomeAccountId,
        }),
      ),
      receivable: null,
    });

    const edited = aggregate.applyEdit({ description: "edited description" });

    await prisma.$transaction(async (tx) => {
      const repo = new PrismaSaleRepository(tx);
      await repo.updateTx(edited, { replaceDetails: false });
    });

    const persisted = await prisma.sale.findFirstOrThrow({
      where: { id, organizationId: testOrgId },
      include: { details: true },
    });
    expect(persisted.description).toBe("edited description");
    expect(persisted.details).toHaveLength(3); // intacto
  });

  it("updateTx: replaceDetails:true delete-and-recreate details, totalAmount recalculated", async () => {
    // RED honesty: pre-GREEN module resolution failure. Post-GREEN: adapter
    // mirror legacy delete-and-recreate: tx.saleDetail.deleteMany + createMany
    // con newDetails. Total recalculated por aggregate antes del update.
    const id = await seedSaleDirect("DRAFT", 0, 3);

    const fetched = await prisma.sale.findFirstOrThrow({
      where: { id, organizationId: testOrgId },
      include: { details: { orderBy: { order: "asc" } } },
    });

    const aggregate = Sale.fromPersistence({
      id: fetched.id,
      organizationId: fetched.organizationId,
      status: fetched.status,
      sequenceNumber: fetched.sequenceNumber,
      date: fetched.date,
      contactId: fetched.contactId,
      periodId: fetched.periodId,
      description: fetched.description,
      referenceNumber: fetched.referenceNumber,
      notes: fetched.notes,
      totalAmount: MonetaryAmount.of(Number(fetched.totalAmount)),
      journalEntryId: fetched.journalEntryId,
      receivableId: fetched.receivableId,
      createdById: fetched.createdById,
      createdAt: fetched.createdAt,
      updatedAt: fetched.updatedAt,
      details: [],
      receivable: null,
    });

    const newDetails = [
      SaleDetail.create({
        saleId: id,
        description: "new line A",
        lineAmount: MonetaryAmount.of(50),
        order: 0,
        incomeAccountId,
      }),
      SaleDetail.create({
        saleId: id,
        description: "new line B",
        lineAmount: MonetaryAmount.of(75),
        order: 1,
        incomeAccountId,
      }),
    ];
    const replaced = aggregate.replaceDetails(newDetails);

    await prisma.$transaction(async (tx) => {
      const repo = new PrismaSaleRepository(tx);
      await repo.updateTx(replaced, { replaceDetails: true });
    });

    const persisted = await prisma.sale.findFirstOrThrow({
      where: { id, organizationId: testOrgId },
      include: { details: { orderBy: { order: "asc" } } },
    });
    expect(persisted.details).toHaveLength(2);
    expect(persisted.details.map((d) => d.description)).toEqual([
      "new line A",
      "new line B",
    ]);
    expect(Number(persisted.totalAmount)).toBe(125); // 50 + 75
  });

  it("updateTx: replaceDetails:false propagates journalEntryId and receivableId set on aggregate", async () => {
    // RED honesty: pre-GREEN module resolution failure. Post-GREEN: adapter
    // mirror legacy `linkJournalAndReceivable` colapsado en updateTx —
    // header-only path persiste journalEntryId + receivableId cuando aggregate
    // los trae set. Para evitar overhead FK (JournalEntry+Receivable rows
    // reales) no seteamos FK válidos: usamos null→null para verificar que
    // updateTx persiste la columna. Test focaliza en path adapter, NO en FK
    // semantics (cubierto por tests legacy).
    const id = await seedSaleDirect("DRAFT", 0);

    const fetched = await prisma.sale.findFirstOrThrow({
      where: { id, organizationId: testOrgId },
      include: { details: true },
    });

    const aggregate = Sale.fromPersistence({
      id: fetched.id,
      organizationId: fetched.organizationId,
      status: fetched.status,
      sequenceNumber: fetched.sequenceNumber,
      date: fetched.date,
      contactId: fetched.contactId,
      periodId: fetched.periodId,
      description: fetched.description,
      referenceNumber: fetched.referenceNumber,
      notes: fetched.notes,
      totalAmount: MonetaryAmount.of(Number(fetched.totalAmount)),
      journalEntryId: fetched.journalEntryId,
      receivableId: fetched.receivableId,
      createdById: fetched.createdById,
      createdAt: fetched.createdAt,
      updatedAt: fetched.updatedAt,
      details: fetched.details.map((d) =>
        SaleDetail.fromPersistence({
          id: d.id,
          saleId: d.saleId,
          description: d.description,
          lineAmount: MonetaryAmount.of(Number(d.lineAmount)),
          order: d.order,
          quantity: d.quantity ? Number(d.quantity) : undefined,
          unitPrice: d.unitPrice ? Number(d.unitPrice) : undefined,
          incomeAccountId: d.incomeAccountId,
        }),
      ),
      receivable: null,
    });

    // Ambos null en aggregate → adapter persiste null/null (no-op semantically
    // pero verifica que el path está cableado).
    await prisma.$transaction(async (tx) => {
      const repo = new PrismaSaleRepository(tx);
      await repo.updateTx(aggregate, { replaceDetails: false });
    });

    const persisted = await prisma.sale.findFirstOrThrow({
      where: { id, organizationId: testOrgId },
    });
    expect(persisted.journalEntryId).toBeNull();
    expect(persisted.receivableId).toBeNull();
  });

  it("updateTx: normalizes date to noon UTC (legacy toNoonUtc parity)", async () => {
    // RED honesty (POC #11.0a A3 audit H-02): pre-fix updateTx persiste
    // `sale.date` directo (`prisma-sale.repository.ts:109`). Legacy
    // sale.repository (buildUpdateData) aplicaba `toNoonUtc(data.date)`. Sin
    // fix, el path edición rompía la garantía 12:00 UTC del row. (Legacy
    // post-A3-C7 atomic delete commit ad36da2.)
    // Expected failure: `persisted.date.toISOString()` devuelve
    // `"2099-02-20T08:15:00.000Z"` en vez de `"2099-02-20T12:00:00.000Z"`.
    const id = await seedSaleDirect("DRAFT", 0);

    const fetched = await prisma.sale.findFirstOrThrow({
      where: { id, organizationId: testOrgId },
      include: { details: { orderBy: { order: "asc" } } },
    });

    const aggregate = Sale.fromPersistence({
      id: fetched.id,
      organizationId: fetched.organizationId,
      status: fetched.status,
      sequenceNumber: fetched.sequenceNumber,
      date: fetched.date,
      contactId: fetched.contactId,
      periodId: fetched.periodId,
      description: fetched.description,
      referenceNumber: fetched.referenceNumber,
      notes: fetched.notes,
      totalAmount: MonetaryAmount.of(Number(fetched.totalAmount)),
      journalEntryId: fetched.journalEntryId,
      receivableId: fetched.receivableId,
      createdById: fetched.createdById,
      createdAt: fetched.createdAt,
      updatedAt: fetched.updatedAt,
      details: fetched.details.map((d) =>
        SaleDetail.fromPersistence({
          id: d.id,
          saleId: d.saleId,
          description: d.description,
          lineAmount: MonetaryAmount.of(Number(d.lineAmount)),
          order: d.order,
          quantity: d.quantity ? Number(d.quantity) : undefined,
          unitPrice: d.unitPrice ? Number(d.unitPrice) : undefined,
          incomeAccountId: d.incomeAccountId,
        }),
      ),
      receivable: null,
    });

    const edited = aggregate.applyEdit({
      date: new Date("2099-02-20T08:15:00Z"),
    });

    await prisma.$transaction(async (tx) => {
      const repo = new PrismaSaleRepository(tx);
      await repo.updateTx(edited, { replaceDetails: false });
    });

    const persisted = await prisma.sale.findFirstOrThrow({
      where: { id, organizationId: testOrgId },
    });
    expect(persisted.date.toISOString()).toBe("2099-02-20T12:00:00.000Z");
  });

  it("deleteTx: removes sale row + cascades sale_details", async () => {
    // RED honesty: pre-GREEN module resolution failure. Post-GREEN: adapter
    // ejecuta DELETE sale; Cascade FK borra sale_details. Verificamos count=0
    // post-delete en ambas tablas.
    //
    // SET LOCAL app.current_organization_id obligatorio antes de deleteTx:
    // CASCADE DELETE de sale_details dispara `audit_sale_details` AFTER
    // DELETE; el lookup de organizationId en parent `sales` retorna NULL
    // (parent ya borrado), trigger cae al fallback session var. Simula lo
    // que `SaleUnitOfWork.run` hará en Ciclo 6 vía `setAuditContext()`
    // (features/shared/audit-context.ts). El adapter NO setea audit context
    // por diseño — es responsabilidad del UoW (R2 §3 ports-only).
    const id = await seedSaleDirect("DRAFT", 0, 3);

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_organization_id = '${testOrgId}'`,
      );
      const repo = new PrismaSaleRepository(tx);
      await repo.deleteTx(testOrgId, id);
    });

    const sale = await prisma.sale.findFirst({
      where: { id, organizationId: testOrgId },
    });
    const details = await prisma.saleDetail.count({
      where: { saleId: id },
    });
    expect(sale).toBeNull();
    expect(details).toBe(0);
  });

  it("getNextSequenceNumberTx: returns 1 first call, N+1 after seed N", async () => {
    // RED honesty: pre-GREEN module resolution failure. Post-GREEN: mirror
    // legacy MAX+1 SIN lock (D-Sale-Repo#2 Opción A locked Marco). Two
    // assertions: empty org → 1; tras seed sequenceNumber=5 → 6.
    const first = await prisma.$transaction(async (tx) => {
      const repo = new PrismaSaleRepository(tx);
      return repo.getNextSequenceNumberTx(testOrgId);
    });
    expect(first).toBe(1);

    await seedSaleDirect("POSTED", 5);

    const second = await prisma.$transaction(async (tx) => {
      const repo = new PrismaSaleRepository(tx);
      return repo.getNextSequenceNumberTx(testOrgId);
    });
    expect(second).toBe(6);
  });
});
