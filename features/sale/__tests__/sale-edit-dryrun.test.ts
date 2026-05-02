/**
 * PR2 — sale-edit-cascade: dryRun & confirmTrim (RED → GREEN)
 *
 * Tests for SaleService.getEditPreview (REQ-5, SC-09, SC-10)
 * and route-level dryRun / requiresConfirmation (REQ-7, SC-13, SC-14).
 *
 * All external dependencies are mocked — no DB access.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { SaleService } from "../sale.service";
import { SaleRepository } from "../sale.repository";
import { OrgSettingsService } from "@/features/org-settings/server";
import { AutoEntryGenerator } from "@/features/accounting/server";
import { ContactsService } from "@/features/contacts/server";
import { ReceivablesRepository } from "@/features/receivables/receivables.repository";
import { AccountBalancesService } from "@/features/account-balances/server";
import { FiscalPeriodsService } from "@/features/fiscal-periods/server";
import { AccountsRepository } from "@/features/accounting/accounts.repository";
import { JournalRepository } from "@/features/accounting/journal.repository";
import type { SaleWithDetails } from "@/modules/sale/presentation/dto/sale-with-details";

// ── Helpers ───────────────────────────────────────────────────────────────────

const D = (v: string | number) => new Prisma.Decimal(String(v));

const ORG_ID = "org-dryrun-pr2";
const USER_ID = "user-dryrun-pr2";
const SALE_ID = "sale-dryrun-pr2";
const PERIOD_ID = "period-dryrun-pr2";
const RECV_ID = "recv-dryrun-pr2";
const ALLOC_ID_1 = "alloc-dryrun-01";
const ALLOC_ID_2 = "alloc-dryrun-02";
const PAYMENT_ID_1 = "pay-dryrun-01";
const PAYMENT_ID_2 = "pay-dryrun-02";

const PAY_DATE_1 = new Date("2025-01-10");
const PAY_DATE_2 = new Date("2025-02-20");

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeSale(overrides: Partial<SaleWithDetails> = {}): SaleWithDetails {
  return {
    id: SALE_ID,
    organizationId: ORG_ID,
    sequenceNumber: 1,
    status: "POSTED",
    date: new Date("2025-03-15"),
    periodId: PERIOD_ID,
    contactId: "contact-dryrun-001",
    description: "Venta dryRun test",
    notes: null,
    referenceNumber: null,
    journalEntryId: "entry-dryrun-001",
    receivableId: RECV_ID,
    createdById: USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    totalAmount: 100,
    displayCode: "VG-002",
    contact: { id: "contact-dryrun-001", name: "Cliente DryRun", type: "CLIENTE", paymentTermsDays: 30 },
    period: { id: PERIOD_ID, name: "Enero 2025", status: "OPEN" },
    details: [
      {
        id: "detail-dryrun-01",
        saleId: SALE_ID,
        description: "Servicio DryRun",
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

type PaymentAllocationWithPayment = {
  id: string;
  paymentId: string;
  receivableId: string | null;
  payableId: string | null;
  amount: Prisma.Decimal;
  payment: { date: Date };
};

function makeAllocations(amount1 = 60, amount2 = 40): PaymentAllocationWithPayment[] {
  return [
    {
      id: ALLOC_ID_2,          // LIFO: most recent id first (desc order)
      paymentId: PAYMENT_ID_2,
      receivableId: RECV_ID,
      payableId: null,
      amount: D(amount2),
      payment: { date: PAY_DATE_2 },
    },
    {
      id: ALLOC_ID_1,
      paymentId: PAYMENT_ID_1,
      receivableId: RECV_ID,
      payableId: null,
      amount: D(amount1),
      payment: { date: PAY_DATE_1 },
    },
  ];
}

function createServiceMocks(allocationOverride?: PaymentAllocationWithPayment[]) {
  const allocations = allocationOverride ?? makeAllocations();

  const repo = {
    findById: vi.fn().mockResolvedValue(makeSale()),
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
        accountsReceivable: {
          findFirst: vi.fn().mockResolvedValue({ paid: D(100) }),
          findUnique: vi.fn().mockResolvedValue({ paid: D(100) }),
          update: vi.fn().mockResolvedValue({}),
        },
        paymentAllocation: {
          findMany: vi.fn().mockResolvedValue(allocations),
          delete: vi.fn(),
          update: vi.fn(),
          deleteMany: vi.fn(),
        },
        journalEntry: {
          findFirst: vi.fn().mockResolvedValue({ id: "entry-dr-01", lines: [], contact: null, voucherType: { code: "CI" } }),
          update: vi.fn().mockResolvedValue({}),
        },
        fiscalPeriod: { findFirstOrThrow: vi.fn().mockResolvedValue({ id: PERIOD_ID, status: "OPEN" }) },
        sale: { update: vi.fn().mockResolvedValue({}) },
        saleDetail: { deleteMany: vi.fn(), createMany: vi.fn() },
        ivaSalesBook: { findFirst: vi.fn().mockResolvedValue(null) },
      };
      return fn(mockTx);
    }),
  } as unknown as SaleRepository;

  // Separate mock tx for getEditPreview (no-transaction path uses repo.transaction)
  const allocationFindManyMock = vi.fn().mockResolvedValue(allocations);
  const receivableFindFirstMock = vi.fn().mockResolvedValue({ paid: D(100) });

  // Override the transaction mock to capture the tx's paymentAllocation.findMany
  (repo.transaction as ReturnType<typeof vi.fn>).mockImplementation(
    async (fn: (tx: unknown) => unknown) => {
      const mockTx = {
        $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
        accountsReceivable: {
          findFirst: receivableFindFirstMock,
          findUnique: receivableFindFirstMock,
          update: vi.fn().mockResolvedValue({}),
        },
        paymentAllocation: {
          findMany: allocationFindManyMock,
          delete: vi.fn(),
          update: vi.fn(),
          deleteMany: vi.fn(),
        },
        journalEntry: {
          findFirst: vi.fn().mockResolvedValue({ id: "entry-dr-01", lines: [], contact: null, voucherType: { code: "CI" } }),
          update: vi.fn().mockResolvedValue({}),
        },
        fiscalPeriod: { findFirstOrThrow: vi.fn().mockResolvedValue({ id: PERIOD_ID, status: "OPEN" }) },
        sale: { update: vi.fn().mockResolvedValue({}) },
        saleDetail: { deleteMany: vi.fn(), createMany: vi.fn() },
        ivaSalesBook: { findFirst: vi.fn().mockResolvedValue(null) },
      };
      return fn(mockTx);
    },
  );

  const orgSettingsService = {
    getOrCreate: vi.fn().mockResolvedValue({ cxcAccountCode: "1.1.3" }),
  } as unknown as OrgSettingsService;

  const autoEntryGenerator = {
    generate: vi.fn().mockResolvedValue({ id: "entry-dr-01", lines: [] }),
  } as unknown as AutoEntryGenerator;

  const contactsService = {
    getActiveById: vi.fn().mockResolvedValue({ id: "contact-dryrun-001", type: "CLIENTE", paymentTermsDays: 30 }),
  } as unknown as ContactsService;

  const receivablesRepo = {
    createTx: vi.fn().mockResolvedValue({ id: RECV_ID }),
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
    updateTx: vi.fn().mockResolvedValue({ id: "entry-dr-01", lines: [] }),
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

  return { repo, service, allocationFindManyMock, receivableFindFirstMock };
}

// ── Tests: SaleService.getEditPreview ────────────────────────────────────────

describe("SaleService.getEditPreview (REQ-5)", () => {
  let mocks: ReturnType<typeof createServiceMocks>;

  beforeEach(() => {
    mocks = createServiceMocks();
  });

  // SC-09: newTotal < paid → returns trimPreview with LIFO allocation list
  it("SC-09 — retorna trimPreview con asignaciones a recortar cuando newTotal < totalPagado", async () => {
    // totalAllocated = 100 (60 + 40), newTotal = 80 → excess = 20
    // LIFO: alloc2 (40) trimmed to 20, alloc1 (60) untouched
    const result = await mocks.service.getEditPreview(SALE_ID, ORG_ID, 80);

    expect(result.trimPreview).toHaveLength(1);
    expect(result.trimPreview[0]).toMatchObject({
      allocationId: ALLOC_ID_2,
      paymentDate: PAY_DATE_2.toISOString().split("T")[0],
      originalAmount: "40.00",
      trimmedTo: "20.00",
    });
  });

  // SC-10: newTotal >= paid → returns empty trimPreview
  it("SC-10 — retorna trimPreview vacío cuando newTotal >= totalPagado", async () => {
    // totalAllocated = 100, newTotal = 120 → no trim needed
    mocks.receivableFindFirstMock.mockResolvedValue({ paid: D(100) });

    const result = await mocks.service.getEditPreview(SALE_ID, ORG_ID, 120);

    expect(result.trimPreview).toHaveLength(0);
  });

  // No allocations → empty trimPreview even when newTotal < paid
  it("retorna trimPreview vacío cuando no hay asignaciones de pago", async () => {
    const noAllocMocks = createServiceMocks([]);
    noAllocMocks.receivableFindFirstMock.mockResolvedValue({ paid: D(0) });

    const result = await noAllocMocks.service.getEditPreview(SALE_ID, ORG_ID, 50);

    expect(result.trimPreview).toHaveLength(0);
  });

  // Multiple allocations partially trimmed (LIFO order)
  it("recorta múltiples asignaciones en orden LIFO cuando el exceso supera la primera", async () => {
    // totalAllocated = 100 (60 + 40), newTotal = 30 → excess = 70
    // LIFO: alloc2 (40) → trimmedTo 0 (deleted), alloc1 (60) → trimmedTo 30
    const result = await mocks.service.getEditPreview(SALE_ID, ORG_ID, 30);

    expect(result.trimPreview).toHaveLength(2);
    // alloc2 fully trimmed
    expect(result.trimPreview[0]).toMatchObject({
      allocationId: ALLOC_ID_2,
      originalAmount: "40.00",
      trimmedTo: "0.00",
    });
    // alloc1 partially trimmed
    expect(result.trimPreview[1]).toMatchObject({
      allocationId: ALLOC_ID_1,
      originalAmount: "60.00",
      trimmedTo: "30.00",
    });
  });
});
