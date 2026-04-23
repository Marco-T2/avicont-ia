/**
 * PR2 — dispatch-repo-noon-utc (RED → GREEN)
 *
 * Verifica que DispatchRepository normalice las fechas a UTC-noon al persistir.
 * REQ-E.1 (D.6 revision): date input "YYYY-MM-DD" debe almacenarse como noon UTC.
 *
 * Cubre los write sites con string inputs:
 * (a) create (DRAFT) — line 148
 * (b) update          — line 229
 * (c) createPostedTx  — line 466
 * (d) updateTx        — line 545
 *
 * NOTE: cloneToDraft (line 377) copia sourceDispatch.date que ya es un Date
 * object de Prisma — ese caso es pass-through de Date, no de string, y no
 * necesita normalización adicional aquí.
 *
 * All external dependencies are mocked — no DB access.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { DispatchRepository } from "../dispatch.repository";
import { DispatchType } from "@/generated/prisma/enums";

// ── Mock del cliente Prisma ───────────────────────────────────────────────────

const mockDispatchCreate = vi.fn();
const mockTxDispatchCreate = vi.fn();
const mockDispatchUpdate = vi.fn();
const mockTxDispatchUpdate = vi.fn();
const mockDispatchDetailDeleteMany = vi.fn();
const mockDispatchDetailCreateMany = vi.fn();
const mockDispatchFindFirst = vi.fn();
const mockTransaction = vi.fn();

const mockDb = {
  dispatch: {
    create: mockDispatchCreate,
    update: mockDispatchUpdate,
    findFirst: mockDispatchFindFirst,
    findMany: vi.fn(),
    count: vi.fn(),
  },
  dispatchDetail: {
    deleteMany: mockDispatchDetailDeleteMany,
    createMany: mockDispatchDetailCreateMany,
  },
  $transaction: mockTransaction,
  organizationMembership: { findFirst: vi.fn() },
};

// ── Fixture mínimo de retorno de Prisma ──────────────────────────────────────

function makePrismaRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "dispatch-id-1",
    organizationId: "org-1",
    dispatchType: DispatchType.NOTA_DESPACHO,
    status: "DRAFT",
    sequenceNumber: 0,
    referenceNumber: null,
    date: new Date("2026-04-17T12:00:00.000Z"),
    contactId: "contact-1",
    periodId: "period-1",
    description: "Test dispatch",
    notes: null,
    farmOrigin: null,
    chickenCount: null,
    shrinkagePct: null,
    avgKgPerChicken: null,
    totalGrossKg: null,
    totalNetKg: null,
    totalShrinkKg: null,
    totalAmount: { toNumber: () => 0 },
    createdById: "user-1",
    details: [],
    receivable: null,
    journalEntry: null,
    ...overrides,
  };
}

// ── Fixture de input ──────────────────────────────────────────────────────────

// CreateDispatchInput.date is Date (z.coerce.date converts at validation boundary)
// We pass a UTC-midnight Date to test that toNoonUtc normalizes it to noon UTC
const BASE_INPUT = {
  date: new Date("2026-04-17T00:00:00.000Z"),
  dispatchType: DispatchType.NOTA_DESPACHO,
  contactId: "contact-1",
  periodId: "period-1",
  description: "Test dispatch",
  createdById: "user-1",
  details: [],
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("DispatchRepository — noon-UTC normalization (REQ-E.1, D.6)", () => {
  let repo: DispatchRepository;

  beforeEach(() => {
    vi.clearAllMocks();
     
    repo = new DispatchRepository(mockDb as any);
    mockDispatchCreate.mockResolvedValue(makePrismaRow());
    mockDispatchUpdate.mockResolvedValue(makePrismaRow());
    mockDispatchFindFirst.mockResolvedValue(makePrismaRow());
  });

  it("(a) create() stores date as noon UTC when input is 'YYYY-MM-DD'", async () => {
    await repo.create("org-1", BASE_INPUT, 1, []);

    expect(mockDispatchCreate).toHaveBeenCalledOnce();
    const callArgs = mockDispatchCreate.mock.calls[0][0];
    const storedDate: Date = callArgs.data.date;

    expect(storedDate).toBeInstanceOf(Date);
    expect(storedDate.toISOString()).toBe("2026-04-17T12:00:00.000Z");
  });

  it("(b) update() stores date as noon UTC when input.date is provided", async () => {
    const mockTx = {
      dispatch: {
        update: mockDispatchUpdate,
        findFirst: mockDispatchFindFirst,
      },
      dispatchDetail: {
        deleteMany: mockDispatchDetailDeleteMany,
        createMany: mockDispatchDetailCreateMany,
      },
    };
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockTx));

    await repo.update("org-1", "dispatch-id-1", { date: new Date("2026-04-17T00:00:00.000Z") });

    expect(mockDispatchUpdate).toHaveBeenCalledOnce();
    const callArgs = mockDispatchUpdate.mock.calls[0][0];
    const storedDate: Date = callArgs.data.date;

    expect(storedDate).toBeInstanceOf(Date);
    expect(storedDate.toISOString()).toBe("2026-04-17T12:00:00.000Z");
  });

  it("(c) createPostedTx() stores date as noon UTC when input is 'YYYY-MM-DD'", async () => {
    const mockTx = {
      dispatch: { create: mockTxDispatchCreate },
      dispatchDetail: { deleteMany: vi.fn(), createMany: vi.fn() },
    };
    mockTxDispatchCreate.mockResolvedValue(makePrismaRow());

     
    await repo.createPostedTx(mockTx as any, "org-1", BASE_INPUT, 1, [], 0);

    expect(mockTxDispatchCreate).toHaveBeenCalledOnce();
    const callArgs = mockTxDispatchCreate.mock.calls[0][0];
    const storedDate: Date = callArgs.data.date;

    expect(storedDate).toBeInstanceOf(Date);
    expect(storedDate.toISOString()).toBe("2026-04-17T12:00:00.000Z");
  });

  it("(d) updateTx() stores date as noon UTC when input.date is provided", async () => {
    const mockTx = {
      dispatch: { update: mockTxDispatchUpdate, findFirst: vi.fn() },
      dispatchDetail: {
        deleteMany: mockDispatchDetailDeleteMany,
        createMany: mockDispatchDetailCreateMany,
      },
    };
    mockTxDispatchUpdate.mockResolvedValue(makePrismaRow());

     
    await repo.updateTx(mockTx as any, "org-1", "dispatch-id-1", { date: new Date("2026-04-17T00:00:00.000Z") });

    expect(mockTxDispatchUpdate).toHaveBeenCalledOnce();
    const callArgs = mockTxDispatchUpdate.mock.calls[0][0];
    const storedDate: Date = callArgs.data.date;

    expect(storedDate).toBeInstanceOf(Date);
    expect(storedDate.toISOString()).toBe("2026-04-17T12:00:00.000Z");
  });
});
