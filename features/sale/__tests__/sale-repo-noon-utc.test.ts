/**
 * PR2 — sale-repo-noon-utc (RED → GREEN)
 *
 * Verifica que SaleRepository normalice las fechas a UTC-noon al persistir.
 * REQ-B.4: date input "YYYY-MM-DD" debe almacenarse como noon UTC.
 *
 * All external dependencies are mocked — no DB access.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { SaleRepository } from "../sale.repository";

// ── Mock del cliente Prisma ───────────────────────────────────────────────────

const mockSaleCreate = vi.fn();
const mockTxSaleCreate = vi.fn();
const mockSaleUpdate = vi.fn();
const mockSaleDetailDeleteMany = vi.fn();
const mockSaleCreateMany = vi.fn();
const mockSaleFindFirst = vi.fn();
const mockTransaction = vi.fn();

const mockDb = {
  sale: {
    create: mockSaleCreate,
    update: mockSaleUpdate,
    findFirst: mockSaleFindFirst,
    findMany: vi.fn(),
    count: vi.fn(),
  },
  saleDetail: {
    deleteMany: mockSaleDetailDeleteMany,
    createMany: mockSaleCreateMany,
  },
  $transaction: mockTransaction,
  // Requerido por BaseRepository.requireOrg
  organizationMembership: { findFirst: vi.fn() },
};

// ── Fixture mínimo de retorno de Prisma ──────────────────────────────────────

function makePrismaRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "sale-id-1",
    organizationId: "org-1",
    status: "DRAFT",
    sequenceNumber: 0,
    referenceNumber: null,
    date: new Date("2026-04-17T12:00:00.000Z"),
    contactId: "contact-1",
    periodId: "period-1",
    description: "Test sale",
    notes: null,
    totalAmount: { toNumber: () => 0 },
    createdById: "user-1",
    details: [],
    receivable: null,
    journalEntry: null,
    ...overrides,
  };
}

// ── Fixture de input ──────────────────────────────────────────────────────────

const BASE_INPUT = {
  date: "2026-04-17",
  contactId: "contact-1",
  periodId: "period-1",
  description: "Test sale",
  details: [],
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("SaleRepository — noon-UTC normalization (REQ-B.4)", () => {
  let repo: SaleRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    // Instanciar con el mock inyectado vía constructor (BaseRepository acepta db opcional)
     
    repo = new SaleRepository(mockDb as any);
    mockSaleCreate.mockResolvedValue(makePrismaRow());
  });

  it("(a) create() stores date as noon UTC when input is 'YYYY-MM-DD'", async () => {
    await repo.create("org-1", BASE_INPUT, "user-1", []);

    expect(mockSaleCreate).toHaveBeenCalledOnce();
    const callArgs = mockSaleCreate.mock.calls[0][0];
    const storedDate: Date = callArgs.data.date;

    expect(storedDate).toBeInstanceOf(Date);
    expect(storedDate.toISOString()).toBe("2026-04-17T12:00:00.000Z");
  });

  it("(b) createPostedTx() stores date as noon UTC when input is 'YYYY-MM-DD'", async () => {
    // createPostedTx recibe un tx client — usamos el mockTxSaleCreate
    const mockTx = {
      sale: { create: mockTxSaleCreate },
      saleDetail: { deleteMany: vi.fn(), createMany: vi.fn() },
    };
    mockTxSaleCreate.mockResolvedValue(makePrismaRow());

     
    await repo.createPostedTx(mockTx as any, "org-1", BASE_INPUT, "user-1", 1, [], 0);

    expect(mockTxSaleCreate).toHaveBeenCalledOnce();
    const callArgs = mockTxSaleCreate.mock.calls[0][0];
    const storedDate: Date = callArgs.data.date;

    expect(storedDate).toBeInstanceOf(Date);
    expect(storedDate.toISOString()).toBe("2026-04-17T12:00:00.000Z");
  });

  it("(c) update() stores date as noon UTC when input.date is provided", async () => {
    // update() usa $transaction — simulamos que llama tx.sale.update internamente
    const mockTx = {
      sale: {
        update: mockSaleUpdate,
        findFirst: mockSaleFindFirst,
      },
      saleDetail: {
        deleteMany: mockSaleDetailDeleteMany,
        createMany: mockSaleCreateMany,
      },
    };
    mockSaleUpdate.mockResolvedValue(makePrismaRow());
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockTx));

    await repo.update("org-1", "sale-id-1", { date: "2026-04-17" });

    expect(mockSaleUpdate).toHaveBeenCalledOnce();
    const callArgs = mockSaleUpdate.mock.calls[0][0];
    const storedDate: Date = callArgs.data.date;

    expect(storedDate).toBeInstanceOf(Date);
    expect(storedDate.toISOString()).toBe("2026-04-17T12:00:00.000Z");
  });
});
