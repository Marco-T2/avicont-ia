import { describe, it, expect } from "vitest";

/**
 * C1 RED — Application layer shape tests for POC dispatch-hex migration.
 * Validates DispatchService exists with expected method signatures.
 */

import {
  DispatchService,
  type DispatchServiceDeps,
} from "../application/dispatch.service";

import type {
  DispatchRepository,
} from "../domain/ports/dispatch.repository";

import type {
  DispatchJournalEntryFactoryPort,
} from "../domain/ports/dispatch-journal-entry-factory.port";

import type {
  DispatchAccountBalancesPort,
} from "../domain/ports/dispatch-account-balances.port";

import type {
  DispatchOrgSettingsReaderPort,
} from "../domain/ports/dispatch-org-settings-reader.port";

import type {
  DispatchContactsPort,
} from "../domain/ports/dispatch-contacts.port";

import type {
  DispatchFiscalPeriodsPort,
} from "../domain/ports/dispatch-fiscal-periods.port";

import type {
  DispatchReceivablesPort,
} from "../domain/ports/dispatch-receivables.port";

// ── In-memory fakes for compile-time shape verification ────────────────────

function makeInMemoryRepo(): DispatchRepository {
  return {
    findById: async () => null,
    findAll: async () => [],
    // Pagination cascade fake — empty-default `PaginatedResult<Dispatch>`
    // stub satisfies TS interface compile-gate after C1 port addition
    // (poc-sales-unified-pagination). Atomic same-commit per
    // [[mock_hygiene_commit_scope]].
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
    updateStatusTx: async (_o, _i, _s, _t, _sq) => null as never,
    cloneToDraftTx: async (_o, s) => s,
  };
}

function makeInMemoryJournalFactory(): DispatchJournalEntryFactoryPort {
  return {
    generateForDispatch: async () => "journal-1",
    regenerateForDispatchEdit: async () => ({
      oldJournalId: "j-old",
      newJournalId: "j-new",
    }),
  };
}

function makeInMemoryBalances(): DispatchAccountBalancesPort {
  return {
    applyPost: async () => {},
    applyVoid: async () => {},
  };
}

function makeInMemoryOrgSettings(): DispatchOrgSettingsReaderPort {
  return {
    getOrCreate: async () => ({
      roundingThreshold: 0.7,
      cxcAccountCode: "1.1.3",
    }),
  };
}

function makeInMemoryContacts(): DispatchContactsPort {
  return {
    getActiveById: async () => ({
      id: "c-1",
      name: "Test",
      type: "CLIENTE",
      paymentTermsDays: 30,
    }),
  };
}

function makeInMemoryPeriods(): DispatchFiscalPeriodsPort {
  return {
    getById: async () => ({
      id: "p-1",
      name: "2026-01",
      status: "OPEN",
    }),
  };
}

function makeInMemoryReceivables(): DispatchReceivablesPort {
  return {
    createTx: async () => "recv-1",
    voidTx: async () => {},
  };
}

function makeDeps(): DispatchServiceDeps {
  return {
    repo: makeInMemoryRepo(),
    journalEntryFactory: makeInMemoryJournalFactory(),
    accountBalances: makeInMemoryBalances(),
    orgSettings: makeInMemoryOrgSettings(),
    contacts: makeInMemoryContacts(),
    fiscalPeriods: makeInMemoryPeriods(),
    receivables: makeInMemoryReceivables(),
  };
}

describe("POC dispatch-hex C1 — application layer shape", () => {
  it("DispatchService instantiates with all deps", () => {
    const service = new DispatchService(makeDeps());
    expect(service).toBeInstanceOf(DispatchService);
  });

  it("DispatchService has list method", () => {
    const service = new DispatchService(makeDeps());
    expect(typeof service.list).toBe("function");
  });

  it("DispatchService has getById method", () => {
    const service = new DispatchService(makeDeps());
    expect(typeof service.getById).toBe("function");
  });

  it("DispatchService has create method", () => {
    const service = new DispatchService(makeDeps());
    expect(typeof service.create).toBe("function");
  });

  it("DispatchService has createAndPost method", () => {
    const service = new DispatchService(makeDeps());
    expect(typeof service.createAndPost).toBe("function");
  });

  it("DispatchService has update method", () => {
    const service = new DispatchService(makeDeps());
    expect(typeof service.update).toBe("function");
  });

  it("DispatchService has post method", () => {
    const service = new DispatchService(makeDeps());
    expect(typeof service.post).toBe("function");
  });

  it("DispatchService has void method", () => {
    const service = new DispatchService(makeDeps());
    expect(typeof service.voidDispatch).toBe("function");
  });

  it("DispatchService has delete method", () => {
    const service = new DispatchService(makeDeps());
    expect(typeof service.delete).toBe("function");
  });

  it("DispatchService has hardDelete method", () => {
    const service = new DispatchService(makeDeps());
    expect(typeof service.hardDelete).toBe("function");
  });

  it("DispatchService has recreate method", () => {
    const service = new DispatchService(makeDeps());
    expect(typeof service.recreate).toBe("function");
  });

  it("list returns empty array from empty repo", async () => {
    const service = new DispatchService(makeDeps());
    const result = await service.list("org-1");
    expect(result).toEqual([]);
  });

  it("getById throws NotFoundError for missing dispatch", async () => {
    const service = new DispatchService(makeDeps());
    await expect(service.getById("org-1", "nonexistent")).rejects.toThrow(
      "Despacho",
    );
  });
});
