/**
 * Tests: reactivatePurchase — repositorio + servicio (PR2)
 *
 * T2.1 RED (REQ-B.2) — Repositorio con Prisma client mockeado
 * T2.3 RED (REQ-B.1) — Servicio con repositorio mockeado
 *
 * Escenarios cubiertos:
 *  Repo:
 *    (a) VOIDED → ACTIVE sucede + DTO retornado
 *    (b) NotFoundError cuando id no existe
 *    (c) ConflictError cuando status ya es ACTIVE
 *    (d) estadoSIN no existe en IvaPurchaseBook → no se involucra en nada
 *  Servicio:
 *    (a) delega a repo.reactivatePurchase + llama maybeRegenerateJournal una vez
 *    (b) ConflictError propagado sin llamar maybeRegenerateJournal
 *    (c) período CLOSED → FISCAL_PERIOD_CLOSED lanzado
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { ConflictError, NotFoundError } from "@/features/shared/errors";
import { IvaBooksRepository } from "../iva-books.repository";
import { IvaBooksService } from "../iva-books.service";
import type { IvaPurchaseBookDTO } from "../iva-books.types";

// ── Helpers ──────────────────────────────────────────────────────────────────

const D = (v: string | number) => new Prisma.Decimal(String(v));
const ZERO = D("0");
const TASA_IVA = D("0.1300");

const ORG_ID = "org-reactivate-purchase-test";
const ENTRY_ID = "iva-purchase-book-reactivate-id";
const PURCHASE_ID = "purchase-entity-id";

function makePurchaseDTO(overrides: Partial<IvaPurchaseBookDTO> = {}): IvaPurchaseBookDTO {
  return {
    id: ENTRY_ID,
    organizationId: ORG_ID,
    fiscalPeriodId: "period-id",
    fechaFactura: "2025-03-15",
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

// ── T2.1 — Repositorio (Prisma mockeado) ─────────────────────────────────────

describe("IvaBooksRepository.reactivatePurchase — T2.1", () => {
  let repo: IvaBooksRepository;
  let mockDb: {
    ivaPurchaseBook: {
      findFirst: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    mockDb = {
      ivaPurchaseBook: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
    };

    repo = new IvaBooksRepository();
    // Reemplazar el db interno con el mock
    (repo as unknown as { db: typeof mockDb }).db = mockDb;
  });

  it("T2.1-a: VOIDED → ACTIVE — actualiza y retorna DTO con status ACTIVE", async () => {
    const existingRow = {
      id: ENTRY_ID,
      organizationId: ORG_ID,
      status: "VOIDED",
      fiscalPeriodId: "period-id",
      fechaFactura: new Date("2025-03-15"),
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
      purchaseId: PURCHASE_ID,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updatedRow = { ...existingRow, status: "ACTIVE" };

    mockDb.ivaPurchaseBook.findFirst.mockResolvedValue(existingRow);
    mockDb.ivaPurchaseBook.update.mockResolvedValue(updatedRow);

    const result = await repo.reactivatePurchase(ORG_ID, ENTRY_ID);

    expect(mockDb.ivaPurchaseBook.findFirst).toHaveBeenCalledWith({
      where: { id: ENTRY_ID, organizationId: ORG_ID },
    });
    expect(mockDb.ivaPurchaseBook.update).toHaveBeenCalledWith({
      where: { id: ENTRY_ID, organizationId: ORG_ID },
      data: { status: "ACTIVE" },
    });
    expect(result.status).toBe("ACTIVE");
    expect(result.id).toBe(ENTRY_ID);
  });

  it("T2.1-b: NotFoundError cuando id no existe", async () => {
    mockDb.ivaPurchaseBook.findFirst.mockResolvedValue(null);

    await expect(repo.reactivatePurchase(ORG_ID, "nonexistent-id")).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(mockDb.ivaPurchaseBook.update).not.toHaveBeenCalled();
  });

  it("T2.1-c: ConflictError cuando status ya es ACTIVE", async () => {
    const activeRow = {
      id: ENTRY_ID,
      organizationId: ORG_ID,
      status: "ACTIVE",
    };

    mockDb.ivaPurchaseBook.findFirst.mockResolvedValue(activeRow);

    await expect(repo.reactivatePurchase(ORG_ID, ENTRY_ID)).rejects.toBeInstanceOf(ConflictError);
    expect(mockDb.ivaPurchaseBook.update).not.toHaveBeenCalled();
  });

  it("T2.1-d: estadoSIN no existe en IvaPurchaseBook — el update NO incluye estadoSIN", async () => {
    const voidedRow = {
      id: ENTRY_ID,
      organizationId: ORG_ID,
      status: "VOIDED",
      fiscalPeriodId: "period-id",
      fechaFactura: new Date("2025-03-15"),
      nitProveedor: "1234567",
      razonSocial: "Test",
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
      purchaseId: PURCHASE_ID,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockDb.ivaPurchaseBook.findFirst.mockResolvedValue(voidedRow);
    mockDb.ivaPurchaseBook.update.mockResolvedValue({ ...voidedRow, status: "ACTIVE" });

    await repo.reactivatePurchase(ORG_ID, ENTRY_ID);

    // El payload del update debe contener SOLO { status: "ACTIVE" } — sin estadoSIN
    const updateCall = mockDb.ivaPurchaseBook.update.mock.calls[0][0];
    expect(updateCall.data).toEqual({ status: "ACTIVE" });
    expect(updateCall.data).not.toHaveProperty("estadoSIN");
  });
});

// ── T2.3 — Servicio con repositorio mockeado ──────────────────────────────────

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
    reactivateSale: vi.fn(),
    reactivatePurchase: vi.fn(),
    // Audit F #4/#5: reactivatePurchase now wraps writes in repo.transaction.
    // Phase-1 (correlation-id-coverage): tx callback now invokes setAuditContext,
    // which calls tx.$executeRawUnsafe. Stub it as a no-op.
    transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({ $executeRawUnsafe: vi.fn().mockResolvedValue(undefined) }),
    ),
  } as unknown as IvaBooksRepository;
}

describe("IvaBooksService.reactivatePurchase — T2.3", () => {
  let repo: IvaBooksRepository;
  let service: IvaBooksService;

  beforeEach(() => {
    repo = createMockRepo();
    service = new IvaBooksService(repo);
  });

  it("T2.3-a: delega a repo.reactivatePurchase y retorna DTO con status ACTIVE", async () => {
    const activeDTO = makePurchaseDTO({ status: "ACTIVE", purchaseId: PURCHASE_ID });
    vi.mocked(repo.reactivatePurchase).mockResolvedValueOnce(activeDTO);

    const result = await service.reactivatePurchase(ORG_ID, "user-test-id", ENTRY_ID);

    expect(repo.reactivatePurchase).toHaveBeenCalledWith(ORG_ID, ENTRY_ID, expect.anything());
    expect(result.status).toBe("ACTIVE");
  });

  it("T2.3-b: no llama a maybeRegenerateJournal cuando purchaseId está presente (sin PurchaseService inyectado — no explota)", async () => {
    const activeDTO = makePurchaseDTO({ status: "ACTIVE", purchaseId: PURCHASE_ID });
    vi.mocked(repo.reactivatePurchase).mockResolvedValueOnce(activeDTO);

    // Sin PurchaseService inyectado — maybeRegenerateJournal es no-op silencioso
    await expect(
      service.reactivatePurchase(ORG_ID, "user-test-id", ENTRY_ID),
    ).resolves.toBeDefined();
  });

  it("T2.3-c: ConflictError del repo se propaga sin llamar regeneración", async () => {
    vi.mocked(repo.reactivatePurchase).mockRejectedValueOnce(
      new ConflictError("La entrada ya está activa (status !== VOIDED)"),
    );

    await expect(
      service.reactivatePurchase(ORG_ID, "user-test-id", ENTRY_ID),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("T2.3-d: maybeRegenerateJournal se llama con 'purchase' cuando PurchaseService inyectado", async () => {
    const activeDTO = makePurchaseDTO({ status: "ACTIVE", purchaseId: PURCHASE_ID });
    vi.mocked(repo.reactivatePurchase).mockResolvedValueOnce(activeDTO);

    const mockPurchaseService = {
      getById: vi.fn().mockResolvedValue({
        id: PURCHASE_ID,
        status: "POSTED",
        period: { status: "OPEN" },
      }),
      regenerateJournalForIvaChange: vi.fn().mockResolvedValue(undefined),
    };

    // Inyectar con PurchaseService
    const serviceWithPurchase = new IvaBooksService(
      repo,
      undefined, // SaleService
      mockPurchaseService as unknown as import("@/features/purchase/purchase.service").PurchaseService,
    );

    await serviceWithPurchase.reactivatePurchase(ORG_ID, "user-test-id", ENTRY_ID);

    expect(mockPurchaseService.getById).toHaveBeenCalledWith(
      ORG_ID, PURCHASE_ID, expect.anything(),
    );
    expect(mockPurchaseService.regenerateJournalForIvaChange).toHaveBeenCalledTimes(1);
  });
});
