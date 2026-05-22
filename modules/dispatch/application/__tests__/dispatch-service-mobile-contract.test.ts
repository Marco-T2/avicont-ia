/**
 * TDD RED → GREEN — mobile offline contract tests for DispatchService.
 *
 * Change B: periodId optional — service resolves via findByDate when missing.
 * Change C: clientId idempotency — service deduplicates via findByClientId.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DispatchService,
  type DispatchServiceDeps,
  type CreateDispatchInput,
} from "../dispatch.service";
import { DispatchPeriodNotFoundForDate } from "../../domain/errors/dispatch-errors";
import type { DispatchRepository } from "../../domain/ports/dispatch.repository";
import type { DispatchJournalEntryFactoryPort } from "../../domain/ports/dispatch-journal-entry-factory.port";
import type { DispatchAccountBalancesPort } from "../../domain/ports/dispatch-account-balances.port";
import type { DispatchOrgSettingsReaderPort } from "../../domain/ports/dispatch-org-settings-reader.port";
import type { DispatchContactsPort } from "../../domain/ports/dispatch-contacts.port";
import type { DispatchFiscalPeriodsPort } from "../../domain/ports/dispatch-fiscal-periods.port";
import type { DispatchReceivablesPort } from "../../domain/ports/dispatch-receivables.port";
import { Dispatch } from "../../domain/dispatch.entity";

const ORG = "org-1";
const CLIENT_ID = "550e8400-e29b-41d4-a716-446655440000";

// ── Base period fixture ────────────────────────────────────────────────────

const OPEN_PERIOD = {
  id: "p-1",
  name: "2026-05",
  status: "OPEN",
  startDate: new Date("2026-05-01T00:00:00.000Z"),
  endDate: new Date("2026-05-31T23:59:59.999Z"),
};

// ── Minimal dispatch fixture (fromPersistence) ─────────────────────────────

function makePersistedDispatch(id = "d-existing"): Dispatch {
  const now = new Date();
  return Dispatch.fromPersistence({
    id,
    organizationId: ORG,
    dispatchType: "NOTA_DESPACHO",
    status: "DRAFT",
    sequenceNumber: 0,
    date: new Date("2026-05-19"),
    contactId: "c-1",
    periodId: "p-1",
    description: "Despacho existente",
    referenceNumber: null,
    notes: null,
    totalAmount: 0,
    journalEntryId: null,
    receivableId: null,
    createdById: "user-1",
    createdAt: now,
    updatedAt: now,
    details: [],
    receivable: null,
    farmOrigin: null,
    chickenCount: null,
    shrinkagePct: null,
    avgKgPerChicken: null,
    totalGrossKg: null,
    totalNetKg: null,
    totalShrinkKg: null,
    totalShortageKg: null,
    totalRealNetKg: null,
    clientId: CLIENT_ID,
  });
}

// ── Fake builders ──────────────────────────────────────────────────────────

function makeRepo(overrides: Partial<DispatchRepository> = {}): DispatchRepository {
  return {
    findById: async () => null,
    findAll: async () => [],
    findPaginated: async () => ({
      items: [],
      total: 0,
      page: 1,
      pageSize: 25,
      totalPages: 1,
    }),
    findByIdTx: async () => null,
    saveTx: async (d) => d,
    updateTx: async (d) => d,
    deleteTx: async () => {},
    getNextSequenceNumberTx: async () => 1,
    linkJournalAndReceivableTx: async () => {},
    updateStatusTx: async () => null as never,
    cloneToDraftTx: async (_o, s) => s,
    findByClientId: async () => null,
    ...overrides,
  };
}

function makeFactory(): DispatchJournalEntryFactoryPort {
  return {
    generateForDispatch: async () => "journal-1",
    regenerateForDispatchEdit: async () => ({
      oldJournalId: "j-old",
      newJournalId: "j-new",
    }),
  };
}

function makeBalances(): DispatchAccountBalancesPort {
  return {
    applyPost: async () => {},
    applyVoid: async () => {},
  };
}

function makeOrgSettings(): DispatchOrgSettingsReaderPort {
  return {
    getOrCreate: async () => ({
      roundingThreshold: 0.7,
      cxcAccountCode: "1.1.3",
    }),
  };
}

function makeContacts(): DispatchContactsPort {
  return {
    getActiveById: async () => ({
      id: "c-1",
      name: "Cliente Test",
      type: "CLIENTE",
      paymentTermsDays: 30,
    }),
  };
}

function makePeriods(overrides: Partial<DispatchFiscalPeriodsPort> = {}): DispatchFiscalPeriodsPort {
  return {
    getById: async () => OPEN_PERIOD,
    findByDate: async () => OPEN_PERIOD,
    ...overrides,
  };
}

function makeReceivables(): DispatchReceivablesPort {
  return {
    createTx: async () => "recv-1",
    voidTx: async () => {},
  };
}

function makeDeps(
  overrides: Partial<DispatchServiceDeps> = {},
): DispatchServiceDeps {
  return {
    repo: makeRepo(),
    journalEntryFactory: makeFactory(),
    accountBalances: makeBalances(),
    orgSettings: makeOrgSettings(),
    contacts: makeContacts(),
    fiscalPeriods: makePeriods(),
    receivables: makeReceivables(),
    ...overrides,
  };
}

function buildInput(
  overrides: Partial<CreateDispatchInput> = {},
): CreateDispatchInput {
  return {
    dispatchType: "NOTA_DESPACHO",
    date: new Date("2026-05-19"),
    contactId: "c-1",
    description: "Despacho test",
    createdById: "user-1",
    details: [
      {
        description: "L1",
        boxes: 1,
        grossWeight: 10,
        unitPrice: 50,
        order: 0,
      },
    ],
    ...overrides,
  };
}

// ── Change B: periodId resolution ──────────────────────────────────────────

describe("DispatchService.create — periodId optional (change B)", () => {
  it("resolves period via findByDate when periodId is absent", async () => {
    const findByDate = vi.fn(async () => OPEN_PERIOD);
    const service = new DispatchService(
      makeDeps({
        fiscalPeriods: makePeriods({ findByDate }),
      }),
    );

    const dispatch = await service.create(ORG, buildInput({ periodId: undefined }));
    expect(findByDate).toHaveBeenCalledWith(ORG, expect.any(Date));
    expect(dispatch.periodId).toBe("p-1");
  });

  it("uses periodId directly when provided (web retrocompatible)", async () => {
    const findByDate = vi.fn(async () => OPEN_PERIOD);
    const getById = vi.fn(async () => OPEN_PERIOD);
    const service = new DispatchService(
      makeDeps({
        fiscalPeriods: makePeriods({ findByDate, getById }),
      }),
    );

    const dispatch = await service.create(ORG, buildInput({ periodId: "p-1" }));
    expect(findByDate).not.toHaveBeenCalled();
    expect(getById).toHaveBeenCalledWith(ORG, "p-1");
    expect(dispatch.periodId).toBe("p-1");
  });

  it("throws when no period found for the date", async () => {
    const service = new DispatchService(
      makeDeps({
        fiscalPeriods: makePeriods({ findByDate: async () => null }),
      }),
    );

    await expect(
      service.create(ORG, buildInput({ periodId: undefined })),
    ).rejects.toThrow(DispatchPeriodNotFoundForDate);
  });
});

// ── Change B: createAndPost — periodId resolution ──────────────────────────

describe("DispatchService.createAndPost — periodId optional (change B)", () => {
  it("resolves period via findByDate when periodId is absent", async () => {
    const findByDate = vi.fn(async () => OPEN_PERIOD);
    const service = new DispatchService(
      makeDeps({
        fiscalPeriods: makePeriods({ findByDate }),
      }),
    );

    const { dispatch } = await service.createAndPost(
      ORG,
      buildInput({ periodId: undefined }),
      "user-1",
    );
    expect(findByDate).toHaveBeenCalledWith(ORG, expect.any(Date));
    expect(dispatch.periodId).toBe("p-1");
  });

  it("throws when no period found for the date", async () => {
    const service = new DispatchService(
      makeDeps({
        fiscalPeriods: makePeriods({ findByDate: async () => null }),
      }),
    );

    await expect(
      service.createAndPost(ORG, buildInput({ periodId: undefined }), "user-1"),
    ).rejects.toThrow(DispatchPeriodNotFoundForDate);
  });
});

// ── Change C: clientId idempotency ─────────────────────────────────────────

describe("DispatchService.create — clientId idempotency (change C)", () => {
  it("returns existing dispatch without creating when clientId already exists", async () => {
    const existing = makePersistedDispatch("d-existing");
    const saveTx = vi.fn(async (d: Dispatch) => d);
    const service = new DispatchService(
      makeDeps({
        repo: makeRepo({
          findByClientId: async () => existing,
          saveTx,
        }),
      }),
    );

    const result = await service.create(
      ORG,
      buildInput({ clientId: CLIENT_ID }),
    );

    expect(result.id).toBe("d-existing");
    expect(saveTx).not.toHaveBeenCalled();
  });

  it("creates new dispatch when clientId not found (first call)", async () => {
    const saveTx = vi.fn(async (d: Dispatch) => d);
    const service = new DispatchService(
      makeDeps({
        repo: makeRepo({
          findByClientId: async () => null,
          saveTx,
        }),
      }),
    );

    await service.create(ORG, buildInput({ clientId: CLIENT_ID }));
    expect(saveTx).toHaveBeenCalledOnce();
  });

  it("creates normally without clientId (web, no idempotency check)", async () => {
    const findByClientId = vi.fn(async () => null);
    const saveTx = vi.fn(async (d: Dispatch) => d);
    const service = new DispatchService(
      makeDeps({
        repo: makeRepo({ findByClientId, saveTx }),
      }),
    );

    await service.create(ORG, buildInput());
    expect(findByClientId).not.toHaveBeenCalled();
    expect(saveTx).toHaveBeenCalledOnce();
  });

  it("handles unique constraint race condition by returning existing dispatch", async () => {
    // Simulates: findByClientId returns null (race), then saveTx throws P2002
    const existing = makePersistedDispatch("d-race-winner");
    const saveTx = vi.fn().mockRejectedValueOnce(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
    );
    const findByClientId = vi
      .fn()
      .mockResolvedValueOnce(null) // first check: not found
      .mockResolvedValueOnce(existing); // recovery: found after race

    const service = new DispatchService(
      makeDeps({
        repo: makeRepo({ findByClientId, saveTx }),
      }),
    );

    const result = await service.create(
      ORG,
      buildInput({ clientId: CLIENT_ID }),
    );

    expect(result.id).toBe("d-race-winner");
    expect(saveTx).toHaveBeenCalledOnce();
  });
});
