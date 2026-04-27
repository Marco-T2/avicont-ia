/**
 * Phase 1 — setAuditContext coverage (correlation-id-coverage).
 *
 * Verifies that mutation methods on IvaBooksService set the audit context
 * (app.current_user_id / app.current_organization_id) as the FIRST statement
 * inside the tx callback.
 *
 * Sites covered in this file:
 *   B6  — createPurchase()      (POSTED + OPEN regen path — has outer tx)
 *   B7  — updatePurchase()
 *   B8  — voidPurchase()
 *   B9  — createSale()          (POSTED + OPEN regen path — has outer tx)
 *   B10 — updateSale()
 *   B11 — voidSale()
 *   B12 — reactivateSale()
 *   B13 — reactivatePurchase()
 *
 * Phase 2 (correlationId / WithCorrelation) is OUT OF SCOPE here.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import * as auditCtx from "@/features/shared/audit-context";
import { IvaBooksService } from "../iva-books.service";
import { IvaBooksRepository } from "../iva-books.repository";
import type {
  IvaPurchaseBookDTO,
  IvaSalesBookDTO,
} from "../iva-books.types";

const D = (v: string | number) => new Prisma.Decimal(String(v));
const ZERO = D("0");
const TASA_IVA = D("0.1300");

const ORG_ID = "org-audit-iva";
const USER_ID = "user-audit-001";
const FISCAL_PERIOD_ID = "period-audit-001";
const FECHA = "2025-03-15";

function basePurchaseInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    fechaFactura: FECHA,
    nitProveedor: "1234567",
    razonSocial: "Proveedor Test",
    numeroFactura: "FAC-001",
    codigoAutorizacion: "AUTH-001",
    codigoControl: "",
    tipoCompra: 1,
    fiscalPeriodId: FISCAL_PERIOD_ID,
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
    subtotal: ZERO,
    dfIva: ZERO,
    baseIvaSujetoCf: ZERO,
    dfCfIva: ZERO,
    tasaIva: ZERO,
    ...overrides,
  };
}

function baseSaleInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    fechaFactura: FECHA,
    nitCliente: "7654321",
    razonSocial: "Cliente Test",
    numeroFactura: "FAC-SALE-001",
    codigoAutorizacion: "AUTH-SALE-001",
    codigoControl: "",
    estadoSIN: "A" as const,
    fiscalPeriodId: FISCAL_PERIOD_ID,
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
    ...overrides,
  };
}

function makePurchaseDTO(overrides: Partial<IvaPurchaseBookDTO> = {}): IvaPurchaseBookDTO {
  return {
    id: "purchase-book-id",
    organizationId: ORG_ID,
    fiscalPeriodId: FISCAL_PERIOD_ID,
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
    organizationId: ORG_ID,
    fiscalPeriodId: FISCAL_PERIOD_ID,
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
    reactivatePurchase: vi.fn(),
    reactivateSale: vi.fn(),
    transaction: vi
      .fn()
      .mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb({})),
  } as unknown as IvaBooksRepository;
}

describe("IvaBooksService — Phase 1 setAuditContext coverage", () => {
  let setAuditContextSpy: ReturnType<typeof vi.spyOn>;
  let repo: IvaBooksRepository;
  let service: IvaBooksService;

  beforeEach(() => {
    setAuditContextSpy = vi
      .spyOn(auditCtx, "setAuditContext")
      .mockResolvedValue(undefined);
    repo = createMockRepo();
    service = new IvaBooksService(repo);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── B6: createPurchase() — POSTED + OPEN regen path enters the outer tx ────
  it("B6: createPurchase() — POSTED+OPEN path calls setAuditContext FIRST inside tx", async () => {
    const purchaseId = "purchase-001";
    const purchaseService = {
      getById: vi.fn().mockResolvedValue({
        id: purchaseId,
        status: "POSTED",
        period: { status: "OPEN" },
      }),
      regenerateJournalForIvaChange: vi.fn().mockResolvedValue(undefined),
    };
    service = new IvaBooksService(
      repo,
      undefined,
      purchaseService as never,
    );
    vi.mocked(repo.createPurchase).mockResolvedValue(makePurchaseDTO());

    await service.createPurchase(
      ORG_ID,
      USER_ID,
      basePurchaseInput({ purchaseId }),
    );

    expect(setAuditContextSpy).toHaveBeenCalledTimes(1);
    // Phase 2: withAuditTx invokes setAuditContext with 5 args
    // (tx, userId, orgId, justification|undefined, correlationId).
    // Phase 1 contract — userId + orgId in slots 2/3 — remains intact.
    expect(setAuditContextSpy).toHaveBeenCalledWith(
      expect.any(Object),
      USER_ID,
      ORG_ID,
      undefined,
      expect.any(String),
    );

    const auditOrder = setAuditContextSpy.mock.invocationCallOrder[0];
    const createOrder = (
      repo.createPurchase as unknown as ReturnType<typeof vi.fn>
    ).mock.invocationCallOrder[0];
    expect(auditOrder).toBeLessThan(createOrder);
  });

  // ── B7: updatePurchase() ───────────────────────────────────────────────────
  it("B7: updatePurchase() calls setAuditContext FIRST inside tx", async () => {
    vi.mocked(repo.updatePurchase).mockResolvedValue(makePurchaseDTO());

    await service.updatePurchase(ORG_ID, USER_ID, "purchase-book-id", {
      numeroFactura: "FAC-002",
    });

    expect(setAuditContextSpy).toHaveBeenCalledTimes(1);
    // Phase 2: withAuditTx invokes setAuditContext with 5 args
    // (tx, userId, orgId, justification|undefined, correlationId).
    // Phase 1 contract — userId + orgId in slots 2/3 — remains intact.
    expect(setAuditContextSpy).toHaveBeenCalledWith(
      expect.any(Object),
      USER_ID,
      ORG_ID,
      undefined,
      expect.any(String),
    );

    const auditOrder = setAuditContextSpy.mock.invocationCallOrder[0];
    const updateOrder = (
      repo.updatePurchase as unknown as ReturnType<typeof vi.fn>
    ).mock.invocationCallOrder[0];
    expect(auditOrder).toBeLessThan(updateOrder);
  });

  // ── B8: voidPurchase() ─────────────────────────────────────────────────────
  it("B8: voidPurchase() calls setAuditContext FIRST inside tx", async () => {
    vi.mocked(repo.voidPurchase).mockResolvedValue(
      makePurchaseDTO({ status: "VOIDED" }),
    );

    await service.voidPurchase(ORG_ID, USER_ID, "purchase-book-id");

    expect(setAuditContextSpy).toHaveBeenCalledTimes(1);
    // Phase 2: withAuditTx invokes setAuditContext with 5 args
    // (tx, userId, orgId, justification|undefined, correlationId).
    // Phase 1 contract — userId + orgId in slots 2/3 — remains intact.
    expect(setAuditContextSpy).toHaveBeenCalledWith(
      expect.any(Object),
      USER_ID,
      ORG_ID,
      undefined,
      expect.any(String),
    );

    const auditOrder = setAuditContextSpy.mock.invocationCallOrder[0];
    const voidOrder = (
      repo.voidPurchase as unknown as ReturnType<typeof vi.fn>
    ).mock.invocationCallOrder[0];
    expect(auditOrder).toBeLessThan(voidOrder);
  });

  // ── B9: createSale() — POSTED + OPEN regen path enters the outer tx ───────
  it("B9: createSale() — POSTED+OPEN path calls setAuditContext FIRST inside tx", async () => {
    const saleId = "sale-001";
    const saleService = {
      getById: vi.fn().mockResolvedValue({
        id: saleId,
        status: "POSTED",
        period: { status: "OPEN" },
      }),
      regenerateJournalForIvaChange: vi.fn().mockResolvedValue(undefined),
    };
    service = new IvaBooksService(
      repo,
      saleService as never,
      undefined,
    );
    vi.mocked(repo.createSale).mockResolvedValue(makeSaleDTO());

    await service.createSale(
      ORG_ID,
      USER_ID,
      baseSaleInput({ saleId }),
    );

    expect(setAuditContextSpy).toHaveBeenCalledTimes(1);
    // Phase 2: withAuditTx invokes setAuditContext with 5 args
    // (tx, userId, orgId, justification|undefined, correlationId).
    // Phase 1 contract — userId + orgId in slots 2/3 — remains intact.
    expect(setAuditContextSpy).toHaveBeenCalledWith(
      expect.any(Object),
      USER_ID,
      ORG_ID,
      undefined,
      expect.any(String),
    );

    const auditOrder = setAuditContextSpy.mock.invocationCallOrder[0];
    const createOrder = (
      repo.createSale as unknown as ReturnType<typeof vi.fn>
    ).mock.invocationCallOrder[0];
    expect(auditOrder).toBeLessThan(createOrder);
  });

  // ── B10: updateSale() ──────────────────────────────────────────────────────
  it("B10: updateSale() calls setAuditContext FIRST inside tx", async () => {
    vi.mocked(repo.updateSale).mockResolvedValue(makeSaleDTO());

    await service.updateSale(ORG_ID, USER_ID, "sale-book-id", {
      numeroFactura: "FAC-SALE-002",
    });

    expect(setAuditContextSpy).toHaveBeenCalledTimes(1);
    // Phase 2: withAuditTx invokes setAuditContext with 5 args
    // (tx, userId, orgId, justification|undefined, correlationId).
    // Phase 1 contract — userId + orgId in slots 2/3 — remains intact.
    expect(setAuditContextSpy).toHaveBeenCalledWith(
      expect.any(Object),
      USER_ID,
      ORG_ID,
      undefined,
      expect.any(String),
    );

    const auditOrder = setAuditContextSpy.mock.invocationCallOrder[0];
    const updateOrder = (
      repo.updateSale as unknown as ReturnType<typeof vi.fn>
    ).mock.invocationCallOrder[0];
    expect(auditOrder).toBeLessThan(updateOrder);
  });

  // ── B11: voidSale() ────────────────────────────────────────────────────────
  it("B11: voidSale() calls setAuditContext FIRST inside tx", async () => {
    vi.mocked(repo.voidSale).mockResolvedValue(makeSaleDTO({ status: "VOIDED" }));

    await service.voidSale(ORG_ID, USER_ID, "sale-book-id");

    expect(setAuditContextSpy).toHaveBeenCalledTimes(1);
    // Phase 2: withAuditTx invokes setAuditContext with 5 args
    // (tx, userId, orgId, justification|undefined, correlationId).
    // Phase 1 contract — userId + orgId in slots 2/3 — remains intact.
    expect(setAuditContextSpy).toHaveBeenCalledWith(
      expect.any(Object),
      USER_ID,
      ORG_ID,
      undefined,
      expect.any(String),
    );

    const auditOrder = setAuditContextSpy.mock.invocationCallOrder[0];
    const voidOrder = (
      repo.voidSale as unknown as ReturnType<typeof vi.fn>
    ).mock.invocationCallOrder[0];
    expect(auditOrder).toBeLessThan(voidOrder);
  });

  // ── B12: reactivateSale() ──────────────────────────────────────────────────
  it("B12: reactivateSale() calls setAuditContext FIRST inside tx", async () => {
    vi.mocked(repo.reactivateSale).mockResolvedValue(
      makeSaleDTO({ status: "ACTIVE" }),
    );

    await service.reactivateSale(ORG_ID, USER_ID, "sale-book-id");

    expect(setAuditContextSpy).toHaveBeenCalledTimes(1);
    // Phase 2: withAuditTx invokes setAuditContext with 5 args
    // (tx, userId, orgId, justification|undefined, correlationId).
    // Phase 1 contract — userId + orgId in slots 2/3 — remains intact.
    expect(setAuditContextSpy).toHaveBeenCalledWith(
      expect.any(Object),
      USER_ID,
      ORG_ID,
      undefined,
      expect.any(String),
    );

    const auditOrder = setAuditContextSpy.mock.invocationCallOrder[0];
    const reactOrder = (
      repo.reactivateSale as unknown as ReturnType<typeof vi.fn>
    ).mock.invocationCallOrder[0];
    expect(auditOrder).toBeLessThan(reactOrder);
  });

  // ── B13: reactivatePurchase() ──────────────────────────────────────────────
  it("B13: reactivatePurchase() calls setAuditContext FIRST inside tx", async () => {
    vi.mocked(repo.reactivatePurchase).mockResolvedValue(
      makePurchaseDTO({ status: "ACTIVE" }),
    );

    await service.reactivatePurchase(ORG_ID, USER_ID, "purchase-book-id");

    expect(setAuditContextSpy).toHaveBeenCalledTimes(1);
    // Phase 2: withAuditTx invokes setAuditContext with 5 args
    // (tx, userId, orgId, justification|undefined, correlationId).
    // Phase 1 contract — userId + orgId in slots 2/3 — remains intact.
    expect(setAuditContextSpy).toHaveBeenCalledWith(
      expect.any(Object),
      USER_ID,
      ORG_ID,
      undefined,
      expect.any(String),
    );

    const auditOrder = setAuditContextSpy.mock.invocationCallOrder[0];
    const reactOrder = (
      repo.reactivatePurchase as unknown as ReturnType<typeof vi.fn>
    ).mock.invocationCallOrder[0];
    expect(auditOrder).toBeLessThan(reactOrder);
  });
});
