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
  importeTotal: D("100.00"),
  importeIce: ZERO, importeIehd: ZERO, importeIpj: ZERO,
  tasas: ZERO, otrosNoSujetos: ZERO, exentos: ZERO, tasaCero: ZERO,
  codigoDescuentoAdicional: ZERO, importeGiftCard: ZERO,
  subtotal: D("100.00"), dfIva: D("13.00"),
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
    reactivateSale: vi.fn().mockResolvedValue(makeSaleDTO({ status: "ACTIVE" })),
    reactivatePurchase: vi.fn().mockResolvedValue(makePurchaseDTO({ status: "ACTIVE" })),
    // Audit F #4/#5: IvaBooks methods now wrap writes in repo.transaction.
    // Phase-1 (correlation-id-coverage): tx callback now invokes setAuditContext,
    // which calls tx.$executeRawUnsafe. Stub it as a no-op.
    transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({ $executeRawUnsafe: vi.fn().mockResolvedValue(undefined) }),
    ),
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
        expect.objectContaining({
          organizationId: ORG_ID,
          saleId: SALE_ID,
          userId: USER_ID,
          externalTx: expect.anything(),
          correlationId: expect.any(String),
        }),
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
        ...baseMonetary,
        importeTotal: D("226.00"),
      });

      expect(mocks.saleService.regenerateJournalForIvaChange).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ORG_ID,
          saleId: SALE_ID,
          userId: USER_ID,
          externalTx: expect.anything(),
          correlationId: expect.any(String),
        }),
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
        expect.objectContaining({
          organizationId: ORG_ID,
          saleId: SALE_ID,
          userId: USER_ID,
          externalTx: expect.anything(),
          correlationId: expect.any(String),
        }),
      );
    });
  });

  describe("reactivateSale — POSTED + OPEN → regenera journal (IVA path)", () => {
    it("llama a saleService.regenerateJournalForIvaChange cuando reactivate de IvaBook en venta POSTED", async () => {
      vi.mocked(mocks.saleService.getById).mockResolvedValueOnce({
        id: SALE_ID, status: "POSTED", periodId: PERIOD_ID,
        period: { id: PERIOD_ID, status: "OPEN" },
      } as never);

      await mocks.service.reactivateSale(ORG_ID, USER_ID, "iva-sale-book-id");

      expect(mocks.saleService.regenerateJournalForIvaChange).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ORG_ID,
          saleId: SALE_ID,
          userId: USER_ID,
          externalTx: expect.anything(),
          correlationId: expect.any(String),
        }),
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
        expect.objectContaining({
          organizationId: ORG_ID,
          purchaseId: PURCHASE_ID,
          userId: USER_ID,
          externalTx: expect.anything(),
          correlationId: expect.any(String),
        }),
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
        expect.objectContaining({
          organizationId: ORG_ID,
          purchaseId: PURCHASE_ID,
          userId: USER_ID,
          externalTx: expect.anything(),
          correlationId: expect.any(String),
        }),
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
        expect.objectContaining({
          organizationId: ORG_ID,
          purchaseId: PURCHASE_ID,
          userId: USER_ID,
          externalTx: expect.anything(),
          correlationId: expect.any(String),
        }),
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

// ── Regression T3 — reactivate LCV: buildSaleEntryLines WITH ivaBook produces IVA/IT lines ──

describe("Regression T3 — reactivate LCV: buildSaleEntryLines con ivaBook ACTIVE produce líneas IVA/IT", () => {
  const settings = {
    cxcAccountCode: "1.1.3",
    itExpenseAccountCode: "5.3.3",
    itPayableAccountCode: "2.1.7",
  };

  const details = [
    { lineAmount: 100, incomeAccountCode: "4.1.1", description: "Servicio A" },
  ];

  const ivaBook = {
    baseIvaSujetoCf: 100,
    dfCfIva: 13,
    importeTotal: 100,
    exentos: 0,
  };

  it("T3.1 — con ivaBook ACTIVE: genera línea IVA (2.1.6)", () => {
    const lines = buildSaleEntryLines(100, details, settings, "contact-01", ivaBook);
    const ivaLine = lines.find((l) => l.accountCode === "2.1.6");
    expect(ivaLine).toBeDefined();
  });

  it("T3.2 — con ivaBook ACTIVE: genera líneas IT (5.3.3 y 2.1.7)", () => {
    const lines = buildSaleEntryLines(100, details, settings, "contact-01", ivaBook);
    const itExpense = lines.find((l) => l.accountCode === "5.3.3");
    const itPayable = lines.find((l) => l.accountCode === "2.1.7");
    expect(itExpense).toBeDefined();
    expect(itPayable).toBeDefined();
  });

  it("T3.3 — con ivaBook ACTIVE: genera exactamente 5 líneas (DR CxC + CR ingreso + CR IVA + DR IT + CR IT)", () => {
    const lines = buildSaleEntryLines(100, details, settings, "contact-01", ivaBook);
    expect(lines).toHaveLength(5);
  });

  it("T3.4 — reactivate es inverso de unlink: voidSale produce 2 líneas, reactivate produce 5", () => {
    // Sin ivaBook (unlink / VOIDED path)
    const linesWithout = buildSaleEntryLines(100, details, settings, "contact-01");
    expect(linesWithout).toHaveLength(2);

    // Con ivaBook (reactivate / ACTIVE path)
    const linesWith = buildSaleEntryLines(100, details, settings, "contact-01", ivaBook);
    expect(linesWith).toHaveLength(5);
  });
});

// ── PR2 T2.5 — Regression: unlink produces journal WITHOUT IVA/IT lines ──────────
//
// Locks in the behavior described in REQ-A.3:
//   voidSale(ivaSalesBookId) → regenerateJournalForIvaChange is called on the
//   underlying sale → at the point of regen the IvaSalesBook is VOIDED →
//   buildSaleEntryLines receives ivaBookForEntry=undefined → non-IVA path →
//   journal has NO IVA (2.1.6) lines and NO IT lines.
//
// This test exercises buildSaleEntryLines in isolation to lock in the pure
// function behavior without needing to traverse the full service stack.

import { buildSaleEntryLines } from "@/features/sale/sale.utils";

describe("Regression T2.5 — unlink LCV: buildSaleEntryLines without ivaBook produces no IVA/IT lines", () => {
  const settings = {
    cxcAccountCode: "1.1.3",
    itExpenseAccountCode: "5.3.3",
    itPayableAccountCode: "2.1.7",
  };

  const details = [
    { lineAmount: 100, incomeAccountCode: "4.1.1", description: "Servicio A" },
  ];

  it("T2.5 — sin ivaBook: NO genera línea IVA (2.1.6)", () => {
    const lines = buildSaleEntryLines(100, details, settings, "contact-01");

    const ivaLine = lines.find((l) => l.accountCode === "2.1.6");
    expect(ivaLine).toBeUndefined();
  });

  it("T2.5 — sin ivaBook: NO genera líneas IT (5.3.3 / 2.1.7)", () => {
    const lines = buildSaleEntryLines(100, details, settings, "contact-01");

    const itExpense = lines.find((l) => l.accountCode === "5.3.3");
    const itPayable = lines.find((l) => l.accountCode === "2.1.7");
    expect(itExpense).toBeUndefined();
    expect(itPayable).toBeUndefined();
  });

  it("T2.5 — sin ivaBook: genera exactamente 2 líneas (1 DR CxC + 1 CR ingreso)", () => {
    const lines = buildSaleEntryLines(100, details, settings, "contact-01");
    expect(lines).toHaveLength(2);
  });

  it("T2.5 — con ivaBook ACTIVE: genera 5 líneas (DR CxC + CR ingreso + CR IVA + DR IT + CR IT)", () => {
    // Control para asegurar que el path CON IVA sigue funcionando (no regresión)
    const ivaBook = {
      baseIvaSujetoCf: 100,
      dfCfIva: 13,
      importeTotal: 100,
      exentos: 0,
    };
    const lines = buildSaleEntryLines(100, details, settings, "contact-01", ivaBook);
    expect(lines).toHaveLength(5);
    expect(lines.find((l) => l.accountCode === "2.1.6")).toBeDefined();
    expect(lines.find((l) => l.accountCode === "5.3.3")).toBeDefined();
    expect(lines.find((l) => l.accountCode === "2.1.7")).toBeDefined();
  });
});

// ── PR5 — recomputeFromPurchaseCascade (SC-21) ─────────────────────────────────

describe("IvaBooksService.recomputeFromPurchaseCascade — cascade desde PurchaseService.editPosted (PR5)", () => {
  const PURCHASE_ID_CASCADE = "purchase-cascade-pr5";
  const IVA_PURCHASE_ID = "iva-purchase-book-pr5";

  function makePurchaseIvaRow(overrides: Partial<IvaPurchaseBookDTO> = {}): IvaPurchaseBookDTO {
    return {
      id: IVA_PURCHASE_ID,
      organizationId: ORG_ID,
      fiscalPeriodId: PERIOD_ID,
      purchaseId: PURCHASE_ID_CASCADE,
      fechaFactura: "2025-03-15",
      nitProveedor: "7654321",
      razonSocial: "Proveedor Cascade Test",
      numeroFactura: "FAC-COMP-CASCADE-001",
      codigoAutorizacion: "AUTH-COMP-CASCADE-001",
      codigoControl: "",
      tipoCompra: 1,
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
      notes: undefined,
      importeTotal: D("100.00"),
      importeIce: ZERO,
      importeIehd: ZERO,
      importeIpj: ZERO,
      tasas: ZERO,
      otrosNoSujetos: ZERO,
      exentos: ZERO,
      tasaCero: ZERO,
      codigoDescuentoAdicional: ZERO,
      importeGiftCard: ZERO,
      subtotal: D("100.00"),
      dfIva: D("13.00"),
      baseIvaSujetoCf: D("100.00"),
      dfCfIva: D("13.00"),
      tasaIva: D("0.1300"),
      ...overrides,
    };
  }

  // SC-21: recomputa IvaPurchaseBook cuando cambia totalAmount
  it("SC-21 — recomputa IvaPurchaseBook con los campos derivados correctos cuando newTotal=200", async () => {
    const existingRow = makePurchaseIvaRow();
    const updateMock = vi.fn().mockResolvedValue({});
    const findFirstMock = vi.fn().mockResolvedValue(existingRow);

    const tx = {
      ivaPurchaseBook: {
        findFirst: findFirstMock,
        update: updateMock,
      },
    } as unknown as Prisma.TransactionClient;

    const { service } = createMocks();
    await service.recomputeFromPurchaseCascade(tx, ORG_ID, PURCHASE_ID_CASCADE, D("200.00"));

    expect(findFirstMock).toHaveBeenCalledWith({
      where: { purchaseId: PURCHASE_ID_CASCADE, organizationId: ORG_ID },
    });

    expect(updateMock).toHaveBeenCalledOnce();
    const updateCall = updateMock.mock.calls[0][0];
    expect(updateCall.where.id).toBe(IVA_PURCHASE_ID);

    // importeTotal debe ser 200
    expect(Number(updateCall.data.importeTotal)).toBeCloseTo(200, 2);
    // subtotal = 200 (sin deducciones), baseIvaSujetoCf = 200 (alícuota nominal: base = total)
    expect(Number(updateCall.data.subtotal)).toBeCloseTo(200, 2);
    expect(Number(updateCall.data.baseIvaSujetoCf)).toBeCloseTo(200, 0);
    // dfIva = dfCfIva = 200 × 0.13 = 26
    expect(Number(updateCall.data.dfIva)).toBeCloseTo(26, 0);
    expect(Number(updateCall.data.dfCfIva)).toBeCloseTo(26, 0);
    // tasaIva = 0.13
    expect(Number(updateCall.data.tasaIva)).toBeCloseTo(0.13, 4);
  });

  // SC-21 (no-op): retorna sin error cuando no existe IvaPurchaseBook para ese purchaseId
  it("SC-21 no-op — retorna silenciosamente cuando no hay IvaPurchaseBook vinculado", async () => {
    const findFirstMock = vi.fn().mockResolvedValue(null);
    const updateMock = vi.fn();

    const tx = {
      ivaPurchaseBook: {
        findFirst: findFirstMock,
        update: updateMock,
      },
    } as unknown as Prisma.TransactionClient;

    const { service } = createMocks();
    await expect(
      service.recomputeFromPurchaseCascade(tx, ORG_ID, PURCHASE_ID_CASCADE, D("200.00")),
    ).resolves.toBeUndefined();

    expect(updateMock).not.toHaveBeenCalled();
  });
});
