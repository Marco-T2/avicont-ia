import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { IvaBooksService } from "@/features/accounting/iva-books/iva-books.service";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { IvaBookService } from "@/modules/iva-books/application/iva-book.service";
import type { IvaBookScope } from "@/modules/iva-books/application/iva-book-unit-of-work";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

import { PrismaIvaBookRegenNotifierAdapter } from "../prisma-iva-book-regen-notifier.adapter";

/**
 * Postgres-real integration test for PrismaIvaBookRegenNotifierAdapter
 * (POC #11.0a A3 Ciclo 5c). Tx-bound write port: adapter recibe
 * `Prisma.TransactionClient` por c2 DI vía SaleScope (Ciclo 4 D-2) +
 * `IvaBooksService` legacy para delegar `recomputeFromSaleCascade`.
 *
 * §13 emergente E-5.b locked Marco: Opción β híbrida tx-aware. Drift
 * contract real — port `recomputeFromSale` retorna `IvaBookForEntry | null`,
 * legacy `recomputeFromSaleCascade` retorna void. Adapter ejecuta legacy
 * call (side-effect Decimal mutation in-tx) + post-call
 * `tx.ivaSalesBook.findFirst({where:{saleId, organizationId}})` y narrow al
 * shape `IvaBookForEntry` (4 fields, mirror `extractIvaBookForEntry:132-137`).
 *
 * Post-call findFirst SIN status filter — paridad bit-exact con legacy
 * `recomputeFromSaleCascade:565` (POC #11.0a A5 β Ciclo 1, decisión Marco
 * (b) alinear paridad).
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
        clerkUserId: `pibrn-test-clerk-user-${stamp}`,
        email: `pibrn-test-${stamp}@test.local`,
        name: "PrismaIvaBookRegenNotifierAdapter Integration Test User",
      },
    });
    testUserId = user.id;

    const org = await prisma.organization.create({
      data: {
        clerkOrgId: `pibrn-test-clerk-org-${stamp}`,
        name: `PrismaIvaBookRegenNotifierAdapter Integration Test Org ${stamp}`,
        slug: `pibrn-test-org-${stamp}`,
      },
    });
    testOrgId = org.id;

    const period = await prisma.fiscalPeriod.create({
      data: {
        organizationId: testOrgId,
        name: "pibrn-integration-period",
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
        description: "pibrn seeded sale",
        totalAmount: new Prisma.Decimal("120.00"),
        createdById: testUserId,
      },
    });
    return id;
  }

  async function seedIvaSalesBook(opts: {
    saleId: string;
    status: "ACTIVE" | "VOIDED";
    sequenceTag: string;
    importeTotal?: string;
    exentos?: string;
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
        numeroFactura: `pibrn-${opts.sequenceTag}`,
        codigoAutorizacion: `pibrn-auth-${opts.sequenceTag}`,
        importeTotal: new Prisma.Decimal(opts.importeTotal ?? "120.00"),
        exentos: new Prisma.Decimal(opts.exentos ?? "0"),
        estadoSIN: "V",
        status: opts.status,
      },
    });
    return id;
  }

  it("recomputeFromSale: ACTIVE book + newTotal change — side-effect on row + IvaBookForEntry mapping", async () => {
    // RED honesty preventivo: FAILS pre-implementación por module resolution
    // failure (`PrismaIvaBookRegenNotifierAdapter` no existe). Post-GREEN:
    // PASSES porque adapter ejecuta `legacyService.recomputeFromSaleCascade
    // (tx, ...)` que muta importeTotal/baseIvaSujetoCf/dfCfIva via
    // `calcTotales`, y luego findFirst+narrow retorna IvaBookForEntry.
    //
    // Discriminantes: pre-set exentos=15.50 (non-zero) para validar
    // preservación across recompute (legacy `recomputeFromSaleCascade:582`
    // preserva exentos). Initial baseIvaSujetoCf=0/dfCfIva=0 → post-recompute
    // > 0 confirma side-effect (no chequea valor exacto — eso es legacy
    // responsibility, no del adapter).
    const saleId = await seedSaleDirect(1);
    await seedIvaSalesBook({
      saleId,
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
      return adapter.recomputeFromSale(testOrgId, saleId, 113);
    });

    expect(result).not.toBeNull();
    expect(result!.importeTotal).toBe(113);
    expect(result!.exentos).toBe(15.5); // preserved across recompute
    expect(typeof result!.baseIvaSujetoCf).toBe("number");
    expect(typeof result!.dfCfIva).toBe("number");
    expect(result!.baseIvaSujetoCf).toBeGreaterThan(0); // side-effect confirmed
    expect(result!.dfCfIva).toBeGreaterThan(0); // side-effect confirmed

    // Verify post-commit row mutation (legacy recompute side-effect).
    const post = await prisma.ivaSalesBook.findUnique({
      where: { saleId },
    });
    expect(post!.importeTotal.toString()).toBe("113");
  });

  it("recomputeFromSale: no book exists for saleId — returns null + no insert side-effect", async () => {
    // RED honesty: FAILS pre-implementación por module resolution failure.
    // Post-GREEN: legacy recomputeFromSaleCascade:569 early-return cuando
    // findFirst null → adapter findFirst post-call también null → return null.
    // Sin throw, sin insert side-effect.
    const arbitrarySaleId = "00000000-0000-0000-0000-000000000000";

    const result = await prisma.$transaction(async (tx) => {
      const adapter = new PrismaIvaBookRegenNotifierAdapter(
        tx,
        () => new IvaBooksService(),
      );
      return adapter.recomputeFromSale(testOrgId, arbitrarySaleId, 200);
    });

    expect(result).toBeNull();

    const count = await prisma.ivaSalesBook.count({
      where: { organizationId: testOrgId },
    });
    expect(count).toBe(0);
  });

  it("recomputeFromSale: VOIDED book — returns mutated IvaBookForEntry (paridad bit-exact legacy)", async () => {
    // RED honesty preventivo: FAILS pre-fix porque adapter filtra
    // `status: "ACTIVE"` post-call → retorna null sobre VOIDED row aunque
    // legacy lo mute. Post-GREEN: drop filter → adapter retorna
    // `IvaBookForEntry` del VOIDED row mutado por legacy
    // `recomputeFromSaleCascade:565` (SIN filter status).
    //
    // Decisión Marco lockeo (b) alinear paridad bit-exact: adapter NO
    // inventa "defensive" filter; legacy bug (mutate VOIDED) se arregla
    // en POC dedicado, no via mejora unilateral. Precedente Ciclo 3
    // getNextSequenceNumber.
    const saleId = await seedSaleDirect(2);
    const ivaBookId = await seedIvaSalesBook({
      saleId,
      status: "VOIDED",
      sequenceTag: "voided",
      importeTotal: "120.00",
    });

    const result = await prisma.$transaction(async (tx) => {
      const adapter = new PrismaIvaBookRegenNotifierAdapter(
        tx,
        () => new IvaBooksService(),
      );
      return adapter.recomputeFromSale(testOrgId, saleId, 200);
    });

    expect(result).not.toBeNull();
    expect(result!.importeTotal).toBe(200);
    expect(result!.exentos).toBe(0);
    expect(typeof result!.baseIvaSujetoCf).toBe("number");
    expect(typeof result!.dfCfIva).toBe("number");

    // Verify side-effect: legacy mutates VOIDED row directly.
    const post = await prisma.ivaSalesBook.findUnique({
      where: { id: ivaBookId },
    });
    expect(post!.importeTotal.toString()).toBe("200");
    expect(post!.status).toBe("VOIDED"); // status orthogonal — recompute does not flip
  });

  it("E1 cycle-break: ctor accepts () => IvaBooksService factory + factory NOT invoked at ctor + invoked on first recomputeFromSale call", async () => {
    // RED honesty pre-impl (feedback/red-acceptance-failure-mode): ctor
    // actual exige `IvaBooksService` instance positional; pasar factory
    // function viola signature → TS2345 `Argument of type
    // '() => IvaBooksService' is not assignable to parameter of type
    // 'IvaBooksService'` (compile-time RED locked). Runtime secondary RED:
    // si TS strip lo deja pasar, body delegate intenta
    // `factoryFn.recomputeFromSaleCascade(...)` sobre función → TypeError
    // "not a function". Mirror precedent A4-b C1/C2 RED dual-gate
    // compile-time + runtime.
    //
    // Post-GREEN (POC #11.0c A4-c Ciclo 1 cycle-break atómico): ctor
    // signature `(tx, ivaServiceFactory: () => IvaBooksService)`. Body
    // delegate sigue legacy 4-arg `factory().recomputeFromSaleCascade(tx,
    // orgId, saleId, decimal)` — type todavía LEGACY (con 's'); C2 cuts
    // ctor type a hex `IvaBookService` (sin 's') + body delegate hex
    // method (input, scope) + comp-root factory swap a `() =>
    // makeIvaBookService()`. Capas separadas C1↔C2 bisect-friendly per
    // Marco lock granularity D'.
    //
    // Cycle-break rationale: post-C2 cutover `makeSaleService →
    // makeIvaBookService → makeSaleService` materializa recursión TDZ;
    // lazy callback rompe el cycle estructuralmente (factory captured at
    // composition, resolved at runtime first method call post-load).
    // Strategy lock Marco Opción α (lazy callback) — single-instance via
    // memoización en iva comp-root, paridad POC #10. Mirror simétrico
    // estricto purchase E1.
    const saleId = await seedSaleDirect(3);
    await seedIvaSalesBook({
      saleId,
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
      const r = await adapter.recomputeFromSale(testOrgId, saleId, 113);
      expect(factoryInvocations).toBe(1); // resolved on first method call
      return r;
    });

    expect(result).not.toBeNull();
    expect(result!.importeTotal).toBe(113);
  });

  it("E2 cutover hex contract: ctor 4-arg + body delega hex IvaBookService.recomputeFromSaleCascade(input, scope)", async () => {
    // RED honesty pre-impl (feedback/red-acceptance-failure-mode):
    // Pre-C2 GREEN ctor `(tx, ivaServiceFactory: () => IvaBooksService)`
    // 2-arg legacy. Esta llamada con 4-arg `(tx, correlationId,
    // ivaServiceFactory: () => IvaBookService, ivaScopeFactory)` →
    // **TS2554 primary gate** "Expected 2 arguments, but got 4". Si TS
    // strip lo deja pasar, secondary runtime gate: extra args ignored,
    // body delegate `factoryFn().recomputeFromSaleCascade(this.tx,
    // orgId, saleId, decimal)` legacy 4-arg shape, pero factory return
    // type es hex `IvaBookService` (sin 's') con method shape `(input,
    // scope)` → mock cascade NO invocado o llamado con args mismatch.
    //
    // **TS2345 tertiary gate**: param 2 type `() => IvaBookService` (hex,
    // sin 's') no asignable a `() => IvaBooksService` (legacy, con 's')
    // — incompatible class types. TS reporta primary TS2554 antes pero
    // gate documentado.
    //
    // Mirror precedent A4-c C1 E1 RED dual-gate compile-time + runtime.
    //
    // Post-C2 GREEN: ctor `(tx, correlationId: string, ivaServiceFactory:
    // () => IvaBookService, ivaScopeFactory: (tx, correlationId) =>
    // IvaBookScope)`. Body invoca `ivaServiceFactory().
    // recomputeFromSaleCascade({organizationId, saleId, newTotal:
    // MonetaryAmount.of(newTotal)}, scope)` shape (hex contract). Post-
    // call findFirst raw `tx.ivaSalesBook.findFirst` + 4-field Number
    // narrow preservado (P2 (α) lock — paridad bit-exact legacy minimal
    // blast radius).
    //
    // Cycle-break heredado C1 (factory shape) preservado; C2 cuts type
    // legacy → hex + delegate legacy 4-arg → hex (input, scope). Capas
    // separadas C1↔C2 bisect-friendly per Marco lock granularity D'.
    //
    // P1 (b) scopeFactory injection lockeada Marco: closure construido
    // por iva root (`makeIvaScopeFactory`) cierra sobre prisma adapters
    // iva-side (PrismaFiscalPeriodsTxRepo + PrismaIvaSalesBookEntryRepo
    // + PrismaIvaPurchaseBookEntryRepo). CERO cross-module concrete
    // imports en sale infrastructure adapter (§17 preservado).
    //
    // Mirror simétrico estricto purchase E2.
    const saleId = await seedSaleDirect(4);
    await seedIvaSalesBook({
      saleId,
      status: "ACTIVE",
      sequenceTag: "hex-contract",
      importeTotal: "120.00",
      exentos: "0",
    });

    const cascadeInvocations: Array<{
      input: { organizationId: string; saleId: string; newTotal: MonetaryAmount };
      scope: IvaBookScope;
    }> = [];

    const mockHexService = {
      recomputeFromSaleCascade: async (
        input: { organizationId: string; saleId: string; newTotal: MonetaryAmount },
        scope: IvaBookScope,
      ): Promise<void> => {
        cascadeInvocations.push({ input, scope });
      },
    } as unknown as IvaBookService;

    const ivaServiceFactory = (): IvaBookService => mockHexService;

    const ivaScopeFactory = (
      _tx: Prisma.TransactionClient,
      correlationId: string,
    ): IvaBookScope =>
      ({
        correlationId,
        fiscalPeriods: undefined as never,
        ivaSalesBooks: undefined as never,
        ivaPurchaseBooks: undefined as never,
      }) as unknown as IvaBookScope;

    const correlationId = "test-correlation-c2-e2-sale";

    const result = await prisma.$transaction(async (tx) => {
      const adapter = new PrismaIvaBookRegenNotifierAdapter(
        tx,
        correlationId,
        ivaServiceFactory,
        ivaScopeFactory,
      );
      return adapter.recomputeFromSale(testOrgId, saleId, 113);
    });

    // Hex contract assertion: input shape + scope shape
    expect(cascadeInvocations).toHaveLength(1);
    const { input, scope } = cascadeInvocations[0];
    expect(input.organizationId).toBe(testOrgId);
    expect(input.saleId).toBe(saleId);
    expect(input.newTotal).toBeInstanceOf(MonetaryAmount);
    expect(input.newTotal.value).toBe(113);
    expect(scope.correlationId).toBe(correlationId);

    // P2 (α) post-call findFirst preserved — hex mocked, row unchanged
    expect(result).not.toBeNull();
    expect(result!.importeTotal).toBe(120); // pre-seeded value (mock no-op)
    expect(result!.exentos).toBe(0);
    expect(typeof result!.baseIvaSujetoCf).toBe("number");
    expect(typeof result!.dfCfIva).toBe("number");
  });
});
