import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

import { TASA_IVA } from "../../domain/compute-iva-totals";
import { IvaPurchaseBookEntry } from "../../domain/iva-purchase-book-entry.entity";
import type { IvaPurchaseBookEntryInputs } from "../../domain/iva-purchase-book-entry.entity";
import { IvaCalcResult } from "../../domain/value-objects/iva-calc-result";

import { PrismaIvaPurchaseBookEntryRepo } from "../prisma-iva-purchase-book-entry.repo";

/**
 * Postgres-real integration test for PrismaIvaPurchaseBookEntryRepo (POC
 * #11.0c A3 C3 RED Round 1). Mirror simétrico de
 * `prisma-iva-sales-book-entry.repo.integration.test.ts` con `IvaPurchaseBook`
 * en lugar de `IvaSalesBook`.
 *
 * Adapter contract (`iva-purchase-book-entry-repository.port.ts`): 4 tx-aware
 * methods (findByIdTx + findByPurchaseIdTx + saveTx + updateTx). Hydration
 * full (12 Decimal → MonetaryAmount × 12 + IvaCalcResult VO reconstruct +
 * tipoCompra raw int + status VO + header pass-through). Persist legacy
 * parity: `dfIva = entry.calcResult.ivaAmount.value` y `tasaIva = TASA_IVA
 * = 0.13` (mirror legacy `iva-books.service.ts:63-64` fidelidad regla #1).
 *
 * Diffs vs C2:
 * - `nitProveedor` (no `nitCliente`)
 * - `tipoCompra: number` raw int (no `estadoSIN` VO)
 * - Contact tipo PROVEEDOR (no CLIENTE)
 * - `findByPurchaseIdTx` (no `findBySaleIdTx`); `seedPurchase` con
 *   `purchaseType: "COMPRA_GENERAL"` (no `seedSale`).
 *
 * RED honesty preventivo (`feedback/red-acceptance-failure-mode`): TODOS los
 * `it()` FAIL pre-implementación por module resolution failure
 * (`PrismaIvaPurchaseBookEntryRepo` no existe en `infrastructure/`).
 * Post-GREEN: PASSES cuando el repo delega a Prisma con tenancy guard inline
 * + helpers locales `hydrateFromRow` + `toCreateInput` + `toUpdateData`
 * (mirror A1 + C2 inline pattern).
 */

describe("PrismaIvaPurchaseBookEntryRepo — Postgres integration", () => {
  let testUserId: string;
  let testOrgId: string;
  let testOtherOrgId: string;
  let testPeriodId: string;
  let testOtherPeriodId: string;
  let testContactId: string;
  let testOtherContactId: string;

  beforeAll(async () => {
    const stamp = Date.now();

    const user = await prisma.user.create({
      data: {
        clerkUserId: `pipb-test-clerk-user-${stamp}`,
        email: `pipb-test-${stamp}@test.local`,
        name: "PrismaIvaPurchaseBookEntryRepo Integration Test User",
      },
    });
    testUserId = user.id;

    const org = await prisma.organization.create({
      data: {
        clerkOrgId: `pipb-test-clerk-org-${stamp}`,
        name: `PrismaIvaPurchaseBookEntryRepo Integration Test Org ${stamp}`,
        slug: `pipb-test-org-${stamp}`,
      },
    });
    testOrgId = org.id;

    const otherOrg = await prisma.organization.create({
      data: {
        clerkOrgId: `pipb-test-clerk-other-org-${stamp}`,
        name: `PrismaIvaPurchaseBookEntryRepo Other Org ${stamp}`,
        slug: `pipb-test-other-org-${stamp}`,
      },
    });
    testOtherOrgId = otherOrg.id;

    const period = await prisma.fiscalPeriod.create({
      data: {
        organizationId: testOrgId,
        name: "pipb-integration-period",
        year: 2099,
        month: 1,
        startDate: new Date("2099-01-01T00:00:00Z"),
        endDate: new Date("2099-01-31T23:59:59Z"),
        createdById: testUserId,
      },
    });
    testPeriodId = period.id;

    const otherPeriod = await prisma.fiscalPeriod.create({
      data: {
        organizationId: testOtherOrgId,
        name: "pipb-integration-other-period",
        year: 2099,
        month: 1,
        startDate: new Date("2099-01-01T00:00:00Z"),
        endDate: new Date("2099-01-31T23:59:59Z"),
        createdById: testUserId,
      },
    });
    testOtherPeriodId = otherPeriod.id;

    const contact = await prisma.contact.create({
      data: {
        organizationId: testOrgId,
        name: "Test Provider",
        type: "PROVEEDOR",
        nit: "7654321",
      },
    });
    testContactId = contact.id;

    const otherContact = await prisma.contact.create({
      data: {
        organizationId: testOtherOrgId,
        name: "Other Provider",
        type: "PROVEEDOR",
        nit: "1234567",
      },
    });
    testOtherContactId = otherContact.id;
  });

  afterEach(async () => {
    await prisma.ivaPurchaseBook.deleteMany({
      where: { organizationId: { in: [testOrgId, testOtherOrgId] } },
    });
    await prisma.purchase.deleteMany({
      where: { organizationId: { in: [testOrgId, testOtherOrgId] } },
    });
  });

  afterAll(async () => {
    await prisma.ivaPurchaseBook.deleteMany({
      where: { organizationId: { in: [testOrgId, testOtherOrgId] } },
    });
    await prisma.purchase.deleteMany({
      where: { organizationId: { in: [testOrgId, testOtherOrgId] } },
    });
    await prisma.contact.delete({ where: { id: testContactId } });
    await prisma.contact.delete({ where: { id: testOtherContactId } });
    await prisma.fiscalPeriod.delete({ where: { id: testPeriodId } });
    await prisma.fiscalPeriod.delete({ where: { id: testOtherPeriodId } });
    await prisma.auditLog.deleteMany({
      where: { organizationId: { in: [testOrgId, testOtherOrgId] } },
    });
    await prisma.organization.delete({ where: { id: testOrgId } });
    await prisma.organization.delete({ where: { id: testOtherOrgId } });
    await prisma.user.delete({ where: { id: testUserId } });
  });

  function buildInputs(): IvaPurchaseBookEntryInputs {
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

  function buildEntry(opts?: {
    organizationId?: string;
    fiscalPeriodId?: string;
    purchaseId?: string;
    numeroFactura?: string;
    codigoAutorizacion?: string;
    notes?: string | null;
  }): IvaPurchaseBookEntry {
    const stamp = Math.random().toString(36).slice(2, 10);
    return IvaPurchaseBookEntry.create({
      organizationId: opts?.organizationId ?? testOrgId,
      fiscalPeriodId: opts?.fiscalPeriodId ?? testPeriodId,
      purchaseId: opts?.purchaseId,
      fechaFactura: new Date("2099-01-15T12:00:00Z"),
      nitProveedor: "7654321",
      razonSocial: "Test Provider",
      numeroFactura: opts?.numeroFactura ?? `F-${stamp}`,
      codigoAutorizacion: opts?.codigoAutorizacion ?? `AUTH-${stamp}`,
      codigoControl: "CC-001",
      tipoCompra: 1,
      notes: opts?.notes ?? null,
      inputs: buildInputs(),
      calcResult: buildCalcResult(),
    });
  }

  async function seedRowDirect(opts?: {
    organizationId?: string;
    fiscalPeriodId?: string;
    purchaseId?: string;
    numeroFactura?: string;
    codigoAutorizacion?: string;
    status?: "ACTIVE" | "VOIDED";
    notes?: string | null;
  }): Promise<string> {
    const id = crypto.randomUUID();
    const stamp = Math.random().toString(36).slice(2, 10);
    await prisma.ivaPurchaseBook.create({
      data: {
        id,
        organizationId: opts?.organizationId ?? testOrgId,
        fiscalPeriodId: opts?.fiscalPeriodId ?? testPeriodId,
        purchaseId: opts?.purchaseId,
        fechaFactura: new Date("2099-01-15T12:00:00Z"),
        nitProveedor: "7654321",
        razonSocial: "Test Provider",
        numeroFactura: opts?.numeroFactura ?? `F-${stamp}`,
        codigoAutorizacion: opts?.codigoAutorizacion ?? `AUTH-${stamp}`,
        codigoControl: "CC-001",
        importeTotal: new Prisma.Decimal("100.00"),
        importeIce: new Prisma.Decimal(0),
        importeIehd: new Prisma.Decimal(0),
        importeIpj: new Prisma.Decimal(0),
        tasas: new Prisma.Decimal(0),
        otrosNoSujetos: new Prisma.Decimal(0),
        exentos: new Prisma.Decimal(0),
        tasaCero: new Prisma.Decimal(0),
        subtotal: new Prisma.Decimal("100.00"),
        dfIva: new Prisma.Decimal("13.00"),
        codigoDescuentoAdicional: new Prisma.Decimal(0),
        importeGiftCard: new Prisma.Decimal(0),
        baseIvaSujetoCf: new Prisma.Decimal("100.00"),
        dfCfIva: new Prisma.Decimal("13.00"),
        tasaIva: new Prisma.Decimal("0.1300"),
        tipoCompra: 1,
        status: opts?.status ?? "ACTIVE",
        notes: opts?.notes ?? null,
      },
    });
    return id;
  }

  async function seedPurchase(opts?: {
    organizationId?: string;
    contactId?: string;
    periodId?: string;
    sequenceNumber?: number;
  }): Promise<string> {
    const id = crypto.randomUUID();
    await prisma.purchase.create({
      data: {
        id,
        organizationId: opts?.organizationId ?? testOrgId,
        purchaseType: "COMPRA_GENERAL",
        status: "POSTED",
        sequenceNumber: opts?.sequenceNumber ?? Math.floor(Math.random() * 1_000_000),
        date: new Date("2099-01-15T12:00:00Z"),
        contactId: opts?.contactId ?? testContactId,
        periodId: opts?.periodId ?? testPeriodId,
        description: "pipb seeded purchase",
        totalAmount: new Prisma.Decimal("100.00"),
        createdById: testUserId,
      },
    });
    return id;
  }

  describe("findByIdTx", () => {
    it("existing entry — returns full hydrated IvaPurchaseBookEntry (12 monetary + IvaCalcResult VO + tipoCompra raw int + status VO + header)", async () => {
      // RED honesty preventivo: FAILS pre-implementación por module
      // resolution failure (`PrismaIvaPurchaseBookEntryRepo` no existe).
      // Post-GREEN: hydrateFromRow construye props con MonetaryAmount.of()
      // sobre 12 Decimals + parseIvaBookStatus + tipoCompra raw int +
      // IvaCalcResult.of() reconstruct desde subtotal + baseIvaSujetoCf
      // (rename) + dfCfIva (rename). Discriminantes elegidos: subtotal=100,
      // baseImponible=100, ivaAmount=13 (detectaría rename cruzado o coerce).
      const id = await seedRowDirect({});
      const repo = new PrismaIvaPurchaseBookEntryRepo(prisma);

      const result = await repo.findByIdTx(testOrgId, id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(id);
      expect(result!.organizationId).toBe(testOrgId);
      expect(result!.fiscalPeriodId).toBe(testPeriodId);
      expect(result!.tipoCompra).toBe(1);
      expect(result!.status).toBe("ACTIVE");
      expect(result!.inputs.importeTotal.value).toBe(100);
      expect(result!.calcResult.subtotal.value).toBe(100);
      expect(result!.calcResult.baseImponible.value).toBe(100);
      expect(result!.calcResult.ivaAmount.value).toBe(13);
    });

    it("non-existent id — returns null", async () => {
      // RED honesty: FAILS pre-implementación por module resolution failure.
      // Post-GREEN: `findFirst({where:{id, organizationId}})` → null.
      const repo = new PrismaIvaPurchaseBookEntryRepo(prisma);

      const result = await repo.findByIdTx(
        testOrgId,
        "00000000-0000-0000-0000-000000000000",
      );

      expect(result).toBeNull();
    });

    it("cross-org tenancy guard — entry exists in other org returns null", async () => {
      // RED honesty: FAILS pre-implementación por module resolution failure.
      // Post-GREEN: where clause `{ id, organizationId }` filtra por
      // organizationId mismatch → null. Mirror A1 purchase-hex tenancy
      // pattern.
      const id = await seedRowDirect({
        organizationId: testOtherOrgId,
        fiscalPeriodId: testOtherPeriodId,
      });
      const repo = new PrismaIvaPurchaseBookEntryRepo(prisma);

      const result = await repo.findByIdTx(testOrgId, id);

      expect(result).toBeNull();
    });
  });

  describe("findByPurchaseIdTx", () => {
    it("existing entry by purchaseId — returns hydrated entry", async () => {
      // RED honesty: FAILS pre-implementación por module resolution failure.
      // Post-GREEN: `findFirst({where:{purchaseId, organizationId}})` → row
      // + hydrate. purchaseId @unique global asegura 1 row máximo.
      const purchaseId = await seedPurchase({});
      const id = await seedRowDirect({ purchaseId });
      const repo = new PrismaIvaPurchaseBookEntryRepo(prisma);

      const result = await repo.findByPurchaseIdTx(testOrgId, purchaseId);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(id);
      expect(result!.purchaseId).toBe(purchaseId);
    });

    it("non-existent purchaseId — returns null", async () => {
      // RED honesty: FAILS pre-implementación por module resolution failure.
      const repo = new PrismaIvaPurchaseBookEntryRepo(prisma);

      const result = await repo.findByPurchaseIdTx(
        testOrgId,
        "00000000-0000-0000-0000-000000000000",
      );

      expect(result).toBeNull();
    });

    it("cross-org tenancy guard — entry exists in other org by purchaseId returns null", async () => {
      // RED honesty: FAILS pre-implementación por module resolution failure.
      // Post-GREEN: tenancy guard inline filtra por organizationId mismatch
      // aunque purchaseId exista globalmente.
      const purchaseId = await seedPurchase({
        organizationId: testOtherOrgId,
        contactId: testOtherContactId,
        periodId: testOtherPeriodId,
      });
      await seedRowDirect({
        organizationId: testOtherOrgId,
        fiscalPeriodId: testOtherPeriodId,
        purchaseId,
      });
      const repo = new PrismaIvaPurchaseBookEntryRepo(prisma);

      const result = await repo.findByPurchaseIdTx(testOrgId, purchaseId);

      expect(result).toBeNull();
    });
  });

  describe("saveTx", () => {
    it("persists fresh entity — row in DB matches entity bit-exact (12 monetary inputs + calcResult + header + status)", async () => {
      // RED honesty: FAILS pre-implementación por module resolution failure.
      // Post-GREEN: `toCreateInput` flatten relations + Decimal × 14 +
      // tipoCompra int + status ACTIVE default + notes pass-through.
      // Discriminantes: importeTotal=100, ivaAmount=13, codigoControl="CC-001"
      // (string distinct).
      const entry = buildEntry({});
      const repo = new PrismaIvaPurchaseBookEntryRepo(prisma);

      await repo.saveTx(entry);

      const row = await prisma.ivaPurchaseBook.findUnique({
        where: { id: entry.id },
      });
      expect(row).not.toBeNull();
      expect(row!.organizationId).toBe(testOrgId);
      expect(row!.fiscalPeriodId).toBe(testPeriodId);
      expect(row!.codigoControl).toBe("CC-001");
      expect(row!.tipoCompra).toBe(1);
      expect(row!.status).toBe("ACTIVE");
      expect(Number(row!.importeTotal)).toBe(100);
      expect(Number(row!.subtotal)).toBe(100);
      expect(Number(row!.baseIvaSujetoCf)).toBe(100);
      expect(Number(row!.dfCfIva)).toBe(13);
    });

    it("dfIva persisted = ivaAmount value (legacy parity)", async () => {
      // RED honesty: FAILS pre-implementación por module resolution failure.
      // Post-GREEN: `toCreateInput` setea `dfIva: entry.calcResult.ivaAmount.value`
      // (mirror legacy `iva-books.service.ts:63`). Discriminante: ivaAmount=13
      // → row.dfIva=13. Detectaría coerce a 0 o duplicar dfCfIva con valor
      // distinto.
      const entry = buildEntry({});
      const repo = new PrismaIvaPurchaseBookEntryRepo(prisma);

      await repo.saveTx(entry);

      const row = await prisma.ivaPurchaseBook.findUnique({
        where: { id: entry.id },
      });
      expect(row).not.toBeNull();
      expect(Number(row!.dfIva)).toBe(13);
      expect(Number(row!.dfIva)).toBe(entry.calcResult.ivaAmount.value);
    });

    it("tasaIva persisted = TASA_IVA constant 0.13 (legacy parity)", async () => {
      // RED honesty: FAILS pre-implementación por module resolution failure.
      // Post-GREEN: `toCreateInput` setea `tasaIva: TASA_IVA` (constante
      // exportada desde domain/compute-iva-totals.ts:24, mirror legacy
      // `iva-books.service.ts:64`). Detectaría coerce a 0 o derive ratio.
      const entry = buildEntry({});
      const repo = new PrismaIvaPurchaseBookEntryRepo(prisma);

      await repo.saveTx(entry);

      const row = await prisma.ivaPurchaseBook.findUnique({
        where: { id: entry.id },
      });
      expect(row).not.toBeNull();
      expect(Number(row!.tasaIva)).toBe(TASA_IVA);
      expect(Number(row!.tasaIva)).toBe(0.13);
    });

    it("round-trip — saveTx then findByIdTx returns equivalent entity (full hydration parity)", async () => {
      // RED honesty: FAILS pre-implementación por module resolution failure.
      // Post-GREEN: persist + hydrate pipeline bit-exact. IvaCalcResult.equals
      // comparison cubre los 3 fields del VO. Detectaría drift en cualquier
      // dirección del round-trip. tipoCompra raw int round-trip sin VO.
      const entry = buildEntry({ notes: "round-trip-test" });
      const repo = new PrismaIvaPurchaseBookEntryRepo(prisma);

      await repo.saveTx(entry);
      const retrieved = await repo.findByIdTx(testOrgId, entry.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(entry.id);
      expect(retrieved!.tipoCompra).toBe(entry.tipoCompra);
      expect(retrieved!.status).toBe(entry.status);
      expect(retrieved!.notes).toBe("round-trip-test");
      expect(retrieved!.calcResult.equals(entry.calcResult)).toBe(true);
      expect(
        retrieved!.inputs.importeTotal.equals(entry.inputs.importeTotal),
      ).toBe(true);
    });
  });

  describe("updateTx", () => {
    it("status VOIDED transition — row.status becomes 'VOIDED' after entry.void() + updateTx", async () => {
      // RED honesty: FAILS pre-implementación por module resolution failure.
      // Post-GREEN: `toUpdateData` propaga entry.status → row. entry.void()
      // muta status ACTIVE→VOIDED + updatedAt. Mirror A1 PrismaPurchaseRepository
      // updateTx all-mutables pattern.
      const entry = buildEntry({});
      const repo = new PrismaIvaPurchaseBookEntryRepo(prisma);
      await repo.saveTx(entry);

      const voided = entry.void();
      await repo.updateTx(voided);

      const row = await prisma.ivaPurchaseBook.findUnique({
        where: { id: entry.id },
      });
      expect(row).not.toBeNull();
      expect(row!.status).toBe("VOIDED");
    });

    it("applyEdit notes — row.notes mutates after entry.applyEdit({notes}) + updateTx", async () => {
      // RED honesty: FAILS pre-implementación por module resolution failure.
      // Post-GREEN: applyEdit produce entry con notes mutated; updateTx
      // propaga al row. Discriminante: from null → "edited-note" (detectaría
      // notes silently dropped por updateTx).
      const entry = buildEntry({ notes: null });
      const repo = new PrismaIvaPurchaseBookEntryRepo(prisma);
      await repo.saveTx(entry);

      const edited = entry.applyEdit({ notes: "edited-note" });
      await repo.updateTx(edited);

      const row = await prisma.ivaPurchaseBook.findUnique({
        where: { id: entry.id },
      });
      expect(row).not.toBeNull();
      expect(row!.notes).toBe("edited-note");
    });

    it("updatedAt advances on update — row.updatedAt > entry.updatedAt original", async () => {
      // RED honesty: FAILS pre-implementación por module resolution failure.
      // Post-GREEN: Prisma `@updatedAt` driver-level avanza el timestamp
      // automáticamente (no manual). Detectaría updateTx que NO emite update
      // (e.g. early-return en no-op).
      const entry = buildEntry({});
      const repo = new PrismaIvaPurchaseBookEntryRepo(prisma);
      await repo.saveTx(entry);

      const originalRow = await prisma.ivaPurchaseBook.findUnique({
        where: { id: entry.id },
      });
      await new Promise((resolve) => setTimeout(resolve, 10));

      const voided = entry.void();
      await repo.updateTx(voided);

      const updatedRow = await prisma.ivaPurchaseBook.findUnique({
        where: { id: entry.id },
      });
      expect(updatedRow).not.toBeNull();
      expect(updatedRow!.updatedAt.getTime()).toBeGreaterThan(
        originalRow!.updatedAt.getTime(),
      );
    });
  });

  describe("findById / findByPeriod (A2.5 — non-tx reads)", () => {
    it("findById hydrates entry from row + tenancy guard", async () => {
      // RED honesty: FAILS pre-implementación con "Not implemented — A2.5 C2 RED"
      // (stub adapter). Post-GREEN: PASSES cuando adapter delega a
      // db.ivaPurchaseBook.findFirst({ where: { id, organizationId } }) +
      // hydrateFromRow.
      const id = await seedRowDirect({ numeroFactura: "P-A25-FIND" });
      const repo = new PrismaIvaPurchaseBookEntryRepo(prisma);

      const entry = await repo.findById(testOrgId, id);
      expect(entry).not.toBeNull();
      expect(entry!.id).toBe(id);
      expect(entry!.numeroFactura).toBe("P-A25-FIND");

      // Tenancy guard: same id, different orgId → null
      const otherOrg = await repo.findById(testOtherOrgId, id);
      expect(otherOrg).toBeNull();
    });

    it("findByPeriod returns array filtered + ordered by fechaFactura asc", async () => {
      // RED honesty: FAILS pre-implementación con "Not implemented — A2.5 C2 RED"
      // (stub adapter). Post-GREEN: PASSES cuando adapter delega a
      // db.ivaPurchaseBook.findMany({ where: { organizationId, fiscalPeriodId?,
      // status? }, orderBy: { fechaFactura: 'asc' } }) + hydrateFromRow map.
      const id1 = await seedRowDirect({ numeroFactura: "P-PER-1" });
      const id2 = await seedRowDirect({ numeroFactura: "P-PER-2" });
      // VOIDED row
      const id3 = await seedRowDirect({
        numeroFactura: "P-PER-V",
        status: "VOIDED",
      });
      // Other org row (tenancy isolation): organizationId AND fiscalPeriodId
      // belong to the other tenant.
      const id4 = await seedRowDirect({
        numeroFactura: "P-OTHER-PER",
        organizationId: testOtherOrgId,
        fiscalPeriodId: testOtherPeriodId,
      });

      const repo = new PrismaIvaPurchaseBookEntryRepo(prisma);

      // Unfiltered (current org): includes id1, id2, id3 (NOT id4 — other period
      // is in different org via testOtherPeriodId belonging to testOtherOrgId)
      const all = await repo.findByPeriod(testOrgId, {});
      const allIds = all.map((e) => e.id).sort();
      expect(allIds).toEqual([id1, id2, id3].sort());

      // Filter by status ACTIVE → excludes id3
      const onlyActive = await repo.findByPeriod(testOrgId, {
        status: "ACTIVE",
      });
      expect(onlyActive.map((e) => e.id).sort()).toEqual([id1, id2].sort());

      // Tenancy: querying other org returns id4 only
      const otherOrgRows = await repo.findByPeriod(testOtherOrgId, {});
      expect(otherOrgRows.map((e) => e.id)).toEqual([id4]);
    });
  });
});
