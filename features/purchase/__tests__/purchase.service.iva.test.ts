/**
 * PR4 — Task 4.2 (RED/GREEN): Service IVA integration tests for PurchaseService.
 *
 * Mirrors sale.service.iva.test.ts for the purchase side.
 * Covers SPEC-6 (editPosted bridge) and SPEC-7 (void cascade).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { PurchaseService } from "../purchase.service";
import { PurchaseRepository } from "../purchase.repository";
import { OrgSettingsService } from "@/features/org-settings/server";
import { AutoEntryGenerator } from "@/features/shared/auto-entry-generator";
import { ContactsService } from "@/features/contacts/server";
import { PayablesRepository } from "@/features/payables/payables.repository";
import { AccountBalancesService } from "@/features/account-balances/server";
import { FiscalPeriodsService } from "@/features/fiscal-periods/server";
import { AccountsRepository } from "@/features/accounting/accounts.repository";
import { JournalRepository } from "@/features/accounting/journal.repository";
import type { PurchaseWithDetails } from "../purchase.types";
import type { IvaPurchaseBookDTO } from "@/features/accounting/iva-books";

// ── Helpers ───────────────────────────────────────────────────────────────────

const D = (v: string | number) => new Prisma.Decimal(String(v));

const ORG_ID = "org-iva-purchase-test";
const USER_ID = "user-iva-purchase-test";
const PURCHASE_ID = "purchase-iva-test";
const PERIOD_ID = "period-iva-purchase-test";
const ENTRY_ID = "entry-iva-purchase-test";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeIvaBook(overrides: Partial<IvaPurchaseBookDTO> = {}): IvaPurchaseBookDTO {
  return {
    id: "iva-purchase-book-id",
    organizationId: ORG_ID,
    fiscalPeriodId: PERIOD_ID,
    purchaseId: PURCHASE_ID,
    fechaFactura: "2025-03-15",
    nitProveedor: "1234567",
    razonSocial: "Proveedor Test",
    numeroFactura: "FAC-COMP-001",
    codigoAutorizacion: "AUTH-COMP-001",
    codigoControl: "",
    tipoCompra: 1,
    importeTotal: D("100.00"),
    importeIce: D("0"),
    importeIehd: D("0"),
    importeIpj: D("0"),
    tasas: D("0"),
    otrosNoSujetos: D("0"),
    exentos: D("0"),
    tasaCero: D("0"),
    codigoDescuentoAdicional: D("0"),
    importeGiftCard: D("0"),
    subtotal: D("100.00"),
    dfIva: D("13.00"),
    baseIvaSujetoCf: D("100.00"),
    dfCfIva: D("13.00"),
    tasaIva: D("0.1300"),
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makePurchase(overrides: Partial<PurchaseWithDetails> = {}): PurchaseWithDetails {
  return {
    id: PURCHASE_ID,
    organizationId: ORG_ID,
    purchaseType: "COMPRA_GENERAL",
    sequenceNumber: 1,
    status: "DRAFT",
    date: new Date("2025-03-15"),
    periodId: PERIOD_ID,
    contactId: "contact-prov-001",
    description: "Compra test IVA",
    notes: null,
    referenceNumber: null,
    journalEntryId: null,
    payableId: null,
    createdById: USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    totalAmount: 100,
    shrinkagePct: null,
    totalGrossKg: null,
    totalNetKg: null,
    totalShrinkKg: null,
    totalShortageKg: null,
    totalRealNetKg: null,
    ruta: null,
    farmOrigin: null,
    chickenCount: null,
    displayCode: "CG-001",
    contact: { id: "contact-prov-001", name: "Proveedor Test", type: "PROVEEDOR", paymentTermsDays: 30 },
    period: { id: PERIOD_ID, name: "Marzo 2025", status: "OPEN" },
    createdBy: { id: USER_ID, name: "Test User", email: "test@test.com" },
    details: [
      {
        id: "det-01",
        purchaseId: PURCHASE_ID,
        description: "Insumo A",
        lineAmount: 100,
        order: 0,
        quantity: null,
        unitPrice: null,
        expenseAccountId: "account-expense-id",
        chickenQty: null,
        pricePerChicken: null,
        grossWeight: null,
        tare: null,
        netWeight: null,
        shrinkage: null,
        shortage: null,
        realNetWeight: null,
        fecha: null,
        docRef: null,
        productTypeId: null,
        detailNote: null,
        boxes: null,
      },
    ],
    payable: null,
    ivaPurchaseBook: null,
    ...overrides,
  };
}

// ── Mock factories ────────────────────────────────────────────────────────────

function createMocks() {
  const repo = {
    findById: vi.fn(),
    findAll: vi.fn(),
    create: vi.fn(),
    createPostedTx: vi.fn(),
    update: vi.fn(),
    updateTx: vi.fn(),
    updateStatusTx: vi.fn(),
    hardDelete: vi.fn(),
    getNextSequenceNumber: vi.fn().mockResolvedValue(1),
    linkJournalAndPayable: vi.fn(),
    transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const mockTx = {
        $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
        ivaPurchaseBook: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        journalEntry: {
          findFirst: vi.fn().mockResolvedValue(null),
          update: vi.fn(),
        },
        paymentAllocation: { findMany: vi.fn().mockResolvedValue([]) },
        accountsPayable: { findUnique: vi.fn() },
        fiscalPeriod: { findFirstOrThrow: vi.fn() },
        purchase: { update: vi.fn() },
        purchaseDetail: { deleteMany: vi.fn(), createMany: vi.fn() },
      };
      return fn(mockTx);
    }),
  } as unknown as PurchaseRepository;

  const orgSettingsService = {
    getOrCreate: vi.fn().mockResolvedValue({
      cxcAccountCode: "1.1.3",
      cxpAccountCode: "2.1.1",
      cxpFleteAccountCode: "2.1.2",
      cxpPolloFaenadoAccountCode: "2.1.3",
      expenseAccountCode: "5.1.1",
      fleteExpenseAccountCode: "5.1.2",
      polloFaenadoCOGSAccountCode: "5.1.3",
    }),
  } as unknown as OrgSettingsService;

  const autoEntryGenerator = {
    generate: vi.fn().mockResolvedValue({ id: ENTRY_ID, lines: [] }),
  } as unknown as AutoEntryGenerator;

  const contactsService = {
    getActiveById: vi.fn(),
  } as unknown as ContactsService;

  const payablesRepo = {
    createTx: vi.fn().mockResolvedValue({ id: "payable-001" }),
    voidTx: vi.fn(),
  } as unknown as PayablesRepository;

  const balancesService = {
    applyPost: vi.fn(),
    applyVoid: vi.fn(),
  } as unknown as AccountBalancesService;

  const periodsService = {
    getById: vi.fn().mockResolvedValue({ id: PERIOD_ID, status: "OPEN" }),
  } as unknown as FiscalPeriodsService;

  const accountsRepo = {
    findById: vi.fn().mockResolvedValue({ id: "account-expense-id", code: "5.1.1", isActive: true, isDetail: true }),
    findByCode: vi.fn().mockResolvedValue({ id: "account-expense-id", code: "5.1.1", isActive: true, isDetail: true }),
  } as unknown as AccountsRepository;

  const journalRepo = {
    updateTx: vi.fn().mockResolvedValue({ id: ENTRY_ID, lines: [] }),
  } as unknown as JournalRepository;

  const service = new PurchaseService(
    repo,
    orgSettingsService,
    autoEntryGenerator,
    contactsService,
    payablesRepo,
    balancesService,
    periodsService,
    accountsRepo,
    journalRepo,
  );

  return {
    repo, orgSettingsService, autoEntryGenerator, contactsService,
    payablesRepo, balancesService, periodsService, accountsRepo,
    journalRepo, service,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PurchaseService — IVA journal integration", () => {
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    mocks = createMocks();
  });

  // ── post() con IvaBook ACTIVE ─────────────────────────────────────────────

  describe("post() con IvaBook ACTIVE (COMPRA_GENERAL)", () => {
    it("llama a buildPurchaseEntryLines pasando ivaBook (3 líneas: DR gasto + DR 1.1.8 + CR CxP)", async () => {
      const ivaBook = makeIvaBook();
      const purchase = makePurchase({ status: "DRAFT", ivaPurchaseBook: ivaBook });
      const postedPurchase = makePurchase({ status: "POSTED", ivaPurchaseBook: ivaBook, journalEntryId: ENTRY_ID });

      vi.mocked(mocks.repo.findById)
        .mockResolvedValueOnce(purchase)
        .mockResolvedValueOnce(postedPurchase);

      await mocks.service.post(ORG_ID, PURCHASE_ID, USER_ID);

      const generateCall = vi.mocked(mocks.autoEntryGenerator.generate).mock.calls[0];
      expect(generateCall).toBeDefined();
      const lines = generateCall[1].lines;
      // IVA path (alícuota nominal SIN): 3 líneas (DR gasto + DR 1.1.8 + CR CxP)
      expect(lines).toHaveLength(3);
      expect(lines.find((l: { accountCode: string }) => l.accountCode === "1.1.8")).toBeDefined();
    });
  });

  // ── post() sin IvaBook ────────────────────────────────────────────────────

  describe("post() sin IvaBook", () => {
    it("cuando ivaPurchaseBook es null, builder produce N líneas de detalle (non-IVA path)", async () => {
      const purchase = makePurchase({ status: "DRAFT", ivaPurchaseBook: null });
      const postedPurchase = makePurchase({ status: "POSTED", journalEntryId: ENTRY_ID });

      vi.mocked(mocks.repo.findById)
        .mockResolvedValueOnce(purchase)
        .mockResolvedValueOnce(postedPurchase);

      await mocks.service.post(ORG_ID, PURCHASE_ID, USER_ID);

      const generateCall = vi.mocked(mocks.autoEntryGenerator.generate).mock.calls[0];
      const lines = generateCall[1].lines;
      // Non-IVA: 2 líneas (DR gasto + CR CxP)
      expect(lines).toHaveLength(2);
      expect(lines.find((l: { accountCode: string }) => l.accountCode === "1.1.8")).toBeUndefined();
    });

    it("cuando ivaPurchaseBook tiene status VOIDED, builder produce path sin IVA", async () => {
      const ivaBook = makeIvaBook({ status: "VOIDED" });
      const purchase = makePurchase({ status: "DRAFT", ivaPurchaseBook: ivaBook });
      const postedPurchase = makePurchase({ status: "POSTED", journalEntryId: ENTRY_ID });

      vi.mocked(mocks.repo.findById)
        .mockResolvedValueOnce(purchase)
        .mockResolvedValueOnce(postedPurchase);

      await mocks.service.post(ORG_ID, PURCHASE_ID, USER_ID);

      const generateCall = vi.mocked(mocks.autoEntryGenerator.generate).mock.calls[0];
      const lines = generateCall[1].lines;
      expect(lines).toHaveLength(2);
      expect(lines.find((l: { accountCode: string }) => l.accountCode === "1.1.8")).toBeUndefined();
    });
  });

  // ── void() con IvaBook ACTIVE — SPEC-7 ────────────────────────────────────

  describe("void() con IvaBook ACTIVE — SPEC-7", () => {
    it("anula el IvaPurchaseBook ANTES de la reversión de asiento", async () => {
      const ivaBook = makeIvaBook({ status: "ACTIVE" });
      const postedPurchase = makePurchase({
        status: "POSTED",
        ivaPurchaseBook: ivaBook,
        journalEntryId: ENTRY_ID,
        payableId: "payable-001",
      });
      const voidedPurchase = makePurchase({ status: "VOIDED" });

      vi.mocked(mocks.repo.findById)
        .mockResolvedValueOnce(postedPurchase)
        .mockResolvedValueOnce(voidedPurchase);

      const ivaPurchaseBookUpdateMock = vi.fn().mockResolvedValue({ status: "VOIDED" });
      const ivaPurchaseBookFindUniqueMock = vi.fn().mockResolvedValue({ id: "iva-purchase-book-id", status: "ACTIVE" });
      const order: string[] = [];

      vi.mocked(mocks.repo.transaction).mockImplementationOnce(async (fn) => {
        const mockTx = {
          $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
          ivaPurchaseBook: {
            findUnique: ivaPurchaseBookFindUniqueMock,
            update: async (...args: unknown[]) => {
              order.push("ivaPurchaseBook.update");
              return ivaPurchaseBookUpdateMock(...args);
            },
          },
          journalEntry: {
            findFirst: vi.fn().mockResolvedValue({
              id: ENTRY_ID, lines: [], contact: null, voucherType: { code: "CE" },
            }),
            update: async (..._args: unknown[]) => {
              order.push("journalEntry.update");
              return {};
            },
          },
          paymentAllocation: { findMany: vi.fn().mockResolvedValue([]) },
          accountsPayable: { findUnique: vi.fn() },
        };
        await fn(mockTx as unknown as Prisma.TransactionClient);

        // D4: IvaBook void ANTES que journalEntry void
        const ivaIdx = order.indexOf("ivaPurchaseBook.update");
        const journalIdx = order.indexOf("journalEntry.update");
        expect(ivaIdx).toBeGreaterThanOrEqual(0);
        expect(journalIdx).toBeGreaterThanOrEqual(0);
        expect(ivaIdx).toBeLessThan(journalIdx);
      });

      await mocks.service.void(ORG_ID, PURCHASE_ID, USER_ID);
      expect(ivaPurchaseBookUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: "VOIDED" } }),
      );
    });
  });

  // ── void() sin IvaBook — SPEC-7 no-op ────────────────────────────────────

  describe("void() sin IvaBook — no-op", () => {
    it("anula la compra sin error cuando no hay IvaPurchaseBook vinculado", async () => {
      const postedPurchase = makePurchase({
        status: "POSTED",
        ivaPurchaseBook: null,
        journalEntryId: ENTRY_ID,
      });
      const voidedPurchase = makePurchase({ status: "VOIDED" });

      vi.mocked(mocks.repo.findById)
        .mockResolvedValueOnce(postedPurchase)
        .mockResolvedValueOnce(voidedPurchase);

      const ivaPurchaseBookUpdateMock = vi.fn();

      vi.mocked(mocks.repo.transaction).mockImplementationOnce(async (fn) => {
        const mockTx = {
          $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
          ivaPurchaseBook: {
            findUnique: vi.fn().mockResolvedValue(null),
            update: ivaPurchaseBookUpdateMock,
          },
          journalEntry: {
            findFirst: vi.fn().mockResolvedValue({
              id: ENTRY_ID, lines: [], contact: null, voucherType: { code: "CE" },
            }),
            update: vi.fn().mockResolvedValue({}),
          },
          paymentAllocation: { findMany: vi.fn().mockResolvedValue([]) },
          accountsPayable: { findUnique: vi.fn() },
        };
        return fn(mockTx as unknown as Prisma.TransactionClient);
      });

      await expect(mocks.service.void(ORG_ID, PURCHASE_ID, USER_ID)).resolves.not.toThrow();
      expect(ivaPurchaseBookUpdateMock).not.toHaveBeenCalled();
    });
  });

  // ── regenerateJournalForIvaChange() — SPEC-6 ─────────────────────────────

  describe("regenerateJournalForIvaChange() — SPEC-6", () => {
    it("con período ABIERTO: actualiza el asiento con las líneas IVA del ivaBook actual (3 líneas)", async () => {
      const ivaBook = makeIvaBook({ status: "ACTIVE" });
      const postedPurchase = makePurchase({
        status: "POSTED",
        ivaPurchaseBook: ivaBook,
        journalEntryId: ENTRY_ID,
      });
      const finalPurchase = makePurchase({ status: "POSTED", ivaPurchaseBook: ivaBook, journalEntryId: ENTRY_ID });

      vi.mocked(mocks.repo.findById)
        .mockResolvedValueOnce(postedPurchase)
        .mockResolvedValueOnce(finalPurchase);

      let fiscalPeriodChecked = false;
      vi.mocked(mocks.repo.transaction).mockImplementationOnce(async (fn) => {
        const mockTx = {
          $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
          fiscalPeriod: {
            findFirstOrThrow: vi.fn().mockImplementation(async () => {
              fiscalPeriodChecked = true;
              return { id: PERIOD_ID, status: "OPEN" };
            }),
          },
          journalEntry: {
            findFirst: vi.fn().mockResolvedValue({
              id: ENTRY_ID, lines: [], contact: null, voucherType: { code: "CE" },
            }),
            update: vi.fn().mockResolvedValue({}),
          },
          accountsPayable: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() },
          paymentAllocation: { findMany: vi.fn().mockResolvedValue([]) },
          purchase: { update: vi.fn() },
          purchaseDetail: { deleteMany: vi.fn(), createMany: vi.fn() },
        };
        return fn(mockTx as unknown as Prisma.TransactionClient);
      });

      await mocks.service.regenerateJournalForIvaChange(ORG_ID, PURCHASE_ID, USER_ID);

      expect(vi.mocked(mocks.journalRepo.updateTx)).toHaveBeenCalled();
      const updateCall = vi.mocked(mocks.journalRepo.updateTx).mock.calls[0];
      const resolvedLines = updateCall[4];
      // 3 líneas IVA (alícuota nominal SIN): DR gasto + DR 1.1.8 + CR CxP
      expect(resolvedLines).toHaveLength(3);
      expect(fiscalPeriodChecked).toBe(true);
    });

    it("con período CERRADO: lanza error sin modificar el asiento", async () => {
      const ivaBook = makeIvaBook({ status: "ACTIVE" });
      const postedPurchase = makePurchase({
        status: "POSTED",
        ivaPurchaseBook: ivaBook,
        journalEntryId: ENTRY_ID,
      });

      vi.mocked(mocks.repo.findById).mockResolvedValueOnce(postedPurchase);

      vi.mocked(mocks.repo.transaction).mockImplementationOnce(async (fn) => {
        const mockTx = {
          $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
          fiscalPeriod: {
            findFirstOrThrow: vi.fn().mockRejectedValue(
              Object.assign(new Error("No se puede operar en un período cerrado"), { code: "FISCAL_PERIOD_CLOSED" }),
            ),
          },
        };
        return fn(mockTx as unknown as Prisma.TransactionClient);
      });

      await expect(
        mocks.service.regenerateJournalForIvaChange(ORG_ID, PURCHASE_ID, USER_ID),
      ).rejects.toThrow();

      expect(vi.mocked(mocks.journalRepo.updateTx)).not.toHaveBeenCalled();
    });

    it("NO escribe en ivaPurchaseBook (read-only — guard anti-loop)", async () => {
      const ivaBook = makeIvaBook({ status: "ACTIVE" });
      const postedPurchase = makePurchase({
        status: "POSTED",
        ivaPurchaseBook: ivaBook,
        journalEntryId: ENTRY_ID,
      });
      const finalPurchase = makePurchase({ status: "POSTED", ivaPurchaseBook: ivaBook, journalEntryId: ENTRY_ID });

      vi.mocked(mocks.repo.findById)
        .mockResolvedValueOnce(postedPurchase)
        .mockResolvedValueOnce(finalPurchase);

      const ivaPurchaseBookUpdateMock = vi.fn();

      vi.mocked(mocks.repo.transaction).mockImplementationOnce(async (fn) => {
        const mockTx = {
          $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
          fiscalPeriod: {
            findFirstOrThrow: vi.fn().mockResolvedValue({ id: PERIOD_ID, status: "OPEN" }),
          },
          ivaPurchaseBook: { update: ivaPurchaseBookUpdateMock },
          journalEntry: {
            findFirst: vi.fn().mockResolvedValue({
              id: ENTRY_ID, lines: [], contact: null, voucherType: { code: "CE" },
            }),
            update: vi.fn().mockResolvedValue({}),
          },
          accountsPayable: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() },
          paymentAllocation: { findMany: vi.fn().mockResolvedValue([]) },
          purchase: { update: vi.fn() },
          purchaseDetail: { deleteMany: vi.fn(), createMany: vi.fn() },
        };
        return fn(mockTx as unknown as Prisma.TransactionClient);
      });

      await mocks.service.regenerateJournalForIvaChange(ORG_ID, PURCHASE_ID, USER_ID);

      // LOOP GUARD: regenerateJournalForIvaChange NO debe escribir en ivaPurchaseBook
      expect(ivaPurchaseBookUpdateMock).not.toHaveBeenCalled();
    });
  });
});
