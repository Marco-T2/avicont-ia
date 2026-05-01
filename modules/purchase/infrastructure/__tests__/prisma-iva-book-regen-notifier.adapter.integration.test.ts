import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { IvaBooksService } from "@/features/accounting/iva-books/iva-books.service";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { PrismaIvaBookRegenNotifierAdapter } from "../prisma-iva-book-regen-notifier.adapter";

/**
 * Postgres-real integration test for PrismaIvaBookRegenNotifierAdapter
 * (POC #11.0b A3 Ciclo 5c). Mirror sale 5c bit-exact + asimetrías purchase:
 * - contact type PROVEEDOR (vs CLIENTE)
 * - Purchase fixture con purchaseType="FLETE" (audit-4 D-A3-1)
 * - tabla `iva_purchase_books` (vs `iva_sales_books`), col `purchaseId` (vs saleId)
 * - schema IvaPurchaseBook tiene `nitProveedor` y NO tiene `estadoSIN`
 *   (sale-only)
 * - audit_logs paso 3 cleanup obligatorio: audit_purchases trigger captura
 *   inserts Purchase fixture. iva_purchase_books NO tiene audit trigger.
 *
 * Tx-bound híbrida: adapter recibe `Prisma.TransactionClient` por c2 DI vía
 * PurchaseScope (C6) + `IvaBooksService` legacy para delegar
 * `recomputeFromPurchaseCascade`.
 *
 * §13 emergente E-5.b-purchase locked Marco: Opción β híbrida tx-aware.
 * Drift contract real — port `recomputeFromPurchase` retorna
 * `IvaBookForEntry | null`, legacy `recomputeFromPurchaseCascade
 * iva-books.service.ts:618` retorna void. Adapter ejecuta legacy call
 * (side-effect Decimal mutation in-tx) + post-call
 * `tx.ivaPurchaseBook.findFirst({where:{purchaseId, organizationId}})` y
 * narrow al shape `IvaBookForEntry` (4 fields, mirror
 * `extractIvaBookForEntry purchase.service.ts:233-238`).
 *
 * Post-call findFirst SIN status filter — paridad bit-exact con legacy
 * `recomputeFromPurchaseCascade:624` (que tampoco filtra). Decisión Marco
 * locked (precedente sale 5c (b) + Ciclo 3 getNextSequenceNumber): adapter
 * NO inventa "defensive" filter; legacy bug latente (mutate VOIDED) se
 * arregla en POC dedicado, no via mejora unilateral.
 */

describe("PrismaIvaBookRegenNotifierAdapter — Postgres integration", () => {
  let testUserId: string;
  let testOrgId: string;
  let testPeriodId: string;
  let testContactId: string;

  beforeAll(async () => {
    const stamp = Date.now();

    const user = await prisma.user.create({
      data: {
        clerkUserId: `pibrnp-test-clerk-user-${stamp}`,
        email: `pibrnp-test-${stamp}@test.local`,
        name: "PrismaIvaBookRegenNotifierAdapter Purchase Integration Test User",
      },
    });
    testUserId = user.id;

    const org = await prisma.organization.create({
      data: {
        clerkOrgId: `pibrnp-test-clerk-org-${stamp}`,
        name: `PrismaIvaBookRegenNotifierAdapter Purchase Integration Test Org ${stamp}`,
        slug: `pibrnp-test-org-${stamp}`,
      },
    });
    testOrgId = org.id;

    const period = await prisma.fiscalPeriod.create({
      data: {
        organizationId: testOrgId,
        name: "pibrnp-integration-period",
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
        name: "Test Supplier",
        type: "PROVEEDOR",
        nit: "9999999",
      },
    });
    testContactId = contact.id;
  });

  afterEach(async () => {
    await prisma.ivaPurchaseBook.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.purchase.deleteMany({ where: { organizationId: testOrgId } });
  });

  afterAll(async () => {
    await prisma.ivaPurchaseBook.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.purchase.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.contact.deleteMany({ where: { organizationId: testOrgId } });
    await prisma.fiscalPeriod.delete({ where: { id: testPeriodId } });
    await prisma.auditLog.deleteMany({
      where: { organizationId: testOrgId },
    });
    await prisma.organization.delete({ where: { id: testOrgId } });
    await prisma.user.delete({ where: { id: testUserId } });
  });

  async function seedPurchaseDirect(sequenceNumber: number): Promise<string> {
    const id = crypto.randomUUID();
    await prisma.purchase.create({
      data: {
        id,
        organizationId: testOrgId,
        purchaseType: "FLETE",
        status: "DRAFT",
        sequenceNumber,
        date: new Date("2099-01-15T12:00:00Z"),
        contactId: testContactId,
        periodId: testPeriodId,
        description: "pibrnp seeded purchase",
        totalAmount: new Prisma.Decimal("120.00"),
        createdById: testUserId,
      },
    });
    return id;
  }

  async function seedIvaPurchaseBook(opts: {
    purchaseId: string;
    status: "ACTIVE" | "VOIDED";
    sequenceTag: string;
    importeTotal?: string;
    exentos?: string;
  }): Promise<string> {
    const id = crypto.randomUUID();
    await prisma.ivaPurchaseBook.create({
      data: {
        id,
        organizationId: testOrgId,
        fiscalPeriodId: testPeriodId,
        purchaseId: opts.purchaseId,
        fechaFactura: new Date("2099-01-15T12:00:00Z"),
        nitProveedor: "9999999",
        razonSocial: "Test Supplier",
        numeroFactura: `pibrnp-${opts.sequenceTag}`,
        codigoAutorizacion: `pibrnp-auth-${opts.sequenceTag}`,
        importeTotal: new Prisma.Decimal(opts.importeTotal ?? "120.00"),
        exentos: new Prisma.Decimal(opts.exentos ?? "0"),
        status: opts.status,
      },
    });
    return id;
  }

  it("recomputeFromPurchase: ACTIVE book + newTotal change — side-effect on row + IvaBookForEntry mapping", async () => {
    // RED honesty preventivo (feedback/red-acceptance-failure-mode):
    // Pre-GREEN: stub retorna null hardcoded SIN delegar a legacy. FAILS
    // este escenario por `expect(result).not.toBeNull()` (línea ~189). El
    // post-check `importeTotal === "113"` también fallaría pero no se
    // alcanza (vitest aborta `it` block en primera falla). Post-GREEN:
    // adapter ejecuta `legacyService.recomputeFromPurchaseCascade(tx, ...)`
    // que muta importeTotal/baseIvaSujetoCf/dfCfIva via `calcTotales`, y
    // luego findFirst+narrow retorna IvaBookForEntry.
    //
    // Discriminantes: pre-set exentos=15.50 (non-zero) para validar
    // preservación across recompute (legacy `recomputeFromPurchaseCascade
    // iva-books.service.ts:640` preserva exentos). Initial baseIvaSujetoCf
    // =0/dfCfIva=0 → post-recompute > 0 confirma side-effect (no chequea
    // valor exacto — eso es legacy responsibility, no del adapter).
    const purchaseId = await seedPurchaseDirect(1);
    await seedIvaPurchaseBook({
      purchaseId,
      status: "ACTIVE",
      sequenceTag: "active",
      importeTotal: "120.00",
      exentos: "15.50",
    });

    const result = await prisma.$transaction(async (tx) => {
      const adapter = new PrismaIvaBookRegenNotifierAdapter(
        tx,
        () => new IvaBooksService(),
      );
      return adapter.recomputeFromPurchase(testOrgId, purchaseId, 113);
    });

    expect(result).not.toBeNull();
    expect(result!.importeTotal).toBe(113);
    expect(result!.exentos).toBe(15.5); // preserved across recompute
    expect(typeof result!.baseIvaSujetoCf).toBe("number");
    expect(typeof result!.dfCfIva).toBe("number");
    expect(result!.baseIvaSujetoCf).toBeGreaterThan(0); // side-effect confirmed
    expect(result!.dfCfIva).toBeGreaterThan(0); // side-effect confirmed

    // Verify post-commit row mutation (legacy recompute side-effect).
    const post = await prisma.ivaPurchaseBook.findUnique({
      where: { purchaseId },
    });
    expect(post!.importeTotal.toString()).toBe("113");
  });

  it("recomputeFromPurchase: no book exists for purchaseId — returns null + no insert side-effect", async () => {
    // RED honesty: stub retorna null hardcoded → PASS coincidente. Legacy
    // recomputeFromPurchaseCascade:628 early-return cuando findFirst null
    // (existing) → adapter findFirst post-call también null → return null.
    // Sin throw, sin insert side-effect. Post-GREEN: mismo comportamiento.
    const arbitraryPurchaseId = "00000000-0000-0000-0000-000000000000";

    const result = await prisma.$transaction(async (tx) => {
      const adapter = new PrismaIvaBookRegenNotifierAdapter(
        tx,
        () => new IvaBooksService(),
      );
      return adapter.recomputeFromPurchase(testOrgId, arbitraryPurchaseId, 200);
    });

    expect(result).toBeNull();

    const count = await prisma.ivaPurchaseBook.count({
      where: { organizationId: testOrgId },
    });
    expect(count).toBe(0);
  });

  it("recomputeFromPurchase: VOIDED book — returns mutated IvaBookForEntry (paridad bit-exact legacy)", async () => {
    // RED honesty preventivo: stub retorna null hardcoded → FAILS por
    // `expect(result).not.toBeNull()`. Post-check `importeTotal === "200"`
    // tampoco se alcanza pre-GREEN (legacy no llamado). Post-GREEN: legacy
    // `recomputeFromPurchaseCascade:624` findFirst SIN status filter →
    // muta VOIDED row → adapter findFirst SIN status filter → narrow
    // retorna IvaBookForEntry del VOIDED row.
    //
    // Decisión Marco lockeo (precedente sale 5c (b) + Ciclo 3
    // getNextSequenceNumber): adapter NO inventa "defensive" filter;
    // legacy bug (mutate VOIDED) se arregla en POC dedicado.
    const purchaseId = await seedPurchaseDirect(2);
    const ivaBookId = await seedIvaPurchaseBook({
      purchaseId,
      status: "VOIDED",
      sequenceTag: "voided",
      importeTotal: "120.00",
    });

    const result = await prisma.$transaction(async (tx) => {
      const adapter = new PrismaIvaBookRegenNotifierAdapter(
        tx,
        () => new IvaBooksService(),
      );
      return adapter.recomputeFromPurchase(testOrgId, purchaseId, 200);
    });

    expect(result).not.toBeNull();
    expect(result!.importeTotal).toBe(200);
    expect(result!.exentos).toBe(0);
    expect(typeof result!.baseIvaSujetoCf).toBe("number");
    expect(typeof result!.dfCfIva).toBe("number");

    // Verify side-effect: legacy mutates VOIDED row directly.
    const post = await prisma.ivaPurchaseBook.findUnique({
      where: { id: ivaBookId },
    });
    expect(post!.importeTotal.toString()).toBe("200");
    expect(post!.status).toBe("VOIDED"); // status orthogonal — recompute does not flip
  });

  it("E1 cycle-break: ctor accepts () => IvaBooksService factory + factory NOT invoked at ctor + invoked on first recomputeFromPurchase call", async () => {
    // RED honesty pre-impl (feedback/red-acceptance-failure-mode): ctor
    // actual exige `IvaBooksService` instance positional; pasar factory
    // function viola signature → TS2345 `Argument of type
    // '() => IvaBooksService' is not assignable to parameter of type
    // 'IvaBooksService'` (compile-time RED locked). Runtime secondary RED:
    // si TS strip lo deja pasar, body delegate intenta
    // `factoryFn.recomputeFromPurchaseCascade(...)` sobre función →
    // TypeError "not a function". Mirror precedent A4-b C1/C2 RED dual-gate
    // compile-time + runtime.
    //
    // Post-GREEN (POC #11.0c A4-c Ciclo 1 cycle-break atómico): ctor
    // signature `(tx, ivaServiceFactory: () => IvaBooksService)`. Body
    // delegate sigue legacy 4-arg `factory().recomputeFromPurchaseCascade(
    // tx, orgId, purchaseId, decimal)` — type todavía LEGACY (con 's');
    // C2 cuts ctor type a hex `IvaBookService` (sin 's') + body delegate
    // hex method (input, scope) + comp-root factory swap a `() =>
    // makeIvaBookService()`. Capas separadas C1↔C2 bisect-friendly per
    // Marco lock granularity D'.
    //
    // Cycle-break rationale: post-C2 cutover `makePurchaseService →
    // makeIvaBookService → makePurchaseService` materializa recursión TDZ;
    // lazy callback rompe el cycle estructuralmente (factory captured at
    // composition, resolved at runtime first method call post-load).
    // Strategy lock Marco Opción α (lazy callback) — single-instance via
    // memoización en iva comp-root, paridad POC #10. Mirror simétrico
    // estricto sale E1.
    const purchaseId = await seedPurchaseDirect(3);
    await seedIvaPurchaseBook({
      purchaseId,
      status: "ACTIVE",
      sequenceTag: "cyclebreak",
      importeTotal: "120.00",
      exentos: "0",
    });

    let factoryInvocations = 0;
    const ivaServiceFactory = (): IvaBooksService => {
      factoryInvocations++;
      return new IvaBooksService();
    };

    const result = await prisma.$transaction(async (tx) => {
      const adapter = new PrismaIvaBookRegenNotifierAdapter(
        tx,
        ivaServiceFactory,
      );
      expect(factoryInvocations).toBe(0); // lazy: NOT invoked at ctor
      const r = await adapter.recomputeFromPurchase(
        testOrgId,
        purchaseId,
        113,
      );
      expect(factoryInvocations).toBe(1); // resolved on first method call
      return r;
    });

    expect(result).not.toBeNull();
    expect(result!.importeTotal).toBe(113);
  });
});
