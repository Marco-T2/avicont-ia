/**
 * PR5 — purchase-edit-cascade (RED → GREEN)
 *
 * Tests for editPosted IvaPurchaseBook cascade (REQ-11, SC-21).
 * Mirrors features/sale/__tests__/sale-edit-cascade.test.ts exactly.
 *
 * All external dependencies are mocked — no DB access.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { PurchaseService } from "../purchase.service";
import { PurchaseRepository } from "../purchase.repository";
import { OrgSettingsService } from "@/features/org-settings";
import { AutoEntryGenerator } from "@/features/shared/auto-entry-generator";
import { ContactsService } from "@/features/contacts/server";
import { PayablesRepository } from "@/features/payables/payables.repository";
import { AccountBalancesService } from "@/features/account-balances";
import { FiscalPeriodsService } from "@/features/fiscal-periods/server";
import { AccountsRepository } from "@/features/accounting/accounts.repository";
import { JournalRepository } from "@/features/accounting/journal.repository";
import { IvaBooksService } from "@/features/accounting/iva-books/iva-books.service";
import type { PurchaseWithDetails } from "../purchase.types";
import type { IvaPurchaseBookDTO } from "@/features/accounting/iva-books/iva-books.types";

// ── Helpers ───────────────────────────────────────────────────────────────────

const D = (v: string | number) => new Prisma.Decimal(String(v));
const ZERO = D("0");

const ORG_ID = "org-purchase-cascade-pr5";
const USER_ID = "user-purchase-cascade-pr5";
const PURCHASE_ID = "purchase-cascade-pr5";
const PERIOD_ID = "period-purchase-cascade-pr5";
const ENTRY_ID = "entry-purchase-cascade-pr5";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeIvaPurchaseBook(overrides: Partial<IvaPurchaseBookDTO> = {}): IvaPurchaseBookDTO {
  return {
    id: "iva-purchase-book-cascade-id",
    organizationId: ORG_ID,
    fiscalPeriodId: PERIOD_ID,
    purchaseId: PURCHASE_ID,
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

function makePurchase(overrides: Partial<PurchaseWithDetails> = {}): PurchaseWithDetails {
  return {
    id: PURCHASE_ID,
    organizationId: ORG_ID,
    sequenceNumber: 1,
    status: "POSTED",
    date: new Date("2025-03-15"),
    periodId: PERIOD_ID,
    contactId: "contact-purchase-cascade-001",
    description: "Compra cascade test",
    notes: null,
    referenceNumber: null,
    journalEntryId: ENTRY_ID,
    payableId: "payable-cascade-001",
    createdById: USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    totalAmount: 100,
    displayCode: "CE-001",
    purchaseType: "COMPRA_GENERAL",
    shrinkagePct: null,
    contact: { id: "contact-purchase-cascade-001", name: "Proveedor Cascade", type: "PROVEEDOR", paymentTermsDays: 30 },
    period: { id: PERIOD_ID, name: "Marzo 2025", status: "OPEN" },
    createdBy: { id: USER_ID, name: "Test User", email: "test@test.com" },
    details: [
      {
        id: "detail-purchase-cascade-01",
        purchaseId: PURCHASE_ID,
        description: "Servicio Cascade",
        lineAmount: 100,
        order: 0,
        quantity: 1,
        unitPrice: 100,
        expenseAccountId: "account-expense-id",
      },
    ],
    payable: null,
    ivaPurchaseBook: null,
    ...overrides,
  } as unknown as PurchaseWithDetails;
}

// ── Bridge interface (mirrors IvaBooksServiceForSaleCascade) ──────────────────

interface IvaBooksServiceForPurchaseCascade {
  recomputeFromPurchaseCascade(
    tx: Prisma.TransactionClient,
    orgId: string,
    purchaseId: string,
    newTotal: Prisma.Decimal,
  ): Promise<void>;
}

// ── Mock factory ──────────────────────────────────────────────────────────────

function createMocks(ivaBooksServiceOverrides?: Partial<IvaBooksServiceForPurchaseCascade>) {
  const ivaPurchaseBookUpdateMock = vi.fn().mockResolvedValue({});
  const ivaPurchaseBookFindFirstMock = vi.fn().mockResolvedValue(makeIvaPurchaseBook());

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
    linkJournalAndPayable: vi.fn(),
    transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const mockTx = {
        $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
        ivaPurchaseBook: {
          findFirst: ivaPurchaseBookFindFirstMock,
          findUnique: vi.fn().mockResolvedValue(makeIvaPurchaseBook()),
          update: ivaPurchaseBookUpdateMock,
        },
        journalEntry: {
          findFirst: vi.fn().mockResolvedValue({
            id: ENTRY_ID,
            lines: [],
            contact: null,
            voucherType: { code: "CE" },
          }),
          update: vi.fn().mockResolvedValue({}),
        },
        paymentAllocation: {
          findMany: vi.fn().mockResolvedValue([]),
          delete: vi.fn(),
          update: vi.fn(),
          deleteMany: vi.fn(),
        },
        accountsPayable: {
          findFirst: vi.fn().mockResolvedValue({ paid: 0 }),
          findUnique: vi.fn().mockResolvedValue({ paid: 0 }),
          update: vi.fn().mockResolvedValue({}),
        },
        fiscalPeriod: { findFirstOrThrow: vi.fn().mockResolvedValue({ id: PERIOD_ID, status: "OPEN" }) },
        purchase: { update: vi.fn().mockResolvedValue({}) },
        purchaseDetail: { deleteMany: vi.fn(), createMany: vi.fn() },
      };
      return fn(mockTx);
    }),
  } as unknown as PurchaseRepository;

  const orgSettingsService = {
    getOrCreate: vi.fn().mockResolvedValue({
      cxpAccountCode: "2.1.1",
      expenseAccountCode: "5.1.1",
    }),
  } as unknown as OrgSettingsService;

  const autoEntryGenerator = {
    generate: vi.fn().mockResolvedValue({ id: ENTRY_ID, lines: [] }),
  } as unknown as AutoEntryGenerator;

  const contactsService = {
    getActiveById: vi.fn().mockResolvedValue({
      id: "contact-purchase-cascade-001",
      type: "PROVEEDOR",
      paymentTermsDays: 30,
    }),
  } as unknown as ContactsService;

  const payablesRepo = {
    createTx: vi.fn().mockResolvedValue({ id: "payable-cascade-001" }),
    voidTx: vi.fn(),
  } as unknown as PayablesRepository;

  const balancesService = {
    applyPost: vi.fn().mockResolvedValue(undefined),
    applyVoid: vi.fn().mockResolvedValue(undefined),
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

  const ivaBooksService = {
    recomputeFromPurchaseCascade: vi.fn().mockResolvedValue(undefined),
    ...ivaBooksServiceOverrides,
  } as unknown as IvaBooksService;

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
    ivaBooksService,
  );

  return {
    repo,
    orgSettingsService,
    autoEntryGenerator,
    contactsService,
    payablesRepo,
    balancesService,
    periodsService,
    accountsRepo,
    journalRepo,
    ivaBooksService,
    ivaPurchaseBookUpdateMock,
    ivaPurchaseBookFindFirstMock,
    service,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PurchaseService.editPosted — IvaPurchaseBook cascade (PR5 / REQ-11)", () => {
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    mocks = createMocks();
  });

  // ── SC-21: editPosted recomputes IvaPurchaseBook when linked ─────────────

  describe("SC-21 — editPosted recomputes IvaPurchaseBook when linked (REQ-11)", () => {
    it("calls ivaBooksService.recomputeFromPurchaseCascade with new totalAmount when IvaBook exists", async () => {
      const ivaBook = makeIvaPurchaseBook();
      const postedPurchase = makePurchase({ ivaPurchaseBook: ivaBook });
      const updatedPurchase = makePurchase({
        totalAmount: 226,
        ivaPurchaseBook: makeIvaPurchaseBook({ importeTotal: D("226.00") }),
      });

      vi.mocked(mocks.repo.findById)
        .mockResolvedValueOnce(postedPurchase)   // getById in update()
        .mockResolvedValueOnce(updatedPurchase); // final findById

      await mocks.service.update(
        ORG_ID,
        PURCHASE_ID,
        {
          details: [
            {
              description: "Servicio doble",
              lineAmount: 226,
              expenseAccountId: "account-expense-id",
            },
          ],
        },
        USER_ID,
      );

      expect(vi.mocked(mocks.ivaBooksService.recomputeFromPurchaseCascade)).toHaveBeenCalledOnce();
      const [txArg, orgArg, purchaseArg, totalArg] =
        vi.mocked(mocks.ivaBooksService.recomputeFromPurchaseCascade).mock.calls[0];
      expect(txArg).toBeDefined(); // tx passed
      expect(orgArg).toBe(ORG_ID);
      expect(purchaseArg).toBe(PURCHASE_ID);
      // newTotal should be 226
      expect(Number(totalArg)).toBeCloseTo(226, 2);
    });
  });

  // ── SC-21 no-op: editPosted skips IVA recompute when no IvaPurchaseBook linked

  describe("SC-21 no-op — editPosted skips IVA recompute when no IvaPurchaseBook (REQ-11)", () => {
    it("does NOT call recomputeFromPurchaseCascade when ivaPurchaseBook is null", async () => {
      const purchaseNoIva = makePurchase({ ivaPurchaseBook: null });
      const updatedPurchase = makePurchase({ totalAmount: 226, ivaPurchaseBook: null });

      vi.mocked(mocks.repo.findById)
        .mockResolvedValueOnce(purchaseNoIva)
        .mockResolvedValueOnce(updatedPurchase);

      await mocks.service.update(
        ORG_ID,
        PURCHASE_ID,
        {
          details: [
            {
              description: "Servicio doble sin IVA",
              lineAmount: 226,
              expenseAccountId: "account-expense-id",
            },
          ],
        },
        USER_ID,
      );

      expect(vi.mocked(mocks.ivaBooksService.recomputeFromPurchaseCascade)).not.toHaveBeenCalled();
    });
  });

  // ── SC-21 atomicity: cascade failure rolls back entire tx ─────────────────

  describe("SC-21 atomicity — cascade failure rolls back Purchase + Journal + Payable (REQ-11)", () => {
    it("propagates error from recomputeFromPurchaseCascade so the outer tx rolls back", async () => {
      const ivaBook = makeIvaPurchaseBook();
      const postedPurchase = makePurchase({ ivaPurchaseBook: ivaBook });

      const errorMocks = createMocks({
        recomputeFromPurchaseCascade: vi.fn().mockRejectedValue(new Error("IVA purchase recompute failed")),
      });

      vi.mocked(errorMocks.repo.findById).mockResolvedValueOnce(postedPurchase);

      await expect(
        errorMocks.service.update(
          ORG_ID,
          PURCHASE_ID,
          {
            details: [
              {
                description: "Should fail",
                lineAmount: 226,
                expenseAccountId: "account-expense-id",
              },
            ],
          },
          USER_ID,
        ),
      ).rejects.toThrow("IVA purchase recompute failed");
    });
  });

  // ── SC-21 no-loop: recomputeFromPurchaseCascade does NOT trigger maybeRegenerateJournal

  describe("SC-21 no-loop — recomputeFromPurchaseCascade does NOT trigger maybeRegenerateJournal (REQ-11)", () => {
    it("ivaBooksService.recomputeFromPurchaseCascade is called, NOT autoEntryGenerator.generate", async () => {
      const ivaBook = makeIvaPurchaseBook();
      const postedPurchase = makePurchase({ ivaPurchaseBook: ivaBook });
      const updatedPurchase = makePurchase({ totalAmount: 226 });

      vi.mocked(mocks.repo.findById)
        .mockResolvedValueOnce(postedPurchase)
        .mockResolvedValueOnce(updatedPurchase);

      await mocks.service.update(
        ORG_ID,
        PURCHASE_ID,
        {
          details: [
            {
              description: "Servicio no loop",
              lineAmount: 226,
              expenseAccountId: "account-expense-id",
            },
          ],
        },
        USER_ID,
      );

      expect(vi.mocked(mocks.ivaBooksService.recomputeFromPurchaseCascade)).toHaveBeenCalledOnce();
      // No additional call to autoEntryGenerator.generate (no journal regeneration loop)
      expect(vi.mocked(mocks.autoEntryGenerator.generate)).not.toHaveBeenCalled();
    });
  });
});

// ── PR6 Regression tests ──────────────────────────────────────────────────────

describe("PurchaseService.update — regresiones PR6", () => {
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    mocks = createMocks();
  });

  // ── SC-07 mirror: Período CERRADO → editPosted bloqueado, sin cascade IVA (REQ-4 / REQ-11) ──

  describe("SC-07 mirror — período CERRADO bloquea editPosted y no ejecuta cascade IVA (REQ-11)", () => {
    it("lanza FISCAL_PERIOD_CLOSED y NO llama recomputeFromPurchaseCascade cuando el período está CERRADO", async () => {
      const ivaBook = makeIvaPurchaseBook();
      const postedPurchase = makePurchase({ ivaPurchaseBook: ivaBook });

      vi.mocked(mocks.repo.findById).mockResolvedValueOnce(postedPurchase);
      vi.mocked(mocks.periodsService.getById).mockResolvedValueOnce(
        { id: PERIOD_ID, status: "CLOSED" } as never,
      );

      await expect(
        mocks.service.update(
          ORG_ID,
          PURCHASE_ID,
          {
            details: [
              {
                description: "Intento en período cerrado",
                lineAmount: 200,
                expenseAccountId: "account-expense-id",
              },
            ],
          },
          USER_ID,
        ),
      ).rejects.toMatchObject({ code: "FISCAL_PERIOD_CLOSED" });

      expect(vi.mocked(mocks.ivaBooksService.recomputeFromPurchaseCascade)).not.toHaveBeenCalled();
    });
  });

  // ── SC-08 mirror: Período OPEN → editPosted procede sin error ──

  describe("SC-08 mirror — período OPEN permite editPosted (REQ-11 positive path)", () => {
    it("NO lanza cuando el período está OPEN y el edit procede normalmente", async () => {
      const ivaBook = makeIvaPurchaseBook();
      const postedPurchase = makePurchase({ ivaPurchaseBook: ivaBook });
      const updatedPurchase = makePurchase({
        totalAmount: 226,
        ivaPurchaseBook: makeIvaPurchaseBook({ importeTotal: D("226.00") }),
      });

      vi.mocked(mocks.repo.findById)
        .mockResolvedValueOnce(postedPurchase)
        .mockResolvedValueOnce(updatedPurchase);

      await expect(
        mocks.service.update(
          ORG_ID,
          PURCHASE_ID,
          {
            details: [
              {
                description: "Edición en período abierto",
                lineAmount: 226,
                expenseAccountId: "account-expense-id",
              },
            ],
          },
          USER_ID,
        ),
      ).resolves.not.toThrow();
    });
  });
});
