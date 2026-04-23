/**
 * PR2 — purchase-repo-noon-utc (RED → GREEN)
 *
 * Verifica que PurchaseRepository normalice las fechas a UTC-noon al persistir.
 * REQ-D.3: date input "YYYY-MM-DD" debe almacenarse como noon UTC.
 *
 * All external dependencies are mocked — no DB access.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { PurchaseRepository } from "../purchase.repository";
import { PurchaseType } from "@/generated/prisma/enums";

// ── Mock del cliente Prisma ───────────────────────────────────────────────────

const mockPurchaseCreate = vi.fn();
const mockTxPurchaseCreate = vi.fn();
const mockPurchaseUpdate = vi.fn();
const mockPurchaseDetailDeleteMany = vi.fn();
const mockPurchaseDetailCreateMany = vi.fn();
const mockPurchaseFindFirst = vi.fn();
const mockTransaction = vi.fn();

const mockDb = {
  purchase: {
    create: mockPurchaseCreate,
    update: mockPurchaseUpdate,
    findFirst: mockPurchaseFindFirst,
    findMany: vi.fn(),
    count: vi.fn(),
  },
  purchaseDetail: {
    deleteMany: mockPurchaseDetailDeleteMany,
    createMany: mockPurchaseDetailCreateMany,
  },
  $transaction: mockTransaction,
  organizationMembership: { findFirst: vi.fn() },
};

// ── Fixture mínimo de retorno de Prisma ──────────────────────────────────────

function makePrismaRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "purchase-id-1",
    organizationId: "org-1",
    purchaseType: PurchaseType.COMPRA_GENERAL,
    status: "DRAFT",
    sequenceNumber: 0,
    referenceNumber: null,
    date: new Date("2026-04-17T12:00:00.000Z"),
    contactId: "contact-1",
    periodId: "period-1",
    description: "Test purchase",
    notes: null,
    ruta: null,
    farmOrigin: null,
    chickenCount: null,
    shrinkagePct: null,
    totalGrossKg: null,
    totalNetKg: null,
    totalShrinkKg: null,
    avgKgPerChicken: null,
    totalAmount: { toNumber: () => 0 },
    createdById: "user-1",
    details: [],
    payable: null,
    journalEntry: null,
    ...overrides,
  };
}

// ── Fixture de input ──────────────────────────────────────────────────────────

const BASE_INPUT = {
  date: "2026-04-17",
  purchaseType: PurchaseType.COMPRA_GENERAL,
  contactId: "contact-1",
  periodId: "period-1",
  description: "Test purchase",
  details: [],
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PurchaseRepository — noon-UTC normalization (REQ-D.3)", () => {
  let repo: PurchaseRepository;

  beforeEach(() => {
    vi.clearAllMocks();
     
    repo = new PurchaseRepository(mockDb as any);
    mockPurchaseCreate.mockResolvedValue(makePrismaRow());
  });

  it("(a) create() stores date as noon UTC when input is 'YYYY-MM-DD'", async () => {
    await repo.create("org-1", BASE_INPUT, "user-1", []);

    expect(mockPurchaseCreate).toHaveBeenCalledOnce();
    const callArgs = mockPurchaseCreate.mock.calls[0][0];
    const storedDate: Date = callArgs.data.date;

    expect(storedDate).toBeInstanceOf(Date);
    expect(storedDate.toISOString()).toBe("2026-04-17T12:00:00.000Z");
  });

  it("(b) createPostedTx() stores date as noon UTC when input is 'YYYY-MM-DD'", async () => {
    const mockTx = {
      purchase: { create: mockTxPurchaseCreate },
      purchaseDetail: { deleteMany: vi.fn(), createMany: vi.fn() },
    };
    mockTxPurchaseCreate.mockResolvedValue(makePrismaRow());

     
    await repo.createPostedTx(mockTx as any, "org-1", BASE_INPUT, "user-1", 1, [], 0);

    expect(mockTxPurchaseCreate).toHaveBeenCalledOnce();
    const callArgs = mockTxPurchaseCreate.mock.calls[0][0];
    const storedDate: Date = callArgs.data.date;

    expect(storedDate).toBeInstanceOf(Date);
    expect(storedDate.toISOString()).toBe("2026-04-17T12:00:00.000Z");
  });

  it("(c) update() stores date as noon UTC when input.date is provided", async () => {
    const mockTx = {
      purchase: {
        update: mockPurchaseUpdate,
        findFirst: mockPurchaseFindFirst,
      },
      purchaseDetail: {
        deleteMany: mockPurchaseDetailDeleteMany,
        createMany: mockPurchaseDetailCreateMany,
      },
    };
    mockPurchaseUpdate.mockResolvedValue(makePrismaRow());
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockTx));

    await repo.update("org-1", "purchase-id-1", { date: "2026-04-17" });

    expect(mockPurchaseUpdate).toHaveBeenCalledOnce();
    const callArgs = mockPurchaseUpdate.mock.calls[0][0];
    const storedDate: Date = callArgs.data.date;

    expect(storedDate).toBeInstanceOf(Date);
    expect(storedDate.toISOString()).toBe("2026-04-17T12:00:00.000Z");
  });
});
