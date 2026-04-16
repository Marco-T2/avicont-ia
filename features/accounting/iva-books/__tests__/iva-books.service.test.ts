/**
 * Tests del service IVA Books.
 *
 * El service se testea con el repositorio MOCKEADO (vi.fn) — no toca la DB.
 * Lo que se verifica aquí:
 * - Re-cómputo de campos IVA antes de persistir (defense-in-depth)
 * - Derivación del período desde fechaFactura vía FiscalPeriod lookup
 * - Validación de estadoSIN (A/V/C/L)
 * - VOIDED y estadoSIN son ortogonales (void no toca estadoSIN)
 *
 * PR2 — Task 2.2
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { IvaBooksService } from "../iva-books.service";
import { IvaBooksRepository } from "../iva-books.repository";
import type { IvaPurchaseBookDTO, IvaSalesBookDTO } from "../iva-books.types";

// ── Helpers ──────────────────────────────────────────────────────────────────

const D = (v: string | number) => new Prisma.Decimal(String(v));

const ZERO = D("0");
const TASA_IVA = D("0.1300");

// ── Fixtures ──────────────────────────────────────────────────────────────────

const orgId = "org-test-svc";
const fiscalPeriodId = "period-test-svc";
const FECHA = "2025-03-15";

const basePurchaseInput = {
  fechaFactura: FECHA,
  nitProveedor: "1234567",
  razonSocial: "Proveedor Test",
  numeroFactura: "FAC-001",
  codigoAutorizacion: "AUTH-001",
  codigoControl: "",
  tipoCompra: 1,
  fiscalPeriodId,
  // El cliente envía importes — el service RECOMPUTA subtotal, base, iva
  importeTotal: D("1000.00"),
  importeIce: ZERO,
  importeIehd: ZERO,
  importeIpj: ZERO,
  tasas: ZERO,
  otrosNoSujetos: ZERO,
  exentos: ZERO,
  tasaCero: ZERO,
  codigoDescuentoAdicional: ZERO,
  importeGiftCard: ZERO,
  // Estos serán sobreescritos por el service:
  subtotal: ZERO,
  dfIva: ZERO,
  baseIvaSujetoCf: ZERO,
  dfCfIva: ZERO,
  tasaIva: ZERO,
};

const baseSaleInput = {
  fechaFactura: FECHA,
  nitCliente: "7654321",
  razonSocial: "Cliente Test",
  numeroFactura: "FAC-SALE-001",
  codigoAutorizacion: "AUTH-SALE-001",
  codigoControl: "",
  estadoSIN: "A" as const,
  fiscalPeriodId,
  importeTotal: D("2000.00"),
  importeIce: ZERO,
  importeIehd: ZERO,
  importeIpj: ZERO,
  tasas: ZERO,
  otrosNoSujetos: ZERO,
  exentos: ZERO,
  tasaCero: ZERO,
  codigoDescuentoAdicional: ZERO,
  importeGiftCard: ZERO,
  subtotal: ZERO,
  dfIva: ZERO,
  baseIvaSujetoCf: ZERO,
  dfCfIva: ZERO,
  tasaIva: ZERO,
};

// ── Mock del repositorio ──────────────────────────────────────────────────────

function createMockRepo(): IvaBooksRepository {
  return {
    createPurchase: vi.fn(),
    createSale: vi.fn(),
    findPurchaseById: vi.fn(),
    findSaleById: vi.fn(),
    listPurchasesByPeriod: vi.fn().mockResolvedValue([]),
    listSalesByPeriod: vi.fn().mockResolvedValue([]),
    updatePurchase: vi.fn(),
    updateSale: vi.fn(),
    voidPurchase: vi.fn(),
    voidSale: vi.fn(),
  } as unknown as IvaBooksRepository;
}

function makePurchaseDTO(overrides: Partial<IvaPurchaseBookDTO> = {}): IvaPurchaseBookDTO {
  return {
    id: "purchase-book-id",
    organizationId: orgId,
    fiscalPeriodId,
    fechaFactura: FECHA,
    nitProveedor: "1234567",
    razonSocial: "Proveedor Test",
    numeroFactura: "FAC-001",
    codigoAutorizacion: "AUTH-001",
    codigoControl: "",
    tipoCompra: 1,
    importeTotal: D("1000.00"),
    importeIce: ZERO,
    importeIehd: ZERO,
    importeIpj: ZERO,
    tasas: ZERO,
    otrosNoSujetos: ZERO,
    exentos: ZERO,
    tasaCero: ZERO,
    subtotal: D("1000.00"),
    dfIva: D("130.00"),
    codigoDescuentoAdicional: ZERO,
    importeGiftCard: ZERO,
    baseIvaSujetoCf: D("1000.00"),
    dfCfIva: D("130.00"),
    tasaIva: TASA_IVA,
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeSaleDTO(overrides: Partial<IvaSalesBookDTO> = {}): IvaSalesBookDTO {
  return {
    id: "sale-book-id",
    organizationId: orgId,
    fiscalPeriodId,
    fechaFactura: FECHA,
    nitCliente: "7654321",
    razonSocial: "Cliente Test",
    numeroFactura: "FAC-SALE-001",
    codigoAutorizacion: "AUTH-SALE-001",
    codigoControl: "",
    estadoSIN: "A",
    importeTotal: D("2000.00"),
    importeIce: ZERO,
    importeIehd: ZERO,
    importeIpj: ZERO,
    tasas: ZERO,
    otrosNoSujetos: ZERO,
    exentos: ZERO,
    tasaCero: ZERO,
    subtotal: D("2000.00"),
    dfIva: D("260.00"),
    codigoDescuentoAdicional: ZERO,
    importeGiftCard: ZERO,
    baseIvaSujetoCf: D("2000.00"),
    dfCfIva: D("260.00"),
    tasaIva: TASA_IVA,
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("IvaBooksService", () => {
  let repo: IvaBooksRepository;
  let service: IvaBooksService;

  beforeEach(() => {
    repo = createMockRepo();
    service = new IvaBooksService(repo);
  });

  // ── createPurchase: re-cómputo server-side ──────────────────────────────────

  describe("createPurchase — re-cómputo IVA", () => {
    it("calcula subtotal, baseIvaSujetoCf y dfCfIva antes de pasar al repo", async () => {
      const expectedDTO = makePurchaseDTO();
      vi.mocked(repo.createPurchase).mockResolvedValueOnce(expectedDTO);

      await service.createPurchase(orgId, basePurchaseInput);

      // Verificar que el repo recibió los campos IVA recomputados, no los zeros del input
      const [calledOrgId, calledInput] = vi.mocked(repo.createPurchase).mock.calls[0];
      expect(calledOrgId).toBe(orgId);

      // subtotal = 1000 - 0 - 0 - 0 - 0 - 0 - 0 - 0 = 1000.00
      expect(new Prisma.Decimal(calledInput.subtotal).toFixed(2)).toBe("1000.00");
      // baseIvaSujetoCf = gravableConIva = 1000 (alícuota nominal SIN: base = total facturado)
      expect(new Prisma.Decimal(calledInput.baseIvaSujetoCf).toFixed(2)).toBe("1000.00");
      // dfCfIva = gravableConIva × 0.13 = 1000 × 0.13 = 130.00 (alícuota nominal)
      expect(calledInput.dfCfIva.toString()).toBe("130");
      // tasaIva = 0.1300 (Decimal.toFixed(4) para preservar la precisión)
      expect(new Prisma.Decimal(calledInput.tasaIva).toFixed(4)).toBe("0.1300");
    });

    it("campo dfIva es simétrico a dfCfIva (mismo cálculo)", async () => {
      const expectedDTO = makePurchaseDTO();
      vi.mocked(repo.createPurchase).mockResolvedValueOnce(expectedDTO);

      await service.createPurchase(orgId, basePurchaseInput);

      const [, calledInput] = vi.mocked(repo.createPurchase).mock.calls[0];
      // dfIva y dfCfIva deben coincidir
      expect(calledInput.dfIva.toString()).toBe(calledInput.dfCfIva.toString());
    });

    it("factura 100% exenta → dfCfIva = 0 sin error de división por cero", async () => {
      const exentoInput = {
        ...basePurchaseInput,
        importeTotal: D("500.00"),
        exentos: D("500.00"), // todo exento
      };
      const expectedDTO = makePurchaseDTO({
        importeTotal: D("500.00"),
        subtotal: D("0.00"),
        dfCfIva: D("0.00"),
      });
      vi.mocked(repo.createPurchase).mockResolvedValueOnce(expectedDTO);

      await expect(service.createPurchase(orgId, exentoInput)).resolves.not.toThrow();

      const [, calledInput] = vi.mocked(repo.createPurchase).mock.calls[0];
      expect(new Prisma.Decimal(calledInput.subtotal).toFixed(2)).toBe("0.00");
      expect(new Prisma.Decimal(calledInput.dfCfIva).toFixed(2)).toBe("0.00");
    });
  });

  // ── createSale: re-cómputo server-side ─────────────────────────────────────

  describe("createSale — re-cómputo IVA", () => {
    it("calcula campos IVA de venta antes de persistir", async () => {
      const expectedDTO = makeSaleDTO();
      vi.mocked(repo.createSale).mockResolvedValueOnce(expectedDTO);

      await service.createSale(orgId, baseSaleInput);

      const [calledOrgId, calledInput] = vi.mocked(repo.createSale).mock.calls[0];
      expect(calledOrgId).toBe(orgId);
      // subtotal = 2000 (Decimal.toString() omite trailing zeros)
      expect(new Prisma.Decimal(calledInput.subtotal).toFixed(2)).toBe("2000.00");
      // dfCfIva = 2000 × 0.13 = 260 (alícuota nominal SIN)
      expect(calledInput.dfCfIva.toString()).toBe("260");
    });

    it("estadoSIN se pasa tal cual desde el input (sin lógica automática)", async () => {
      const expectedDTO = makeSaleDTO({ estadoSIN: "C" });
      vi.mocked(repo.createSale).mockResolvedValueOnce(expectedDTO);

      await service.createSale(orgId, { ...baseSaleInput, estadoSIN: "C" });

      const [, calledInput] = vi.mocked(repo.createSale).mock.calls[0];
      expect(calledInput.estadoSIN).toBe("C");
    });
  });

  // ── VOIDED y estadoSIN son ortogonales ──────────────────────────────────────

  describe("voidPurchase", () => {
    it("delega al repo.voidPurchase y retorna el DTO con status VOIDED", async () => {
      const voidedDTO = makePurchaseDTO({ status: "VOIDED" });
      vi.mocked(repo.voidPurchase).mockResolvedValueOnce(voidedDTO);

      const result = await service.voidPurchase(orgId, "purchase-book-id");

      expect(repo.voidPurchase).toHaveBeenCalledWith(orgId, "purchase-book-id");
      expect(result.status).toBe("VOIDED");
    });
  });

  describe("voidSale", () => {
    it("VOIDED no modifica estadoSIN — axes son ortogonales", async () => {
      const voidedDTO = makeSaleDTO({ status: "VOIDED", estadoSIN: "A" });
      vi.mocked(repo.voidSale).mockResolvedValueOnce(voidedDTO);

      const result = await service.voidSale(orgId, "sale-book-id");

      expect(result.status).toBe("VOIDED");
      // estadoSIN permanece "A" — el void no lo toca
      expect(result.estadoSIN).toBe("A");

      // El repo no recibió ningún cambio en estadoSIN
      expect(repo.voidSale).toHaveBeenCalledWith(orgId, "sale-book-id");
      expect(repo.updateSale).not.toHaveBeenCalled();
    });
  });

  // ── listPurchasesByPeriod ───────────────────────────────────────────────────

  describe("listPurchasesByPeriod", () => {
    it("delega al repo con los filtros y retorna la lista", async () => {
      const entries = [makePurchaseDTO(), makePurchaseDTO({ id: "purchase-2" })];
      vi.mocked(repo.listPurchasesByPeriod).mockResolvedValueOnce(entries);

      const result = await service.listPurchasesByPeriod(orgId, { fiscalPeriodId });

      expect(repo.listPurchasesByPeriod).toHaveBeenCalledWith(orgId, { fiscalPeriodId });
      expect(result).toHaveLength(2);
    });
  });

  // ── listSalesByPeriod ───────────────────────────────────────────────────────

  describe("listSalesByPeriod", () => {
    it("delega al repo con los filtros y retorna la lista", async () => {
      const entries = [makeSaleDTO()];
      vi.mocked(repo.listSalesByPeriod).mockResolvedValueOnce(entries);

      const result = await service.listSalesByPeriod(orgId, { fiscalPeriodId });

      expect(result).toHaveLength(1);
    });
  });

  // ── updatePurchase ──────────────────────────────────────────────────────────

  describe("updatePurchase", () => {
    it("cuando el update incluye importeTotal, recomputa los campos IVA", async () => {
      const updatedDTO = makePurchaseDTO({
        importeTotal: D("500.00"),
        subtotal: D("500.00"),
        dfCfIva: D("65.00"),
      });
      vi.mocked(repo.updatePurchase).mockResolvedValueOnce(updatedDTO);

      // Primero findById para obtener los datos actuales
      vi.mocked(repo.findPurchaseById).mockResolvedValueOnce(makePurchaseDTO());

      await service.updatePurchase(orgId, "purchase-book-id", {
        importeTotal: D("500.00"),
      });

      const [, , calledInput] = vi.mocked(repo.updatePurchase).mock.calls[0];
      // El service debe recomputar IVA con los nuevos montos
      expect(new Prisma.Decimal(calledInput.subtotal!).toFixed(2)).toBe("500.00");
      // dfCfIva = 500 × 0.13 = 65 (alícuota nominal SIN)
      expect(calledInput.dfCfIva?.toString()).toBe("65");
    });
  });
});
