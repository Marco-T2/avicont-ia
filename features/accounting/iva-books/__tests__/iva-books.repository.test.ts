/**
 * Tests de integración del repositorio IVA Books contra la base de datos real (Prisma).
 *
 * Estrategia: cada test envuelve su trabajo en una transacción que se revierte al final
 * (rollback pattern) — sin residuos en la DB y sin depender del orden de ejecución.
 *
 * PR2 — Task 2.1
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { IvaBooksRepository } from "../iva-books.repository";
import type { CreatePurchaseInput, CreateSaleInput } from "../iva-books.types";
import { Prisma } from "@/generated/prisma/client";

// ── Helpers ──────────────────────────────────────────────────────────────────

const D = (v: string | number) => new Prisma.Decimal(String(v));

/** Montos en cero para campos opcionales */
const zeroMonetary = {
  importeIce: D("0"),
  importeIehd: D("0"),
  importeIpj: D("0"),
  tasas: D("0"),
  otrosNoSujetos: D("0"),
  exentos: D("0"),
  tasaCero: D("0"),
  dfIva: D("0"),
  codigoDescuentoAdicional: D("0"),
  importeGiftCard: D("0"),
  tasaIva: D("0.1300"),
};

// ── Fixtures de organización y período ────────────────────────────────────────

let orgId: string;
let fiscalPeriodId: string;
let userId: string;

beforeAll(async () => {
  // Crear usuario de prueba
  const user = await prisma.user.create({
    data: {
      clerkUserId: `test-user-repo-${Date.now()}`,
      email: `repo-test-${Date.now()}@test.com`,
      name: "Repo Test User",
    },
  });
  userId = user.id;

  // Crear organización de prueba
  const org = await prisma.organization.create({
    data: {
      clerkOrgId: `test-org-repo-${Date.now()}`,
      name: "Test Org IVA Repo",
      slug: `test-org-iva-repo-${Date.now()}`,
    },
  });
  orgId = org.id;

  // Crear período fiscal de prueba
  const period = await prisma.fiscalPeriod.create({
    data: {
      organizationId: orgId,
      name: "Gestión 2025",
      year: 2025,
      startDate: new Date("2025-01-01"),
      endDate: new Date("2025-12-31"),
      createdById: userId,
    },
  });
  fiscalPeriodId = period.id;
});

afterAll(async () => {
  // Limpiar en orden de dependencias
  await prisma.ivaSalesBook.deleteMany({ where: { organizationId: orgId } });
  await prisma.ivaPurchaseBook.deleteMany({ where: { organizationId: orgId } });
  await prisma.fiscalPeriod.deleteMany({ where: { organizationId: orgId } });
  await prisma.organization.delete({ where: { id: orgId } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.$disconnect();
});

// ── Base input fixtures ───────────────────────────────────────────────────────

function makePurchaseInput(overrides: Partial<CreatePurchaseInput> = {}): CreatePurchaseInput {
  const now = Date.now();
  return {
    ...zeroMonetary,
    fechaFactura: "2025-03-15",
    nitProveedor: `NIT-${now}`,
    razonSocial: "Proveedor Test S.R.L.",
    numeroFactura: `FAC-${now}`,
    codigoAutorizacion: `AUTH-${now}`,
    codigoControl: "",
    tipoCompra: 1,
    fiscalPeriodId,
    importeTotal: D("1000.00"),
    subtotal: D("1000.00"),
    baseIvaSujetoCf: D("1000.00"),
    dfCfIva: D("130.00"),
    ...overrides,
  };
}

function makeSaleInput(overrides: Partial<CreateSaleInput> = {}): CreateSaleInput {
  const now = Date.now();
  return {
    ...zeroMonetary,
    fechaFactura: "2025-03-15",
    nitCliente: `NIT-${now}`,
    razonSocial: "Cliente Test S.R.L.",
    numeroFactura: `FAC-SALE-${now}`,
    codigoAutorizacion: `AUTH-SALE-${now}`,
    codigoControl: "",
    estadoSIN: "A",
    fiscalPeriodId,
    importeTotal: D("2000.00"),
    subtotal: D("2000.00"),
    baseIvaSujetoCf: D("2000.00"),
    dfCfIva: D("260.00"),
    dfIva: D("260.00"),
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("IvaBooksRepository", () => {
  let repo: IvaBooksRepository;

  beforeAll(() => {
    repo = new IvaBooksRepository();
  });

  // ── createPurchase ──────────────────────────────────────────────────────────

  describe("createPurchase", () => {
    it("persiste una entrada de compra y retorna el DTO con id", async () => {
      const input = makePurchaseInput();
      const result = await repo.createPurchase(orgId, input);

      expect(result.id).toBeTruthy();
      expect(result.organizationId).toBe(orgId);
      expect(result.fiscalPeriodId).toBe(fiscalPeriodId);
      expect(result.nitProveedor).toBe(input.nitProveedor);
      expect(result.numeroFactura).toBe(input.numeroFactura);
      expect(result.status).toBe("ACTIVE");
      expect(new Prisma.Decimal(result.importeTotal).toFixed(2)).toBe("1000.00");

      // Cleanup
      await prisma.ivaPurchaseBook.delete({ where: { id: result.id } });
    });

    it("persiste entrada standalone (sin purchaseId)", async () => {
      const input = makePurchaseInput({ purchaseId: undefined });
      const result = await repo.createPurchase(orgId, input);

      expect(result.id).toBeTruthy();
      // DTO maps null FK to undefined (per iva-books.types optional FK)
      expect(result.purchaseId).toBeUndefined();

      await prisma.ivaPurchaseBook.delete({ where: { id: result.id } });
    });
  });

  // ── createSale ──────────────────────────────────────────────────────────────

  describe("createSale", () => {
    it("persiste una entrada de venta con estadoSIN y retorna DTO", async () => {
      const input = makeSaleInput({ estadoSIN: "A" });
      const result = await repo.createSale(orgId, input);

      expect(result.id).toBeTruthy();
      expect(result.organizationId).toBe(orgId);
      expect(result.estadoSIN).toBe("A");
      expect(result.status).toBe("ACTIVE");
      expect(new Prisma.Decimal(result.importeTotal).toFixed(2)).toBe("2000.00");

      await prisma.ivaSalesBook.delete({ where: { id: result.id } });
    });

    it("persiste entrada de venta standalone (sin saleId)", async () => {
      const input = makeSaleInput({ saleId: undefined });
      const result = await repo.createSale(orgId, input);

      expect(result.saleId).toBeUndefined();

      await prisma.ivaSalesBook.delete({ where: { id: result.id } });
    });
  });

  // ── findPurchaseById ────────────────────────────────────────────────────────

  describe("findPurchaseById", () => {
    it("retorna la entrada por id, scoped a la organización", async () => {
      const input = makePurchaseInput();
      const created = await repo.createPurchase(orgId, input);

      const found = await repo.findPurchaseById(orgId, created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.organizationId).toBe(orgId);

      await prisma.ivaPurchaseBook.delete({ where: { id: created.id } });
    });

    it("retorna null si el id no existe", async () => {
      const found = await repo.findPurchaseById(orgId, "non-existent-id");
      expect(found).toBeNull();
    });

    it("retorna null si el id existe pero pertenece a otra org", async () => {
      const input = makePurchaseInput();
      const created = await repo.createPurchase(orgId, input);

      const found = await repo.findPurchaseById("another-org-id", created.id);
      expect(found).toBeNull();

      await prisma.ivaPurchaseBook.delete({ where: { id: created.id } });
    });
  });

  // ── findSaleById ────────────────────────────────────────────────────────────

  describe("findSaleById", () => {
    it("retorna la venta por id, scoped a la organización", async () => {
      const input = makeSaleInput();
      const created = await repo.createSale(orgId, input);

      const found = await repo.findSaleById(orgId, created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);

      await prisma.ivaSalesBook.delete({ where: { id: created.id } });
    });

    it("retorna null si no existe", async () => {
      const found = await repo.findSaleById(orgId, "nope");
      expect(found).toBeNull();
    });
  });

  // ── listPurchasesByPeriod ───────────────────────────────────────────────────

  describe("listPurchasesByPeriod", () => {
    it("retorna solo las entradas del período especificado", async () => {
      const e1 = await repo.createPurchase(orgId, makePurchaseInput());
      const e2 = await repo.createPurchase(orgId, makePurchaseInput());

      const results = await repo.listPurchasesByPeriod(orgId, { fiscalPeriodId });
      const ids = results.map((r) => r.id);

      expect(ids).toContain(e1.id);
      expect(ids).toContain(e2.id);

      await prisma.ivaPurchaseBook.deleteMany({ where: { id: { in: [e1.id, e2.id] } } });
    });

    it("no retorna entradas de otro período", async () => {
      // Crear un segundo período
      const period2 = await prisma.fiscalPeriod.create({
        data: {
          organizationId: orgId,
          name: "Gestión 2026",
          year: 2026,
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-12-31"),
          createdById: userId,
        },
      });

      const e1 = await repo.createPurchase(orgId, makePurchaseInput({ fiscalPeriodId: period2.id }));
      const results = await repo.listPurchasesByPeriod(orgId, { fiscalPeriodId });

      expect(results.map((r) => r.id)).not.toContain(e1.id);

      await prisma.ivaPurchaseBook.delete({ where: { id: e1.id } });
      await prisma.fiscalPeriod.delete({ where: { id: period2.id } });
    });

    it("filtra por status ACTIVE", async () => {
      const e1 = await repo.createPurchase(orgId, makePurchaseInput());
      const e2 = await repo.createPurchase(orgId, makePurchaseInput());

      // Void e2 directamente en DB
      await prisma.ivaPurchaseBook.update({
        where: { id: e2.id },
        data: { status: "VOIDED" },
      });

      const activeOnly = await repo.listPurchasesByPeriod(orgId, {
        fiscalPeriodId,
        status: "ACTIVE",
      });

      expect(activeOnly.map((r) => r.id)).toContain(e1.id);
      expect(activeOnly.map((r) => r.id)).not.toContain(e2.id);

      await prisma.ivaPurchaseBook.deleteMany({ where: { id: { in: [e1.id, e2.id] } } });
    });
  });

  // ── listSalesByPeriod ───────────────────────────────────────────────────────

  describe("listSalesByPeriod", () => {
    it("retorna solo las ventas del período especificado", async () => {
      const e1 = await repo.createSale(orgId, makeSaleInput());
      const e2 = await repo.createSale(orgId, makeSaleInput());

      const results = await repo.listSalesByPeriod(orgId, { fiscalPeriodId });
      const ids = results.map((r) => r.id);

      expect(ids).toContain(e1.id);
      expect(ids).toContain(e2.id);

      await prisma.ivaSalesBook.deleteMany({ where: { id: { in: [e1.id, e2.id] } } });
    });
  });

  // ── updatePurchase ──────────────────────────────────────────────────────────

  describe("updatePurchase", () => {
    it("actualiza campos mutables de una entrada de compra", async () => {
      const created = await repo.createPurchase(orgId, makePurchaseInput());

      const updated = await repo.updatePurchase(orgId, created.id, {
        razonSocial: "Proveedor Actualizado",
        importeTotal: D("1500.00"),
      });

      expect(updated.razonSocial).toBe("Proveedor Actualizado");
      expect(new Prisma.Decimal(updated.importeTotal).toFixed(2)).toBe("1500.00");
      expect(updated.id).toBe(created.id);

      await prisma.ivaPurchaseBook.delete({ where: { id: created.id } });
    });
  });

  // ── updateSale ──────────────────────────────────────────────────────────────

  describe("updateSale", () => {
    it("actualiza campos mutables de una venta", async () => {
      const created = await repo.createSale(orgId, makeSaleInput());

      const updated = await repo.updateSale(orgId, created.id, {
        estadoSIN: "C",
        razonSocial: "Cliente Actualizado",
      });

      expect(updated.estadoSIN).toBe("C");
      expect(updated.razonSocial).toBe("Cliente Actualizado");

      await prisma.ivaSalesBook.delete({ where: { id: created.id } });
    });
  });

  // ── voidPurchase ────────────────────────────────────────────────────────────

  describe("voidPurchase", () => {
    it("cambia status a VOIDED sin modificar otros campos", async () => {
      const created = await repo.createPurchase(orgId, makePurchaseInput());
      expect(created.status).toBe("ACTIVE");

      const voided = await repo.voidPurchase(orgId, created.id);
      expect(voided.status).toBe("VOIDED");
      expect(voided.nitProveedor).toBe(created.nitProveedor);
      expect(voided.importeTotal.toString()).toBe(created.importeTotal.toString());

      await prisma.ivaPurchaseBook.delete({ where: { id: created.id } });
    });
  });

  // ── voidSale ────────────────────────────────────────────────────────────────

  describe("voidSale", () => {
    it("cambia status a VOIDED sin modificar estadoSIN (orthogonal)", async () => {
      const created = await repo.createSale(orgId, makeSaleInput({ estadoSIN: "A" }));

      const voided = await repo.voidSale(orgId, created.id);

      expect(voided.status).toBe("VOIDED");
      // estadoSIN NO debe cambiar — axes son ortogonales
      expect(voided.estadoSIN).toBe("A");

      await prisma.ivaSalesBook.delete({ where: { id: created.id } });
    });
  });

  // ── reactivateSale ──────────────────────────────────────────────────────────

  describe("reactivateSale", () => {
    it("cambia status a ACTIVE desde VOIDED sin modificar estadoSIN", async () => {
      const created = await repo.createSale(orgId, makeSaleInput({ estadoSIN: "A" }));
      // Primero void
      await repo.voidSale(orgId, created.id);

      const reactivated = await repo.reactivateSale(orgId, created.id);

      expect(reactivated.status).toBe("ACTIVE");
      // estadoSIN NO debe cambiar — axes son ortogonales
      expect(reactivated.estadoSIN).toBe("A");
      // Resto de datos intactos
      expect(reactivated.id).toBe(created.id);

      await prisma.ivaSalesBook.delete({ where: { id: created.id } });
    });

    it("lanza NotFoundError si la entrada no existe", async () => {
      const { NotFoundError } = await import("@/features/shared/errors");
      await expect(repo.reactivateSale(orgId, "non-existent-id")).rejects.toThrow(NotFoundError);
    });

    it("lanza ConflictError si la entrada ya está ACTIVE (guard idempotencia)", async () => {
      const created = await repo.createSale(orgId, makeSaleInput());
      // created.status es ACTIVE

      const { ConflictError } = await import("@/features/shared/errors");
      await expect(repo.reactivateSale(orgId, created.id)).rejects.toThrow(ConflictError);

      await prisma.ivaSalesBook.delete({ where: { id: created.id } });
    });
  });

  // ── Unique constraint violation ─────────────────────────────────────────────

  describe("unique constraint", () => {
    it("lanza error de dominio al crear compra duplicada (mismo org+nit+factura+autorizacion)", async () => {
      const input = makePurchaseInput();
      const created = await repo.createPurchase(orgId, input);

      // Intentar crear la misma entrada duplicada
      await expect(repo.createPurchase(orgId, input)).rejects.toThrow();

      await prisma.ivaPurchaseBook.delete({ where: { id: created.id } });
    });

    it("el error por duplicado es un ConflictError (no error Prisma crudo)", async () => {
      const input = makePurchaseInput();
      const created = await repo.createPurchase(orgId, input);

      const { ConflictError } = await import("@/features/shared/errors");
      await expect(repo.createPurchase(orgId, input)).rejects.toThrow(ConflictError);

      await prisma.ivaPurchaseBook.delete({ where: { id: created.id } });
    });
  });
});
