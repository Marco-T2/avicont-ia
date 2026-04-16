/**
 * PR4 — Task 4.1 (RED/GREEN): Service IVA integration tests for SaleService.
 *
 * Covers SPEC-6 (editPosted bridge) and SPEC-7 (void cascade).
 * All repo/service dependencies are mocked — no DB access.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { SaleService } from "../sale.service";
import { SaleRepository } from "../sale.repository";
import { OrgSettingsService } from "@/features/org-settings";
import { AutoEntryGenerator } from "@/features/shared/auto-entry-generator";
import { ContactsService } from "@/features/contacts";
import { ReceivablesRepository } from "@/features/receivables/receivables.repository";
import { AccountBalancesService } from "@/features/account-balances";
import { FiscalPeriodsService } from "@/features/fiscal-periods";
import { AccountsRepository } from "@/features/accounting/accounts.repository";
import { JournalRepository } from "@/features/accounting/journal.repository";
import type { SaleWithDetails } from "../sale.types";
import type { IvaSalesBookDTO } from "@/features/accounting/iva-books/iva-books.types";

// ── Helpers ───────────────────────────────────────────────────────────────────

const D = (v: string | number) => new Prisma.Decimal(String(v));

const ORG_ID = "org-iva-test";
const USER_ID = "user-iva-test";
const SALE_ID = "sale-iva-test";
const PERIOD_ID = "period-iva-test";
const ENTRY_ID = "entry-iva-test";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeIvaBook(overrides: Partial<IvaSalesBookDTO> = {}): IvaSalesBookDTO {
  return {
    id: "iva-book-id",
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

function makeSale(overrides: Partial<SaleWithDetails> = {}): SaleWithDetails {
  return {
    id: SALE_ID,
    organizationId: ORG_ID,
    sequenceNumber: 1,
    status: "DRAFT",
    date: new Date("2025-03-15"),
    periodId: PERIOD_ID,
    contactId: "contact-001",
    description: "Venta test IVA",
    notes: null,
    referenceNumber: null,
    journalEntryId: null,
    receivableId: null,
    createdById: USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    totalAmount: 100,
    displayCode: "VG-001",
    contact: { id: "contact-001", name: "Cliente Test", type: "CLIENTE", paymentTermsDays: 30 },
    period: { id: PERIOD_ID, name: "Marzo 2025", status: "OPEN" },
    createdBy: { id: USER_ID, name: "Test User", email: "test@test.com" },
    details: [
      {
        id: "detail-01",
        saleId: SALE_ID,
        description: "Servicio A",
        lineAmount: 100,
        order: 0,
        quantity: null,
        unitPrice: null,
        incomeAccountId: "account-income-id",
      },
    ],
    receivable: null,
    ivaSalesBook: null,
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
    linkJournalAndReceivable: vi.fn(),
    transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const mockTx = {
        $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
        ivaSalesBook: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        journalEntry: {
          findFirst: vi.fn().mockResolvedValue(null),
          update: vi.fn(),
        },
        paymentAllocation: { findMany: vi.fn().mockResolvedValue([]) },
        accountsReceivable: { findFirst: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
        fiscalPeriod: { findFirstOrThrow: vi.fn() },
        sale: { update: vi.fn() },
        saleDetail: { deleteMany: vi.fn(), createMany: vi.fn() },
      };
      return fn(mockTx);
    }),
  } as unknown as SaleRepository;

  const orgSettingsService = {
    getOrCreate: vi.fn().mockResolvedValue({ cxcAccountCode: "1.1.3", itExpenseAccountCode: "5.3.3", itPayableAccountCode: "2.1.7" }),
  } as unknown as OrgSettingsService;

  const autoEntryGenerator = {
    generate: vi.fn().mockResolvedValue({ id: ENTRY_ID, lines: [] }),
  } as unknown as AutoEntryGenerator;

  const contactsService = {
    getActiveById: vi.fn(),
  } as unknown as ContactsService;

  const receivablesRepo = {
    createTx: vi.fn().mockResolvedValue({ id: "recv-001" }),
    voidTx: vi.fn(),
  } as unknown as ReceivablesRepository;

  const balancesService = {
    applyPost: vi.fn(),
    applyVoid: vi.fn(),
  } as unknown as AccountBalancesService;

  const periodsService = {
    getById: vi.fn().mockResolvedValue({ id: PERIOD_ID, status: "OPEN" }),
  } as unknown as FiscalPeriodsService;

  const accountsRepo = {
    findById: vi.fn().mockResolvedValue({ id: "account-income-id", code: "4.1.1", isActive: true, isDetail: true }),
    findByCode: vi.fn().mockResolvedValue({ id: "account-income-id", code: "4.1.1", isActive: true, isDetail: true }),
  } as unknown as AccountsRepository;

  const journalRepo = {
    updateTx: vi.fn().mockResolvedValue({ id: ENTRY_ID, lines: [] }),
  } as unknown as JournalRepository;

  const service = new SaleService(
    repo,
    orgSettingsService,
    autoEntryGenerator,
    contactsService,
    receivablesRepo,
    balancesService,
    periodsService,
    accountsRepo,
    journalRepo,
  );

  return {
    repo, orgSettingsService, autoEntryGenerator, contactsService,
    receivablesRepo, balancesService, periodsService, accountsRepo,
    journalRepo, service,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("SaleService — IVA journal integration", () => {
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    mocks = createMocks();
  });

  // ── post() con IvaBook ACTIVE ─────────────────────────────────────────────

  describe("post() con IvaBook ACTIVE", () => {
    it("llama a buildSaleEntryLines pasando ivaBook (builder recibe datos IVA)", async () => {
      const ivaBook = makeIvaBook();
      const sale = makeSale({ status: "DRAFT", ivaSalesBook: ivaBook });
      const postedSale = makeSale({ status: "POSTED", ivaSalesBook: ivaBook, journalEntryId: ENTRY_ID });

      vi.mocked(mocks.repo.findById)
        .mockResolvedValueOnce(sale)   // getById
        .mockResolvedValueOnce(postedSale); // resultado final

      await mocks.service.post(ORG_ID, SALE_ID, USER_ID);

      // autoEntryGenerator.generate debe haber sido llamado con líneas IVA + IT
      const generateCall = vi.mocked(mocks.autoEntryGenerator.generate).mock.calls[0];
      expect(generateCall).toBeDefined();
      const lines = generateCall[1].lines;
      // 5 líneas: DR CxC 100, CR ingreso 87, CR IVA 13, DR IT 3, CR IT 3
      expect(lines).toHaveLength(5);
      expect(lines.find((l: { accountCode: string }) => l.accountCode === "2.1.6")).toBeDefined();
    });
  });

  // ── post() sin IvaBook (o VOIDED) ────────────────────────────────────────

  describe("post() sin IvaBook", () => {
    it("cuando ivaSalesBook es null, builder produce N líneas de detalle (non-IVA path)", async () => {
      const sale = makeSale({ status: "DRAFT", ivaSalesBook: null });
      const postedSale = makeSale({ status: "POSTED", journalEntryId: ENTRY_ID });

      vi.mocked(mocks.repo.findById)
        .mockResolvedValueOnce(sale)
        .mockResolvedValueOnce(postedSale);

      await mocks.service.post(ORG_ID, SALE_ID, USER_ID);

      const generateCall = vi.mocked(mocks.autoEntryGenerator.generate).mock.calls[0];
      const lines = generateCall[1].lines;
      // Non-IVA path: 2 líneas (1 DR CxC + 1 CR ingreso por detalle)
      expect(lines).toHaveLength(2);
      expect(lines.find((l: { accountCode: string }) => l.accountCode === "2.1.6")).toBeUndefined();
    });

    it("cuando ivaSalesBook tiene status VOIDED, builder produce path sin IVA", async () => {
      const ivaBook = makeIvaBook({ status: "VOIDED" });
      const sale = makeSale({ status: "DRAFT", ivaSalesBook: ivaBook });
      const postedSale = makeSale({ status: "POSTED", journalEntryId: ENTRY_ID });

      vi.mocked(mocks.repo.findById)
        .mockResolvedValueOnce(sale)
        .mockResolvedValueOnce(postedSale);

      await mocks.service.post(ORG_ID, SALE_ID, USER_ID);

      const generateCall = vi.mocked(mocks.autoEntryGenerator.generate).mock.calls[0];
      const lines = generateCall[1].lines;
      // VOIDED IvaBook → non-IVA path
      expect(lines).toHaveLength(2);
      expect(lines.find((l: { accountCode: string }) => l.accountCode === "2.1.6")).toBeUndefined();
    });
  });

  // ── void() con IvaBook ACTIVE — SPEC-7 ────────────────────────────────────

  describe("void() con IvaBook ACTIVE — SPEC-7", () => {
    it("anula el IvaSalesBook ANTES de la reversión de asiento dentro de la misma tx", async () => {
      const ivaBook = makeIvaBook({ status: "ACTIVE" });
      const postedSale = makeSale({
        status: "POSTED",
        ivaSalesBook: ivaBook,
        journalEntryId: ENTRY_ID,
        receivableId: "recv-001",
      });
      const voidedSale = makeSale({ status: "VOIDED", ivaSalesBook: makeIvaBook({ status: "VOIDED" }) });

      vi.mocked(mocks.repo.findById)
        .mockResolvedValueOnce(postedSale)   // getById en void()
        .mockResolvedValueOnce(voidedSale);  // findById final

      const ivaSalesBookUpdateMock = vi.fn().mockResolvedValue({ status: "VOIDED" });
      const ivaSalesBookFindUniqueMock = vi.fn().mockResolvedValue({ id: "iva-book-id", status: "ACTIVE" });
      const journalFindFirstMock = vi.fn().mockResolvedValue({
        id: ENTRY_ID,
        lines: [],
        contact: null,
        voucherType: { code: "CI" },
      });
      const journalUpdateMock = vi.fn().mockResolvedValue({});

      vi.mocked(mocks.repo.transaction).mockImplementationOnce(async (fn) => {
        const order: string[] = [];
        const mockTx = {
          $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
          ivaSalesBook: {
            findUnique: ivaSalesBookFindUniqueMock,
            update: async (...args: unknown[]) => {
              order.push("ivaBook.update");
              return ivaSalesBookUpdateMock(...args);
            },
          },
          journalEntry: {
            findFirst: journalFindFirstMock,
            update: async (...args: unknown[]) => {
              order.push("journalEntry.update");
              return journalUpdateMock(...args);
            },
          },
          paymentAllocation: { findMany: vi.fn().mockResolvedValue([]) },
          accountsReceivable: { findUnique: vi.fn() },
        };
        await fn(mockTx as unknown as Prisma.TransactionClient);
        // SPEC-7: IvaBook void DEBE ir antes que journalEntry void
        const ivaIdx = order.indexOf("ivaBook.update");
        const journalIdx = order.indexOf("journalEntry.update");
        expect(ivaIdx).toBeGreaterThanOrEqual(0);
        expect(journalIdx).toBeGreaterThanOrEqual(0);
        expect(ivaIdx).toBeLessThan(journalIdx);
      });

      await mocks.service.void(ORG_ID, SALE_ID, USER_ID);

      expect(ivaSalesBookUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: "VOIDED" } }),
      );
    });
  });

  // ── void() sin IvaBook — SPEC-7 no-op ────────────────────────────────────

  describe("void() sin IvaBook — SPEC-7 no-op", () => {
    it("anula la venta sin error aunque no haya IvaSalesBook vinculado", async () => {
      const postedSale = makeSale({
        status: "POSTED",
        ivaSalesBook: null,
        journalEntryId: ENTRY_ID,
      });
      const voidedSale = makeSale({ status: "VOIDED" });

      vi.mocked(mocks.repo.findById)
        .mockResolvedValueOnce(postedSale)
        .mockResolvedValueOnce(voidedSale);

      const ivaSalesBookFindUniqueMock = vi.fn().mockResolvedValue(null);
      const ivaSalesBookUpdateMock = vi.fn();

      vi.mocked(mocks.repo.transaction).mockImplementationOnce(async (fn) => {
        const mockTx = {
          $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
          ivaSalesBook: {
            findUnique: ivaSalesBookFindUniqueMock,
            update: ivaSalesBookUpdateMock,
          },
          journalEntry: {
            findFirst: vi.fn().mockResolvedValue({
              id: ENTRY_ID, lines: [], contact: null, voucherType: { code: "CI" },
            }),
            update: vi.fn().mockResolvedValue({}),
          },
          paymentAllocation: { findMany: vi.fn().mockResolvedValue([]) },
          accountsReceivable: { findUnique: vi.fn() },
        };
        return fn(mockTx as unknown as Prisma.TransactionClient);
      });

      await expect(mocks.service.void(ORG_ID, SALE_ID, USER_ID)).resolves.not.toThrow();
      // IvaBook.update no debe ser llamado cuando no hay IvaBook
      expect(ivaSalesBookUpdateMock).not.toHaveBeenCalled();
    });
  });

  // ── regenerateJournalForIvaChange() — SPEC-6 ─────────────────────────────

  describe("regenerateJournalForIvaChange() — SPEC-6", () => {
    it("con período ABIERTO: actualiza el asiento contable con las líneas IVA del ivaBook actual", async () => {
      const ivaBook = makeIvaBook({ status: "ACTIVE" });
      const postedSale = makeSale({
        status: "POSTED",
        ivaSalesBook: ivaBook,
        journalEntryId: ENTRY_ID,
      });
      const finalSale = makeSale({ status: "POSTED", ivaSalesBook: ivaBook, journalEntryId: ENTRY_ID });

      vi.mocked(mocks.repo.findById)
        .mockResolvedValueOnce(postedSale)  // reload interno
        .mockResolvedValueOnce(finalSale);  // retorno final

      vi.mocked(mocks.periodsService.getById).mockResolvedValueOnce({ id: PERIOD_ID, status: "OPEN" } as never);

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
              id: ENTRY_ID, lines: [], contact: null, voucherType: { code: "CI" },
            }),
            update: vi.fn().mockResolvedValue({}),
          },
          accountsReceivable: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() },
          paymentAllocation: { findMany: vi.fn().mockResolvedValue([]) },
          sale: { update: vi.fn() },
          saleDetail: { deleteMany: vi.fn(), createMany: vi.fn() },
        };
        return fn(mockTx as unknown as Prisma.TransactionClient);
      });

      await mocks.service.regenerateJournalForIvaChange(ORG_ID, SALE_ID, USER_ID);

      // El asiento debe haber sido actualizado con líneas IVA + IT (5 líneas)
      expect(vi.mocked(mocks.journalRepo.updateTx)).toHaveBeenCalled();
      const updateCall = vi.mocked(mocks.journalRepo.updateTx).mock.calls[0];
      const resolvedLines = updateCall[4];
      expect(resolvedLines).toHaveLength(5);
      // Verificar que el chequeo de período ocurrió dentro de la tx
      expect(fiscalPeriodChecked).toBe(true);
    });

    it("con período CERRADO: lanza FISCAL_PERIOD_CLOSED sin modificar el asiento", async () => {
      const ivaBook = makeIvaBook({ status: "ACTIVE" });
      const postedSale = makeSale({
        status: "POSTED",
        ivaSalesBook: ivaBook,
        journalEntryId: ENTRY_ID,
      });

      vi.mocked(mocks.repo.findById).mockResolvedValueOnce(postedSale);
      vi.mocked(mocks.periodsService.getById).mockResolvedValueOnce({ id: PERIOD_ID, status: "CLOSED" } as never);

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
        mocks.service.regenerateJournalForIvaChange(ORG_ID, SALE_ID, USER_ID),
      ).rejects.toThrow();

      // journalRepo.updateTx NO debe haber sido llamado
      expect(vi.mocked(mocks.journalRepo.updateTx)).not.toHaveBeenCalled();
    });

    it("NO escribe en ivaSalesBook (read-only — guard anti-loop)", async () => {
      const ivaBook = makeIvaBook({ status: "ACTIVE" });
      const postedSale = makeSale({
        status: "POSTED",
        ivaSalesBook: ivaBook,
        journalEntryId: ENTRY_ID,
      });
      const finalSale = makeSale({ status: "POSTED", ivaSalesBook: ivaBook, journalEntryId: ENTRY_ID });

      vi.mocked(mocks.repo.findById)
        .mockResolvedValueOnce(postedSale)
        .mockResolvedValueOnce(finalSale);

      const ivaSalesBookUpdateMock = vi.fn();

      vi.mocked(mocks.repo.transaction).mockImplementationOnce(async (fn) => {
        const mockTx = {
          $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
          fiscalPeriod: {
            findFirstOrThrow: vi.fn().mockResolvedValue({ id: PERIOD_ID, status: "OPEN" }),
          },
          ivaSalesBook: { update: ivaSalesBookUpdateMock },
          journalEntry: {
            findFirst: vi.fn().mockResolvedValue({
              id: ENTRY_ID, lines: [], contact: null, voucherType: { code: "CI" },
            }),
            update: vi.fn().mockResolvedValue({}),
          },
          accountsReceivable: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() },
          paymentAllocation: { findMany: vi.fn().mockResolvedValue([]) },
          sale: { update: vi.fn() },
          saleDetail: { deleteMany: vi.fn(), createMany: vi.fn() },
        };
        return fn(mockTx as unknown as Prisma.TransactionClient);
      });

      await mocks.service.regenerateJournalForIvaChange(ORG_ID, SALE_ID, USER_ID);

      // LOOP GUARD: regenerateJournalForIvaChange NUNCA debe escribir en ivaSalesBook
      expect(ivaSalesBookUpdateMock).not.toHaveBeenCalled();
    });
  });
});
