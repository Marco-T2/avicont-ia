/**
 * PR2 — iva-books-repo-noon-utc (RED → GREEN)
 *
 * Verifica que IvaBooksRepository normalice fechaFactura a UTC-noon al persistir.
 * REQ-E.1: fechaFactura input "YYYY-MM-DD" debe almacenarse como noon UTC.
 *
 * Cubre los 4 write sites:
 * (a) createPurchase — line 189
 * (b) updatePurchase — line 258
 * (c) createSale     — line 317
 * (d) updateSale     — line 378
 *
 * También verifica que full ISO input sea manejado correctamente (toNoonUtc slice-first).
 *
 * All external dependencies are mocked — no DB access.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { IvaBooksRepository } from "../iva-books.repository";
import { IvaSalesEstadoSIN } from "@/generated/prisma/enums";

// ── Mock del cliente Prisma ───────────────────────────────────────────────────

const mockIvaPurchaseCreate = vi.fn();
const mockIvaPurchaseUpdate = vi.fn();
const mockIvaPurchaseFindFirst = vi.fn();
const mockIvaSalesCreate = vi.fn();
const mockIvaSalesUpdate = vi.fn();
const mockIvaSalesFindFirst = vi.fn();

const mockDb = {
  ivaPurchaseBook: {
    create: mockIvaPurchaseCreate,
    update: mockIvaPurchaseUpdate,
    findFirst: mockIvaPurchaseFindFirst,
    findMany: vi.fn(),
    count: vi.fn(),
  },
  ivaSalesBook: {
    create: mockIvaSalesCreate,
    update: mockIvaSalesUpdate,
    findFirst: mockIvaSalesFindFirst,
    findMany: vi.fn(),
    count: vi.fn(),
  },
  organizationMembership: { findFirst: vi.fn() },
  $transaction: vi.fn(),
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const D = (v: string | number) => new Prisma.Decimal(String(v));
const ZERO = D("0");
const TASA_IVA = D("0.1300");

function makePurchaseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "iva-purchase-1",
    organizationId: "org-1",
    fiscalPeriodId: "period-1",
    purchaseId: null,
    fechaFactura: new Date("2026-04-17T12:00:00.000Z"),
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
    subtotal: D("869.57"),
    dfIva: D("130.43"),
    baseIvaSujetoCf: D("869.57"),
    dfCfIva: D("130.43"),
    codigoDescuentoAdicional: ZERO,
    importeGiftCard: ZERO,
    tasaIva: TASA_IVA,
    status: "ACTIVE",
    estadoSIN: "V",
    ...overrides,
  };
}

function makeSaleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "iva-sale-1",
    organizationId: "org-1",
    fiscalPeriodId: "period-1",
    saleId: null,
    fechaFactura: new Date("2026-04-17T12:00:00.000Z"),
    nitCliente: "7654321",
    razonSocial: "Cliente Test",
    numeroFactura: "FACT-001",
    codigoAutorizacion: "AUTH-SALE-001",
    codigoControl: "",
    importeTotal: D("1000.00"),
    importeIce: ZERO,
    importeIehd: ZERO,
    importeIpj: ZERO,
    tasas: ZERO,
    otrosNoSujetos: ZERO,
    exentos: ZERO,
    tasaCero: ZERO,
    subtotal: D("869.57"),
    dfIva: D("130.43"),
    baseIvaSujetoCf: D("869.57"),
    dfCfIva: D("130.43"),
    codigoDescuentoAdicional: ZERO,
    importeGiftCard: ZERO,
    tasaIva: TASA_IVA,
    status: "ACTIVE",
    estadoSIN: "V",
    ...overrides,
  };
}

const BASE_PURCHASE_INPUT = {
  fechaFactura: "2026-04-17",
  nitProveedor: "1234567",
  razonSocial: "Proveedor Test",
  numeroFactura: "FAC-001",
  codigoAutorizacion: "AUTH-001",
  codigoControl: "",
  tipoCompra: 1 as const,
  fiscalPeriodId: "period-1",
  importeTotal: D("1000.00"),
  importeIce: ZERO,
  importeIehd: ZERO,
  importeIpj: ZERO,
  tasas: ZERO,
  otrosNoSujetos: ZERO,
  exentos: ZERO,
  tasaCero: ZERO,
  subtotal: D("869.57"),
  dfIva: D("130.43"),
  baseIvaSujetoCf: D("869.57"),
  dfCfIva: D("130.43"),
  codigoDescuentoAdicional: ZERO,
  importeGiftCard: ZERO,
  tasaIva: TASA_IVA,
};

const BASE_SALE_INPUT = {
  fechaFactura: "2026-04-17",
  estadoSIN: IvaSalesEstadoSIN.V,
  nitCliente: "7654321",
  razonSocial: "Cliente Test",
  numeroFactura: "FACT-001",
  codigoAutorizacion: "AUTH-SALE-001",
  codigoControl: "",
  fiscalPeriodId: "period-1",
  importeTotal: D("1000.00"),
  importeIce: ZERO,
  importeIehd: ZERO,
  importeIpj: ZERO,
  tasas: ZERO,
  otrosNoSujetos: ZERO,
  exentos: ZERO,
  tasaCero: ZERO,
  subtotal: D("869.57"),
  dfIva: D("130.43"),
  baseIvaSujetoCf: D("869.57"),
  dfCfIva: D("130.43"),
  codigoDescuentoAdicional: ZERO,
  importeGiftCard: ZERO,
  tasaIva: TASA_IVA,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("IvaBooksRepository — noon-UTC normalization (REQ-E.1)", () => {
  let repo: IvaBooksRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    repo = new IvaBooksRepository(mockDb as any);
    mockIvaPurchaseCreate.mockResolvedValue(makePurchaseRow());
    mockIvaPurchaseFindFirst.mockResolvedValue(makePurchaseRow());
    mockIvaPurchaseUpdate.mockResolvedValue(makePurchaseRow());
    mockIvaSalesCreate.mockResolvedValue(makeSaleRow());
    mockIvaSalesFindFirst.mockResolvedValue(makeSaleRow());
    mockIvaSalesUpdate.mockResolvedValue(makeSaleRow());
  });

  it("(a) createPurchase() stores fechaFactura as noon UTC for bare 'YYYY-MM-DD'", async () => {
    await repo.createPurchase("org-1", BASE_PURCHASE_INPUT);

    expect(mockIvaPurchaseCreate).toHaveBeenCalledOnce();
    const callArgs = mockIvaPurchaseCreate.mock.calls[0][0];
    const storedDate: Date = callArgs.data.fechaFactura;

    expect(storedDate).toBeInstanceOf(Date);
    expect(storedDate.toISOString()).toBe("2026-04-17T12:00:00.000Z");
  });

  it("(a2) createPurchase() handles full ISO input via slice-first", async () => {
    await repo.createPurchase("org-1", {
      ...BASE_PURCHASE_INPUT,
      fechaFactura: "2026-04-17T00:00:00.000Z",
    });

    const callArgs = mockIvaPurchaseCreate.mock.calls[0][0];
    expect(callArgs.data.fechaFactura.toISOString()).toBe("2026-04-17T12:00:00.000Z");
  });

  it("(b) updatePurchase() stores fechaFactura as noon UTC when provided", async () => {
    await repo.updatePurchase("org-1", "iva-purchase-1", {
      fechaFactura: "2026-04-17",
    });

    expect(mockIvaPurchaseUpdate).toHaveBeenCalledOnce();
    const callArgs = mockIvaPurchaseUpdate.mock.calls[0][0];
    const storedDate: Date = callArgs.data.fechaFactura;

    expect(storedDate).toBeInstanceOf(Date);
    expect(storedDate.toISOString()).toBe("2026-04-17T12:00:00.000Z");
  });

  it("(c) createSale() stores fechaFactura as noon UTC for bare 'YYYY-MM-DD'", async () => {
    await repo.createSale("org-1", BASE_SALE_INPUT);

    expect(mockIvaSalesCreate).toHaveBeenCalledOnce();
    const callArgs = mockIvaSalesCreate.mock.calls[0][0];
    const storedDate: Date = callArgs.data.fechaFactura;

    expect(storedDate).toBeInstanceOf(Date);
    expect(storedDate.toISOString()).toBe("2026-04-17T12:00:00.000Z");
  });

  it("(c2) createSale() handles full ISO input via slice-first", async () => {
    await repo.createSale("org-1", {
      ...BASE_SALE_INPUT,
      fechaFactura: "2026-04-17T00:00:00.000Z",
    });

    const callArgs = mockIvaSalesCreate.mock.calls[0][0];
    expect(callArgs.data.fechaFactura.toISOString()).toBe("2026-04-17T12:00:00.000Z");
  });

  it("(d) updateSale() stores fechaFactura as noon UTC when provided", async () => {
    await repo.updateSale("org-1", "iva-sale-1", {
      fechaFactura: "2026-04-17",
    });

    expect(mockIvaSalesUpdate).toHaveBeenCalledOnce();
    const callArgs = mockIvaSalesUpdate.mock.calls[0][0];
    const storedDate: Date = callArgs.data.fechaFactura;

    expect(storedDate).toBeInstanceOf(Date);
    expect(storedDate.toISOString()).toBe("2026-04-17T12:00:00.000Z");
  });
});
