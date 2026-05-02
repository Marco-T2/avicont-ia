import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { IvaBooksService } from "@/features/accounting/iva-books/iva-books.service";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { IvaBookService } from "@/modules/iva-books/application/iva-book.service";
import type { IvaBookScope } from "@/modules/iva-books/application/iva-book-unit-of-work";
import { __resetForTesting } from "@/modules/iva-books/presentation/composition-root";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

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

/**
 * **POC #11.0c A4-c C3 GREEN cleanup helpers (mirror simétrico sale)**:
 * Test setup wraps legacy `IvaBooksService.recomputeFromPurchaseCascade(tx,
 * ...)` 4-arg call inside hex `IvaBookService.recomputeFromPurchaseCascade(
 * input, scope)` shape — preserva real mutation behavior tests 1+3 sin
 * requerir construcción real de hex con 8 deps.
 */
function buildHexFactoryDelegateLegacy(
  tx: Prisma.TransactionClient,
  legacy: IvaBooksService,
): () => IvaBookService {
  return () =>
    ({
      recomputeFromPurchaseCascade: async (
        input: { organizationId: string; purchaseId: string; newTotal: MonetaryAmount },
        _scope: IvaBookScope,
      ): Promise<void> => {
        await legacy.recomputeFromPurchaseCascade(
          tx,
          input.organizationId,
          input.purchaseId,
          new Prisma.Decimal(input.newTotal.value),
        );
      },
    }) as unknown as IvaBookService;
}

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

describe("PrismaIvaBookRegenNotifierAdapter — Postgres integration", () => {
  let testUserId: string;
  let testOrgId: string;
  let testPeriodId: string;
  let testContactId: string;

  // POC #11.0c A4-c C3 GREEN cleanup integration mirror — `__resetForTesting()`
  // invoca iva root memo reset entre tests (P4 (ii) lockeada Marco).
  beforeEach(() => {
    __resetForTesting();
  });

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
      const legacyService = new IvaBooksService();
      const adapter = new PrismaIvaBookRegenNotifierAdapter(
        tx,
        "test-correlation-c3-cleanup",
        buildHexFactoryDelegateLegacy(tx, legacyService),
        ivaScopeFactory,
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
      const legacyService = new IvaBooksService();
      const adapter = new PrismaIvaBookRegenNotifierAdapter(
        tx,
        "test-correlation-c3-cleanup",
        buildHexFactoryDelegateLegacy(tx, legacyService),
        ivaScopeFactory,
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
      const legacyService = new IvaBooksService();
      const adapter = new PrismaIvaBookRegenNotifierAdapter(
        tx,
        "test-correlation-c3-cleanup",
        buildHexFactoryDelegateLegacy(tx, legacyService),
        ivaScopeFactory,
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
    const legacyService = new IvaBooksService();

    const result = await prisma.$transaction(async (tx) => {
      const ivaServiceFactory = (): IvaBookService => {
        factoryInvocations++;
        return buildHexFactoryDelegateLegacy(tx, legacyService)();
      };
      const adapter = new PrismaIvaBookRegenNotifierAdapter(
        tx,
        "test-correlation-c3-e1-cyclebreak",
        ivaServiceFactory,
        ivaScopeFactory,
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

  it("E2 cutover hex contract: ctor 4-arg + body delega hex IvaBookService.recomputeFromPurchaseCascade(input, scope)", async () => {
    // RED honesty pre-impl (feedback/red-acceptance-failure-mode):
    // Pre-C2 GREEN ctor `(tx, ivaServiceFactory: () => IvaBooksService)`
    // 2-arg legacy. Esta llamada con 4-arg `(tx, correlationId,
    // ivaServiceFactory: () => IvaBookService, ivaScopeFactory)` →
    // **TS2554 primary gate** "Expected 2 arguments, but got 4". Si TS
    // strip lo deja pasar, secondary runtime gate: extra args ignored,
    // body delegate `factoryFn().recomputeFromPurchaseCascade(this.tx,
    // orgId, purchaseId, decimal)` legacy 4-arg shape, pero factory
    // return type es hex `IvaBookService` (sin 's') con method shape
    // `(input, scope)` → mock cascade NO invocado o llamado con args
    // mismatch.
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
    // recomputeFromPurchaseCascade({organizationId, purchaseId, newTotal:
    // MonetaryAmount.of(newTotal)}, scope)` shape (hex contract). Post-
    // call findFirst raw `tx.ivaPurchaseBook.findFirst` + 4-field Number
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
    // imports en purchase infrastructure adapter (§17 preservado).
    //
    // Mirror simétrico estricto sale E2.
    const purchaseId = await seedPurchaseDirect(4);
    await seedIvaPurchaseBook({
      purchaseId,
      status: "ACTIVE",
      sequenceTag: "hex-contract",
      importeTotal: "120.00",
      exentos: "0",
    });

    const cascadeInvocations: Array<{
      input: {
        organizationId: string;
        purchaseId: string;
        newTotal: MonetaryAmount;
      };
      scope: IvaBookScope;
    }> = [];

    const mockHexService = {
      recomputeFromPurchaseCascade: async (
        input: {
          organizationId: string;
          purchaseId: string;
          newTotal: MonetaryAmount;
        },
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

    const correlationId = "test-correlation-c2-e2-purchase";

    const result = await prisma.$transaction(async (tx) => {
      const adapter = new PrismaIvaBookRegenNotifierAdapter(
        tx,
        correlationId,
        ivaServiceFactory,
        ivaScopeFactory,
      );
      return adapter.recomputeFromPurchase(testOrgId, purchaseId, 113);
    });

    // Hex contract assertion: input shape + scope shape
    expect(cascadeInvocations).toHaveLength(1);
    const { input, scope } = cascadeInvocations[0];
    expect(input.organizationId).toBe(testOrgId);
    expect(input.purchaseId).toBe(purchaseId);
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

  it("E3 cleanup integration mirror: __resetForTesting() callable + adapter ctor 4-arg uniform hex shape (forward C3 GREEN cleanup target)", async () => {
    // RED honesty C3 (feedback/red-acceptance-failure-mode):
    // **Primary file-level RED**: 4 callsites legacy 2-arg en este archivo
    // (3 originals recompute ACTIVE/null/VOIDED + 1 E1 cycle-break) — TS2554
    // transient pre-cleanup `Expected 4 arguments, but got 2`. C3 GREEN
    // cleanup uniformly updates → 4-arg hex. **Secondary runtime RED**: 4
    // legacy callsites runtime-fail TypeError (`this.ivaScopeFactory is not
    // a function`) si vitest ejecuta sin TS check (esbuild strip), porque
    // legacy passes factory at slot 2 (correlationId in NEW shape).
    //
    // **Tertiary E3 self**: usa NEW 4-arg shape POST-C2 GREEN (a515636) —
    // E3 self pasa como SEED documenting cleanup target. RED honesty
    // declarada via file-level transients pending GREEN, NO via E3 self
    // failure.
    //
    // **`__resetForTesting()` integration**: validates iva root memo reset
    // hook callable from this test context (P4 (ii) lockeada Marco). C3
    // GREEN cleanup adds `beforeEach(() => __resetForTesting())` para
    // test isolation.
    //
    // Mirror simétrico estricto sale E3.
    __resetForTesting();
    expect(typeof __resetForTesting).toBe("function");

    const purchaseId = await seedPurchaseDirect(5);
    await seedIvaPurchaseBook({
      purchaseId,
      status: "ACTIVE",
      sequenceTag: "cleanup-target",
      importeTotal: "120.00",
      exentos: "0",
    });

    const mockHexService = {
      recomputeFromPurchaseCascade: async (
        _input: unknown,
        _scope: IvaBookScope,
      ): Promise<void> => {},
    } as unknown as IvaBookService;

    const mockScopeFactory = (
      _tx: Prisma.TransactionClient,
      correlationId: string,
    ): IvaBookScope =>
      ({
        correlationId,
        fiscalPeriods: undefined as never,
        ivaSalesBooks: undefined as never,
        ivaPurchaseBooks: undefined as never,
      }) as unknown as IvaBookScope;

    // Smoke cleanup target: 4-arg ctor hex shape uniform en file (post-C3
    // GREEN cleanup). Pre-cleanup: 4 callsites legacy 2-arg coexisten con
    // este E3 4-arg en mismo file → file inconsistency cleanup-pending.
    const result = await prisma.$transaction(async (tx) => {
      const adapter = new PrismaIvaBookRegenNotifierAdapter(
        tx,
        "test-correlation-c3-e3-purchase",
        () => mockHexService,
        mockScopeFactory,
      );
      expect(adapter).toBeInstanceOf(PrismaIvaBookRegenNotifierAdapter);
      return adapter.recomputeFromPurchase(testOrgId, purchaseId, 113);
    });

    expect(result).not.toBeNull();
    expect(result!.importeTotal).toBe(120); // pre-seeded (mock no-op)
  });
});
