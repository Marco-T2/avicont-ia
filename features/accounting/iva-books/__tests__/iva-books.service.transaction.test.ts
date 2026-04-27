/**
 * Audit F #4/#5 RED — IvaBooksService transaction boundary contract.
 *
 * Covers the Audit F (2026-04-23 scan) finding: IvaBooksService writes to the
 * IvaBook table AND then calls `saleService/purchaseService.regenerateJournalForIvaChange(...)`
 * WITHOUT a unifying transaction. If the IVA write commits but the journal
 * regeneration fails, the IVA fields and the journal entries diverge — audit
 * trail broken, totals don't match.
 *
 * Audit flagged #4 (updatePurchase) and #5 (createPurchase), but the fix must
 * cover all 8 cross-service IVA↔journal flows (Option A — full refactor):
 *   createPurchase, updatePurchase, voidPurchase, reactivatePurchase,
 *   createSale,     updateSale,     voidSale,     reactivateSale.
 *
 * Contract under test (GREEN):
 *   - The IVA-book write and the downstream `regenerateJournalForIvaChange`
 *     MUST run inside a single `repo.transaction(...)` call.
 *   - The `tx` client MUST be threaded into:
 *       repo.<ivaWrite>(..., tx)
 *       purchaseService.getById(orgId, id, tx)
 *       purchaseService.regenerateJournalForIvaChange(orgId, id, userId, tx)
 *     (and sale equivalents).
 *   - When the regen throws, the tx callback must propagate (so the parent tx
 *     rolls back the IVA write). It must NOT be swallowed.
 *
 * Expected failure mode on current (pre-fix) code:
 *   - F-4-S1 (updatePurchase): `repo.transaction` has 0 calls (expected 1).
 *   - F-4-S2 (createPurchase): `repo.transaction` has 0 calls (expected 1).
 *   - F-4-S3 (voidPurchase):   `repo.transaction` has 0 calls (expected 1).
 *   - F-4-S4 (updateSale):     `repo.transaction` has 0 calls (expected 1).
 *   - F-4-S5 (rollback propagation): current code calls regen OUTSIDE any tx,
 *       so there is no outer callback to propagate through; assertion on the
 *       tx-callback throwing fails because `repo.transaction` is never invoked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { IvaBooksService } from "../iva-books.service";
import { IvaBooksRepository } from "../iva-books.repository";
import type { IvaPurchaseBookDTO, IvaSalesBookDTO } from "../iva-books.types";

const D = (v: string | number) => new Prisma.Decimal(String(v));
const ZERO = D("0");
const TASA_IVA = D("0.1300");

const orgId = "org-tx";
const userId = "user-tx";
const fiscalPeriodId = "period-tx";
const FECHA = "2025-03-15";
const PURCHASE_ID = "purchase-1";
const SALE_ID = "sale-1";
const IVA_PURCHASE_BOOK_ID = "iva-purchase-1";
const IVA_SALE_BOOK_ID = "iva-sale-1";

// ── Fixtures ──

const basePurchaseInput = {
  fechaFactura: FECHA,
  nitProveedor: "1234567",
  razonSocial: "Proveedor Test",
  numeroFactura: "FAC-001",
  codigoAutorizacion: "AUTH-001",
  codigoControl: "",
  tipoCompra: 1,
  fiscalPeriodId,
  purchaseId: PURCHASE_ID,
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
  saleId: SALE_ID,
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

function makePurchaseDTO(overrides: Partial<IvaPurchaseBookDTO> = {}): IvaPurchaseBookDTO {
  return {
    id: IVA_PURCHASE_BOOK_ID,
    organizationId: orgId,
    fiscalPeriodId,
    purchaseId: PURCHASE_ID,
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
    id: IVA_SALE_BOOK_ID,
    organizationId: orgId,
    fiscalPeriodId,
    saleId: SALE_ID,
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

// ── Service factory ──

type Harness = ReturnType<typeof buildHarness>;

function buildHarness() {
  // Sentinel tx client — identity-compared in assertions.
  // Phase-1 (correlation-id-coverage): tx callback now invokes setAuditContext,
  // which calls tx.$executeRawUnsafe. Stub it as a no-op so this test continues
  // to assert the SAME tx instance flows through to repo writes + regen.
  const txClient = {
    __tx: true,
    $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
  } as unknown as Prisma.TransactionClient;

  const repo = {
    createPurchase: vi.fn().mockResolvedValue(makePurchaseDTO()),
    createSale: vi.fn().mockResolvedValue(makeSaleDTO()),
    updatePurchase: vi.fn().mockResolvedValue(makePurchaseDTO()),
    updateSale: vi.fn().mockResolvedValue(makeSaleDTO()),
    voidPurchase: vi.fn().mockResolvedValue(makePurchaseDTO({ status: "VOIDED" })),
    voidSale: vi.fn().mockResolvedValue(makeSaleDTO({ status: "VOIDED" })),
    reactivatePurchase: vi.fn().mockResolvedValue(makePurchaseDTO()),
    reactivateSale: vi.fn().mockResolvedValue(makeSaleDTO()),
    findPurchaseById: vi.fn().mockResolvedValue(makePurchaseDTO()),
    findSaleById: vi.fn().mockResolvedValue(makeSaleDTO()),
    listPurchasesByPeriod: vi.fn().mockResolvedValue([]),
    listSalesByPeriod: vi.fn().mockResolvedValue([]),
    transaction: vi
      .fn()
      .mockImplementation(async (cb: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
        cb(txClient),
      ),
  } as unknown as IvaBooksRepository;

  const purchaseService = {
    getById: vi.fn().mockResolvedValue({
      id: PURCHASE_ID,
      status: "POSTED",
      periodId: fiscalPeriodId,
      period: { id: fiscalPeriodId, status: "OPEN" },
    }),
    regenerateJournalForIvaChange: vi.fn().mockResolvedValue(undefined),
  };

  const saleService = {
    getById: vi.fn().mockResolvedValue({
      id: SALE_ID,
      status: "POSTED",
      periodId: fiscalPeriodId,
      period: { id: fiscalPeriodId, status: "OPEN" },
    }),
    regenerateJournalForIvaChange: vi.fn().mockResolvedValue(undefined),
  };

  const service = new IvaBooksService(
    repo,
    saleService as never,
    purchaseService as never,
  );

  return { repo, purchaseService, saleService, service, txClient };
}

function lastArg(call: unknown[]): unknown {
  return call[call.length - 1];
}

/**
 * Phase 2: regenerateJournalForIvaChange takes a single options object
 * `{ organizationId, ...Id, userId, externalTx, correlationId }`.
 * This helper extracts the externalTx for tx-threading assertions.
 */
function regenExternalTx(call: unknown[]): unknown {
  const opts = call[0] as { externalTx?: unknown };
  return opts?.externalTx;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("IvaBooksService — transaction boundary (Audit F #4/#5)", () => {
  // ── F-4-S1 ──────────────────────────────────────────────────────────────
  it("F-4-S1 updatePurchase wraps IVA write + regen in a single repo.transaction", async () => {
    const h = buildHarness();

    await h.service.updatePurchase(orgId, userId, IVA_PURCHASE_BOOK_ID, {
      importeTotal: D("1100.00"),
    });

    expect(h.repo.transaction).toHaveBeenCalledTimes(1);

    const updatePurchaseCall = vi.mocked(h.repo.updatePurchase).mock.calls.at(-1)!;
    expect(lastArg(updatePurchaseCall)).toBe(h.txClient);

    expect(h.purchaseService.regenerateJournalForIvaChange).toHaveBeenCalledTimes(1);
    const regenCall = h.purchaseService.regenerateJournalForIvaChange.mock.calls.at(-1)!;
    expect(regenExternalTx(regenCall)).toBe(h.txClient);
  });

  // ── F-4-S2 ──────────────────────────────────────────────────────────────
  it("F-4-S2 createPurchase (POSTED + OPEN) wraps IVA write + regen in a single repo.transaction", async () => {
    const h = buildHarness();

    await h.service.createPurchase(orgId, userId, basePurchaseInput);

    expect(h.repo.transaction).toHaveBeenCalledTimes(1);

    const createPurchaseCall = vi.mocked(h.repo.createPurchase).mock.calls.at(-1)!;
    expect(lastArg(createPurchaseCall)).toBe(h.txClient);

    expect(h.purchaseService.regenerateJournalForIvaChange).toHaveBeenCalledTimes(1);
    const regenCall = h.purchaseService.regenerateJournalForIvaChange.mock.calls.at(-1)!;
    expect(regenExternalTx(regenCall)).toBe(h.txClient);
  });

  // ── F-4-S3 ──────────────────────────────────────────────────────────────
  it("F-4-S3 voidPurchase wraps void + regen in a single repo.transaction", async () => {
    const h = buildHarness();

    await h.service.voidPurchase(orgId, userId, IVA_PURCHASE_BOOK_ID);

    expect(h.repo.transaction).toHaveBeenCalledTimes(1);

    const voidCall = vi.mocked(h.repo.voidPurchase).mock.calls.at(-1)!;
    expect(lastArg(voidCall)).toBe(h.txClient);

    expect(h.purchaseService.regenerateJournalForIvaChange).toHaveBeenCalledTimes(1);
    const regenCall = h.purchaseService.regenerateJournalForIvaChange.mock.calls.at(-1)!;
    expect(regenExternalTx(regenCall)).toBe(h.txClient);
  });

  // ── F-4-S4 ──────────────────────────────────────────────────────────────
  it("F-4-S4 updateSale wraps IVA write + regen in a single repo.transaction", async () => {
    const h = buildHarness();

    await h.service.updateSale(orgId, userId, IVA_SALE_BOOK_ID, {
      importeTotal: D("2200.00"),
    });

    expect(h.repo.transaction).toHaveBeenCalledTimes(1);

    const updateSaleCall = vi.mocked(h.repo.updateSale).mock.calls.at(-1)!;
    expect(lastArg(updateSaleCall)).toBe(h.txClient);

    expect(h.saleService.regenerateJournalForIvaChange).toHaveBeenCalledTimes(1);
    const regenCall = h.saleService.regenerateJournalForIvaChange.mock.calls.at(-1)!;
    expect(regenExternalTx(regenCall)).toBe(h.txClient);
  });

  // ── F-4-S5 ──────────────────────────────────────────────────────────────
  it("F-4-S5 when purchaseService.regenerateJournalForIvaChange throws, the tx callback throws so parent can rollback", async () => {
    const h = buildHarness();

    const boom = new Error("journal regen failed");
    h.purchaseService.regenerateJournalForIvaChange.mockRejectedValue(boom);

    // If the regen is NOT inside the tx, the tx callback won't throw — it will
    // never even be invoked (current code doesn't call repo.transaction at all).
    // Either way this assertion fails on pre-fix code.
    await expect(
      h.service.updatePurchase(orgId, userId, IVA_PURCHASE_BOOK_ID, {
        importeTotal: D("1100.00"),
      }),
    ).rejects.toThrow("journal regen failed");

    expect(h.repo.transaction).toHaveBeenCalledTimes(1);

    // Verify the error surfaced FROM inside the tx callback (not outside it).
    const txCb = vi.mocked(h.repo.transaction).mock.calls.at(-1)![0] as (
      tx: Prisma.TransactionClient,
    ) => Promise<unknown>;
    await expect(txCb(h.txClient)).rejects.toThrow("journal regen failed");
  });
});
