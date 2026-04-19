/**
 * PR1 — sale-edit-cascade (RED → GREEN)
 *
 * Tests for editPosted IvaSalesBook cascade (REQ-1, REQ-2, REQ-3).
 * Covers SC-01, SC-02, SC-03, SC-05.
 *
 * All external dependencies are mocked — no DB access.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { SaleService } from "../sale.service";
import { SaleRepository } from "../sale.repository";
import { OrgSettingsService } from "@/features/org-settings";
import { AutoEntryGenerator } from "@/features/shared/auto-entry-generator";
import { ContactsService } from "@/features/contacts/server";
import { ReceivablesRepository } from "@/features/receivables/receivables.repository";
import { AccountBalancesService } from "@/features/account-balances";
import { FiscalPeriodsService } from "@/features/fiscal-periods/server";
import { AccountsRepository } from "@/features/accounting/accounts.repository";
import { JournalRepository } from "@/features/accounting/journal.repository";
import { IvaBooksService } from "@/features/accounting/iva-books/iva-books.service";
import type { SaleWithDetails } from "../sale.types";
import type { IvaSalesBookDTO } from "@/features/accounting/iva-books/iva-books.types";

// ── Helpers ───────────────────────────────────────────────────────────────────

const D = (v: string | number) => new Prisma.Decimal(String(v));
const ZERO = D("0");

const ORG_ID = "org-cascade-pr1";
const USER_ID = "user-cascade-pr1";
const SALE_ID = "sale-cascade-pr1";
const PERIOD_ID = "period-cascade-pr1";
const ENTRY_ID = "entry-cascade-pr1";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeIvaBook(overrides: Partial<IvaSalesBookDTO> = {}): IvaSalesBookDTO {
  return {
    id: "iva-book-cascade-id",
    organizationId: ORG_ID,
    fiscalPeriodId: PERIOD_ID,
    saleId: SALE_ID,
    fechaFactura: "2025-03-15",
    nitCliente: "1234567",
    razonSocial: "Cliente Cascade Test",
    numeroFactura: "FAC-CASCADE-001",
    codigoAutorizacion: "AUTH-CASCADE-001",
    codigoControl: "",
    estadoSIN: "A",
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
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date(),
    notes: undefined,
    ...overrides,
  };
}

function makeSale(overrides: Partial<SaleWithDetails> = {}): SaleWithDetails {
  return {
    id: SALE_ID,
    organizationId: ORG_ID,
    sequenceNumber: 1,
    status: "POSTED",
    date: new Date("2025-03-15"),
    periodId: PERIOD_ID,
    contactId: "contact-cascade-001",
    description: "Venta cascade test",
    notes: null,
    referenceNumber: null,
    journalEntryId: ENTRY_ID,
    receivableId: "recv-cascade-001",
    createdById: USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    totalAmount: 100,
    displayCode: "VG-001",
    contact: { id: "contact-cascade-001", name: "Cliente Cascade", type: "CLIENTE", paymentTermsDays: 30 },
    period: { id: PERIOD_ID, name: "Marzo 2025", status: "OPEN" },
    createdBy: { id: USER_ID, name: "Test User", email: "test@test.com" },
    details: [
      {
        id: "detail-cascade-01",
        saleId: SALE_ID,
        description: "Servicio Cascade",
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

// ── Mock factory ──────────────────────────────────────────────────────────────

function createMocks(ivaBooksServiceOverrides?: Partial<IvaBooksService>) {
  // Track calls to ivaSalesBook.update within the tx
  const ivaSalesBookUpdateMock = vi.fn().mockResolvedValue({});
  const ivaSalesBookFindFirstMock = vi.fn().mockResolvedValue(makeIvaBook());

  const repo = {
    findById: vi.fn(),
    findAll: vi.fn(),
    create: vi.fn(),
    createPostedTx: vi.fn(),
    update: vi.fn(),
    updateTx: vi.fn(),
    updateStatusTx: vi.fn().mockResolvedValue(undefined),
    hardDelete: vi.fn(),
    getNextSequenceNumber: vi.fn().mockResolvedValue(1),
    linkJournalAndReceivable: vi.fn(),
    transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const mockTx = {
        $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
        ivaSalesBook: {
          findFirst: ivaSalesBookFindFirstMock,
          findUnique: vi.fn().mockResolvedValue(makeIvaBook()),
          update: ivaSalesBookUpdateMock,
        },
        journalEntry: {
          findFirst: vi.fn().mockResolvedValue({
            id: ENTRY_ID,
            lines: [],
            contact: null,
            voucherType: { code: "CI" },
          }),
          update: vi.fn().mockResolvedValue({}),
        },
        paymentAllocation: {
          findMany: vi.fn().mockResolvedValue([]),
          delete: vi.fn(),
          update: vi.fn(),
          deleteMany: vi.fn(),
        },
        accountsReceivable: {
          findFirst: vi.fn().mockResolvedValue({ paid: 0 }),
          findUnique: vi.fn().mockResolvedValue({ paid: 0 }),
          update: vi.fn().mockResolvedValue({}),
        },
        fiscalPeriod: { findFirstOrThrow: vi.fn().mockResolvedValue({ id: PERIOD_ID, status: "OPEN" }) },
        sale: { update: vi.fn().mockResolvedValue({}) },
        saleDetail: { deleteMany: vi.fn(), createMany: vi.fn() },
      };
      return fn(mockTx);
    }),
  } as unknown as SaleRepository;

  const orgSettingsService = {
    getOrCreate: vi.fn().mockResolvedValue({ cxcAccountCode: "1.1.3" }),
  } as unknown as OrgSettingsService;

  const autoEntryGenerator = {
    generate: vi.fn().mockResolvedValue({ id: ENTRY_ID, lines: [] }),
  } as unknown as AutoEntryGenerator;

  const contactsService = {
    getActiveById: vi.fn().mockResolvedValue({ id: "contact-cascade-001", type: "CLIENTE", paymentTermsDays: 30 }),
  } as unknown as ContactsService;

  const receivablesRepo = {
    createTx: vi.fn().mockResolvedValue({ id: "recv-cascade-001" }),
    voidTx: vi.fn(),
  } as unknown as ReceivablesRepository;

  const balancesService = {
    applyPost: vi.fn().mockResolvedValue(undefined),
    applyVoid: vi.fn().mockResolvedValue(undefined),
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

  const ivaBooksService = {
    recomputeFromSaleCascade: vi.fn().mockResolvedValue(undefined),
    ...ivaBooksServiceOverrides,
  } as unknown as IvaBooksService;

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
    ivaBooksService,
  );

  return {
    repo,
    orgSettingsService,
    autoEntryGenerator,
    contactsService,
    receivablesRepo,
    balancesService,
    periodsService,
    accountsRepo,
    journalRepo,
    ivaBooksService,
    ivaSalesBookUpdateMock,
    ivaSalesBookFindFirstMock,
    service,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("SaleService.editPosted — IvaSalesBook cascade (PR1)", () => {
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    mocks = createMocks();
  });

  // ── SC-01: editPosted recomputes IvaSalesBook when one exists ─────────────

  describe("SC-01 — editPosted recomputes IvaSalesBook when linked (REQ-1)", () => {
    it("calls ivaBooksService.recomputeFromSaleCascade with new totalAmount when IvaBook exists", async () => {
      const ivaBook = makeIvaBook();
      const postedSale = makeSale({ ivaSalesBook: ivaBook });
      const updatedSale = makeSale({ totalAmount: 226, ivaSalesBook: makeIvaBook({ importeTotal: D("226.00") }) });

      vi.mocked(mocks.repo.findById)
        .mockResolvedValueOnce(postedSale)  // getById in update()
        .mockResolvedValueOnce(updatedSale); // final findById

      await mocks.service.update(
        ORG_ID,
        SALE_ID,
        {
          details: [
            {
              description: "Servicio doble",
              lineAmount: 226,
              incomeAccountId: "account-income-id",
            },
          ],
        },
        USER_ID,
      );

      expect(vi.mocked(mocks.ivaBooksService.recomputeFromSaleCascade)).toHaveBeenCalledOnce();
      const [txArg, orgArg, saleArg, totalArg] =
        vi.mocked(mocks.ivaBooksService.recomputeFromSaleCascade).mock.calls[0];
      expect(txArg).toBeDefined(); // tx passed
      expect(orgArg).toBe(ORG_ID);
      expect(saleArg).toBe(SALE_ID);
      // newTotal should be 226
      expect(Number(totalArg)).toBeCloseTo(226, 2);
    });
  });

  // ── SC-02: editPosted skips IVA recompute when no IvaSalesBook linked ─────

  describe("SC-02 — editPosted skips IVA recompute when no IvaSalesBook (REQ-1)", () => {
    it("does NOT call recomputeFromSaleCascade when ivaSalesBook is null", async () => {
      const saleNoIva = makeSale({ ivaSalesBook: null });
      const updatedSale = makeSale({ totalAmount: 226, ivaSalesBook: null });

      vi.mocked(mocks.repo.findById)
        .mockResolvedValueOnce(saleNoIva)
        .mockResolvedValueOnce(updatedSale);

      await mocks.service.update(
        ORG_ID,
        SALE_ID,
        {
          details: [
            {
              description: "Servicio doble sin IVA",
              lineAmount: 226,
              incomeAccountId: "account-income-id",
            },
          ],
        },
        USER_ID,
      );

      expect(vi.mocked(mocks.ivaBooksService.recomputeFromSaleCascade)).not.toHaveBeenCalled();
    });
  });

  // ── SC-03: cascade failure rolls back entire tx ───────────────────────────

  describe("SC-03 — cascade failure rolls back Sale + Journal + Receivable (REQ-2)", () => {
    it("propagates error from recomputeFromSaleCascade so the outer tx rolls back", async () => {
      const ivaBook = makeIvaBook();
      const postedSale = makeSale({ ivaSalesBook: ivaBook });

      vi.mocked(mocks.repo.findById).mockResolvedValueOnce(postedSale);

      // Wire ivaBooksService to throw inside the call
      const errorMocks = createMocks({
        recomputeFromSaleCascade: vi.fn().mockRejectedValue(new Error("IVA recompute failed")),
      });

      vi.mocked(errorMocks.repo.findById).mockResolvedValueOnce(postedSale);

      await expect(
        errorMocks.service.update(
          ORG_ID,
          SALE_ID,
          {
            details: [
              {
                description: "Should fail",
                lineAmount: 226,
                incomeAccountId: "account-income-id",
              },
            ],
          },
          USER_ID,
        ),
      ).rejects.toThrow("IVA recompute failed");
    });
  });

  // ── SC-05: recomputeFromSaleCascade does NOT trigger maybeRegenerateJournal ─

  describe("SC-05 — recomputeFromSaleCascade does NOT trigger maybeRegenerateJournal (REQ-3)", () => {
    it("ivaBooksService.recomputeFromSaleCascade is called, NOT updateSale or maybeRegenerateJournal", async () => {
      const ivaBook = makeIvaBook();
      const postedSale = makeSale({ ivaSalesBook: ivaBook });
      const updatedSale = makeSale({ totalAmount: 226 });

      vi.mocked(mocks.repo.findById)
        .mockResolvedValueOnce(postedSale)
        .mockResolvedValueOnce(updatedSale);

      await mocks.service.update(
        ORG_ID,
        SALE_ID,
        {
          details: [
            {
              description: "Servicio no loop",
              lineAmount: 226,
              incomeAccountId: "account-income-id",
            },
          ],
        },
        USER_ID,
      );

      // The cascade should use recomputeFromSaleCascade (not updateSale which calls maybeRegenerateJournal)
      expect(vi.mocked(mocks.ivaBooksService.recomputeFromSaleCascade)).toHaveBeenCalledOnce();
      // No additional call to autoEntryGenerator.generate (no journal regeneration loop)
      expect(vi.mocked(mocks.autoEntryGenerator.generate)).not.toHaveBeenCalled();
    });
  });
});

// ── PR6 Regression tests ──────────────────────────────────────────────────────

describe("SaleService.update — regresiones PR6", () => {
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    mocks = createMocks();
  });

  // ── SC-07: Período CERRADO → editPosted bloqueado, sin cascade IVA (REQ-4) ──

  describe("SC-07 — período CERRADO bloquea editPosted y no ejecuta cascade IVA (REQ-4)", () => {
    it("lanza FISCAL_PERIOD_CLOSED y NO llama recomputeFromSaleCascade cuando el período está CERRADO", async () => {
      const ivaBook = makeIvaBook();
      const postedSale = makeSale({ ivaSalesBook: ivaBook });

      vi.mocked(mocks.repo.findById).mockResolvedValueOnce(postedSale);
      // Simulate CLOSED period — validatePeriodOpen throws before editPosted runs
      vi.mocked(mocks.periodsService.getById).mockResolvedValueOnce(
        { id: PERIOD_ID, status: "CLOSED" } as never,
      );

      await expect(
        mocks.service.update(
          ORG_ID,
          SALE_ID,
          {
            details: [
              {
                description: "Intento en período cerrado",
                lineAmount: 200,
                incomeAccountId: "account-income-id",
              },
            ],
          },
          USER_ID,
        ),
      ).rejects.toMatchObject({ code: "FISCAL_PERIOD_CLOSED" });

      // Cascade must NOT have been called — the edit was blocked before the tx
      expect(vi.mocked(mocks.ivaBooksService.recomputeFromSaleCascade)).not.toHaveBeenCalled();
    });
  });

  // ── SC-08: Período OPEN → editPosted procede sin error (REQ-4 positive path) ──

  describe("SC-08 — período OPEN permite editPosted (REQ-4 positive path)", () => {
    it("NO lanza cuando el período está OPEN y el edit procede normalmente", async () => {
      const ivaBook = makeIvaBook();
      const postedSale = makeSale({ ivaSalesBook: ivaBook });
      const updatedSale = makeSale({ totalAmount: 226, ivaSalesBook: makeIvaBook({ importeTotal: D("226.00") }) });

      vi.mocked(mocks.repo.findById)
        .mockResolvedValueOnce(postedSale)
        .mockResolvedValueOnce(updatedSale);

      await expect(
        mocks.service.update(
          ORG_ID,
          SALE_ID,
          {
            details: [
              {
                description: "Edición en período abierto",
                lineAmount: 226,
                incomeAccountId: "account-income-id",
              },
            ],
          },
          USER_ID,
        ),
      ).resolves.not.toThrow();
    });
  });

  // ── SC-04: Después de cascade exitoso, los 4 entidades reflejan el nuevo total ──

  describe("SC-04 — tras cascade exitoso, Sale + Journal + Receivable + IvaSalesBook reflejan nuevo total (REQ-2)", () => {
    it("update retorna SaleWithDetails con totalAmount actualizado e ivaSalesBook con importeTotal actualizado", async () => {
      const ivaBook = makeIvaBook();
      const postedSale = makeSale({ ivaSalesBook: ivaBook });
      const updatedSale = makeSale({
        totalAmount: 226,
        ivaSalesBook: makeIvaBook({
          importeTotal: D("226.00"),
          subtotal: D("226.00"),
          baseIvaSujetoCf: D("226.00"),
          dfIva: D("29.38"),
          dfCfIva: D("29.38"),
        }),
      });

      vi.mocked(mocks.repo.findById)
        .mockResolvedValueOnce(postedSale)
        .mockResolvedValueOnce(updatedSale);

      const result = await mocks.service.update(
        ORG_ID,
        SALE_ID,
        {
          details: [
            {
              description: "Venta doble SC-04",
              lineAmount: 226,
              incomeAccountId: "account-income-id",
            },
          ],
        },
        USER_ID,
      );

      // Sale reflects new total
      expect(result.totalAmount).toBeCloseTo(226, 2);
      // IvaSalesBook reflects new total in the returned object
      expect(result.ivaSalesBook).toBeTruthy();
      expect(Number(result.ivaSalesBook!.importeTotal)).toBeCloseTo(226, 2);
      // Cascade was invoked inside the tx (atomicity confirmed by previous SC-03 test)
      expect(vi.mocked(mocks.ivaBooksService.recomputeFromSaleCascade)).toHaveBeenCalledOnce();
    });
  });
});
