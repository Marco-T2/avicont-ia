/**
 * PR4 — Task 4.3 (RED/GREEN): IvaBooksService CUD triggers editPosted bridge.
 *
 * Covers SPEC-6: createForSale/updateForSale/deleteForSale (void) trigger
 * saleService.regenerateJournalForIvaChange when POSTED + OPEN period.
 * Mirror cases for Purchase side.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { IvaBooksService } from "../iva-books.service";
import { IvaBooksRepository } from "../iva-books.repository";
import { SaleService } from "@/features/sale/sale.service";
import { PurchaseService } from "@/features/purchase/purchase.service";
import type { IvaSalesBookDTO, IvaPurchaseBookDTO } from "../iva-books.types";
import { ValidationError } from "@/features/shared/errors";

// ── Helpers ───────────────────────────────────────────────────────────────────

const D = (v: string | number) => new Prisma.Decimal(String(v));
const ZERO = D("0");

const ORG_ID = "org-cascade-test";
const USER_ID = "user-cascade-test";
const SALE_ID = "sale-cascade-test";
const PURCHASE_ID = "purchase-cascade-test";
const PERIOD_ID = "period-cascade-test";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const baseMonetary = {
  importeTotal: D("113.00"),
  importeIce: ZERO, importeIehd: ZERO, importeIpj: ZERO,
  tasas: ZERO, otrosNoSujetos: ZERO, exentos: ZERO, tasaCero: ZERO,
  codigoDescuentoAdicional: ZERO, importeGiftCard: ZERO,
  subtotal: D("113.00"), dfIva: D("13.00"),
  baseIvaSujetoCf: D("100.00"), dfCfIva: D("13.00"), tasaIva: D("0.1300"),
};

function makeSaleDTO(overrides: Partial<IvaSalesBookDTO> = {}): IvaSalesBookDTO {
  return {
    id: "iva-sale-book-id",
    organizationId: ORG_ID,
    fiscalPeriodId: PERIOD_ID,
    saleId: SALE_ID,
    fechaFactura: "2025-03-15",
    nitCliente: "1234567",
    razonSocial: "Cliente Test",
    numeroFactura: "FAC-001",
    codigoAutorizacion: "AUTH-001",
    codigoControl: "",
    estadoSIN: "A",
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date(),
    notes: undefined,
    ...baseMonetary,
    ...overrides,
  };
}

function makePurchaseDTO(overrides: Partial<IvaPurchaseBookDTO> = {}): IvaPurchaseBookDTO {
  return {
    id: "iva-purchase-book-id",
    organizationId: ORG_ID,
    fiscalPeriodId: PERIOD_ID,
    purchaseId: PURCHASE_ID,
    fechaFactura: "2025-03-15",
    nitProveedor: "7654321",
    razonSocial: "Proveedor Test",
    numeroFactura: "FAC-COMP-001",
    codigoAutorizacion: "AUTH-COMP-001",
    codigoControl: "",
    tipoCompra: 1,
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date(),
    notes: undefined,
    ...baseMonetary,
    ...overrides,
  };
}

const baseSaleCreateInput = {
  fechaFactura: "2025-03-15",
  nitCliente: "1234567",
  razonSocial: "Cliente Test",
  numeroFactura: "FAC-001",
  codigoAutorizacion: "AUTH-001",
  codigoControl: "",
  estadoSIN: "A" as const,
  fiscalPeriodId: PERIOD_ID,
  saleId: SALE_ID,
  ...baseMonetary,
};

const basePurchaseCreateInput = {
  fechaFactura: "2025-03-15",
  nitProveedor: "7654321",
  razonSocial: "Proveedor Test",
  numeroFactura: "FAC-COMP-001",
  codigoAutorizacion: "AUTH-COMP-001",
  codigoControl: "",
  tipoCompra: 1,
  fiscalPeriodId: PERIOD_ID,
  purchaseId: PURCHASE_ID,
  ...baseMonetary,
};

// ── Mock factories ────────────────────────────────────────────────────────────

function createMocks() {
  const repo = {
    createSale: vi.fn().mockResolvedValue(makeSaleDTO()),
    createPurchase: vi.fn().mockResolvedValue(makePurchaseDTO()),
    findSaleById: vi.fn().mockResolvedValue(makeSaleDTO()),
    findPurchaseById: vi.fn().mockResolvedValue(makePurchaseDTO()),
    listSalesByPeriod: vi.fn().mockResolvedValue([]),
    listPurchasesByPeriod: vi.fn().mockResolvedValue([]),
    updateSale: vi.fn().mockResolvedValue(makeSaleDTO()),
    updatePurchase: vi.fn().mockResolvedValue(makePurchaseDTO()),
    voidSale: vi.fn().mockResolvedValue(makeSaleDTO({ status: "VOIDED" })),
    voidPurchase: vi.fn().mockResolvedValue(makePurchaseDTO({ status: "VOIDED" })),
  } as unknown as IvaBooksRepository;

  const saleService = {
    getById: vi.fn().mockResolvedValue({
      id: SALE_ID,
      status: "POSTED",
      periodId: PERIOD_ID,
      period: { id: PERIOD_ID, status: "OPEN" },
    }),
    regenerateJournalForIvaChange: vi.fn().mockResolvedValue({}),
  } as unknown as SaleService;

  const purchaseService = {
    getById: vi.fn().mockResolvedValue({
      id: PURCHASE_ID,
      status: "POSTED",
      periodId: PERIOD_ID,
      period: { id: PERIOD_ID, status: "OPEN" },
    }),
    regenerateJournalForIvaChange: vi.fn().mockResolvedValue({}),
  } as unknown as PurchaseService;

  const periodsServiceMock = {
    getById: vi.fn().mockResolvedValue({ id: PERIOD_ID, status: "OPEN" }),
  };

  const service = new IvaBooksService(repo, saleService, purchaseService);

  return { repo, saleService, purchaseService, periodsServiceMock, service };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("IvaBooksService — editPosted bridge (SPEC-6)", () => {
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    mocks = createMocks();
  });

  // ── VENTA: POSTED + OPEN → regenera ──────────────────────────────────────

  describe("createSale — POSTED + OPEN → regenera journal", () => {
    it("llama a saleService.regenerateJournalForIvaChange cuando Sale es POSTED y período OPEN", async () => {
      vi.mocked(mocks.saleService.getById).mockResolvedValueOnce({
        id: SALE_ID, status: "POSTED", periodId: PERIOD_ID,
        period: { id: PERIOD_ID, status: "OPEN" },
      } as never);

      await mocks.service.createSale(ORG_ID, USER_ID, baseSaleCreateInput);

      expect(mocks.saleService.regenerateJournalForIvaChange).toHaveBeenCalledWith(
        ORG_ID, SALE_ID, USER_ID,
      );
    });
  });

  describe("updateSale — POSTED + OPEN → regenera journal", () => {
    it("llama a saleService.regenerateJournalForIvaChange en update", async () => {
      vi.mocked(mocks.saleService.getById).mockResolvedValueOnce({
        id: SALE_ID, status: "POSTED", periodId: PERIOD_ID,
        period: { id: PERIOD_ID, status: "OPEN" },
      } as never);

      await mocks.service.updateSale(ORG_ID, USER_ID, "iva-sale-book-id", {
        importeTotal: D("226.00"),
        ...baseMonetary,
      });

      expect(mocks.saleService.regenerateJournalForIvaChange).toHaveBeenCalledWith(
        ORG_ID, SALE_ID, USER_ID,
      );
    });
  });

  describe("voidSale — POSTED + OPEN → regenera journal (non-IVA path)", () => {
    it("llama a saleService.regenerateJournalForIvaChange cuando void de IvaBook en venta POSTED", async () => {
      vi.mocked(mocks.saleService.getById).mockResolvedValueOnce({
        id: SALE_ID, status: "POSTED", periodId: PERIOD_ID,
        period: { id: PERIOD_ID, status: "OPEN" },
      } as never);

      await mocks.service.voidSale(ORG_ID, USER_ID, "iva-sale-book-id");

      expect(mocks.saleService.regenerateJournalForIvaChange).toHaveBeenCalledWith(
        ORG_ID, SALE_ID, USER_ID,
      );
    });
  });

  // ── VENTA: DRAFT + OPEN → NO regenera ────────────────────────────────────

  describe("createSale — DRAFT + OPEN → NO regenera journal", () => {
    it("NO llama a regenerateJournalForIvaChange cuando Sale es DRAFT", async () => {
      vi.mocked(mocks.saleService.getById).mockResolvedValueOnce({
        id: SALE_ID, status: "DRAFT", periodId: PERIOD_ID,
        period: { id: PERIOD_ID, status: "OPEN" },
      } as never);

      await mocks.service.createSale(ORG_ID, USER_ID, baseSaleCreateInput);

      expect(mocks.saleService.regenerateJournalForIvaChange).not.toHaveBeenCalled();
    });
  });

  // ── VENTA: POSTED + CLOSED → lanza error ─────────────────────────────────

  describe("createSale — POSTED + CLOSED → lanza FISCAL_PERIOD_CLOSED", () => {
    it("lanza ValidationError y NO crea el IvaBook cuando el período está CERRADO", async () => {
      vi.mocked(mocks.saleService.getById).mockResolvedValueOnce({
        id: SALE_ID, status: "POSTED", periodId: PERIOD_ID,
        period: { id: PERIOD_ID, status: "CLOSED" },
      } as never);

      await expect(
        mocks.service.createSale(ORG_ID, USER_ID, baseSaleCreateInput),
      ).rejects.toThrow(ValidationError);

      expect(mocks.repo.createSale).not.toHaveBeenCalled();
      expect(mocks.saleService.regenerateJournalForIvaChange).not.toHaveBeenCalled();
    });
  });

  // ── Sin saleId → sin regeneración (standalone) ───────────────────────────

  describe("createSale — sin saleId → no regenera", () => {
    it("cuando no hay saleId, no intenta regenerar el journal", async () => {
      const inputSinSale = { ...baseSaleCreateInput, saleId: undefined };

      await mocks.service.createSale(ORG_ID, USER_ID, inputSinSale);

      expect(mocks.saleService.getById).not.toHaveBeenCalled();
      expect(mocks.saleService.regenerateJournalForIvaChange).not.toHaveBeenCalled();
    });
  });

  // ── COMPRA: POSTED + OPEN → regenera ─────────────────────────────────────

  describe("createPurchase — POSTED + OPEN → regenera journal", () => {
    it("llama a purchaseService.regenerateJournalForIvaChange cuando Compra es POSTED y período OPEN", async () => {
      vi.mocked(mocks.purchaseService.getById).mockResolvedValueOnce({
        id: PURCHASE_ID, status: "POSTED", periodId: PERIOD_ID,
        period: { id: PERIOD_ID, status: "OPEN" },
      } as never);

      await mocks.service.createPurchase(ORG_ID, USER_ID, basePurchaseCreateInput);

      expect(mocks.purchaseService.regenerateJournalForIvaChange).toHaveBeenCalledWith(
        ORG_ID, PURCHASE_ID, USER_ID,
      );
    });
  });

  describe("updatePurchase — POSTED + OPEN → regenera journal", () => {
    it("llama a purchaseService.regenerateJournalForIvaChange en update", async () => {
      vi.mocked(mocks.purchaseService.getById).mockResolvedValueOnce({
        id: PURCHASE_ID, status: "POSTED", periodId: PERIOD_ID,
        period: { id: PERIOD_ID, status: "OPEN" },
      } as never);

      await mocks.service.updatePurchase(ORG_ID, USER_ID, "iva-purchase-book-id", {
        importeTotal: D("226.00"),
      });

      expect(mocks.purchaseService.regenerateJournalForIvaChange).toHaveBeenCalledWith(
        ORG_ID, PURCHASE_ID, USER_ID,
      );
    });
  });

  describe("voidPurchase — POSTED + OPEN → regenera journal", () => {
    it("llama a purchaseService.regenerateJournalForIvaChange cuando void en compra POSTED", async () => {
      vi.mocked(mocks.purchaseService.getById).mockResolvedValueOnce({
        id: PURCHASE_ID, status: "POSTED", periodId: PERIOD_ID,
        period: { id: PERIOD_ID, status: "OPEN" },
      } as never);

      await mocks.service.voidPurchase(ORG_ID, USER_ID, "iva-purchase-book-id");

      expect(mocks.purchaseService.regenerateJournalForIvaChange).toHaveBeenCalledWith(
        ORG_ID, PURCHASE_ID, USER_ID,
      );
    });
  });

  describe("createPurchase — DRAFT + OPEN → NO regenera journal", () => {
    it("NO llama a regenerateJournalForIvaChange cuando Compra es DRAFT", async () => {
      vi.mocked(mocks.purchaseService.getById).mockResolvedValueOnce({
        id: PURCHASE_ID, status: "DRAFT", periodId: PERIOD_ID,
        period: { id: PERIOD_ID, status: "OPEN" },
      } as never);

      await mocks.service.createPurchase(ORG_ID, USER_ID, basePurchaseCreateInput);

      expect(mocks.purchaseService.regenerateJournalForIvaChange).not.toHaveBeenCalled();
    });
  });

  describe("createPurchase — POSTED + CLOSED → lanza FISCAL_PERIOD_CLOSED", () => {
    it("lanza ValidationError y NO crea el IvaBook cuando el período está CERRADO", async () => {
      vi.mocked(mocks.purchaseService.getById).mockResolvedValueOnce({
        id: PURCHASE_ID, status: "POSTED", periodId: PERIOD_ID,
        period: { id: PERIOD_ID, status: "CLOSED" },
      } as never);

      await expect(
        mocks.service.createPurchase(ORG_ID, USER_ID, basePurchaseCreateInput),
      ).rejects.toThrow(ValidationError);

      expect(mocks.repo.createPurchase).not.toHaveBeenCalled();
      expect(mocks.purchaseService.regenerateJournalForIvaChange).not.toHaveBeenCalled();
    });
  });

  describe("createPurchase — sin purchaseId → no regenera", () => {
    it("cuando no hay purchaseId, no intenta regenerar el journal", async () => {
      const inputSinPurchase = { ...basePurchaseCreateInput, purchaseId: undefined };

      await mocks.service.createPurchase(ORG_ID, USER_ID, inputSinPurchase);

      expect(mocks.purchaseService.getById).not.toHaveBeenCalled();
      expect(mocks.purchaseService.regenerateJournalForIvaChange).not.toHaveBeenCalled();
    });
  });
});
