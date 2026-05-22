/**
 * T-09 RED — glosa-enriquecida-ventas-cobros Phase 1.
 *
 * Asserts DispatchService.createAndPost passes sourceTypeCode "ND" for
 * NOTA_DESPACHO and "BC" for BOLETA_CERRADA to receivables.createTx
 * (REQ-GE-5 Scenarios 5.2 + 5.3; design D8).
 *
 * Expected FAIL (RED): dispatch.service.ts does NOT include sourceTypeCode
 * in the createTx payload at line 403 (createAndPost) — the captured args
 * field will be undefined.
 *
 * Test reuses in-memory fake pattern from
 * `modules/dispatch/__tests__/c1-application-shape.poc-dispatch-hex.test.ts`.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  DispatchService,
  type DispatchServiceDeps,
  type CreateDispatchInput,
} from "../dispatch.service";
import type { DispatchRepository } from "../../domain/ports/dispatch.repository";
import type { DispatchJournalEntryFactoryPort } from "../../domain/ports/dispatch-journal-entry-factory.port";
import type { DispatchAccountBalancesPort } from "../../domain/ports/dispatch-account-balances.port";
import type { DispatchOrgSettingsReaderPort } from "../../domain/ports/dispatch-org-settings-reader.port";
import type { DispatchContactsPort } from "../../domain/ports/dispatch-contacts.port";
import type { DispatchFiscalPeriodsPort } from "../../domain/ports/dispatch-fiscal-periods.port";
import type {
  DispatchReceivablesPort,
  CreateReceivableInput,
} from "../../domain/ports/dispatch-receivables.port";

const ORG = "org-1";

function makeRepo(): DispatchRepository {
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
    updateStatusTx: async (_o, _i, _s, _t, _sq) => null as never,
    cloneToDraftTx: async (_o, s) => s,
    findByClientId: async () => null,
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

function makePeriods(): DispatchFiscalPeriodsPort {
  return {
    getById: async () => ({
      id: "p-1",
      name: "2026-01",
      status: "OPEN",
      startDate: new Date("2000-01-01T00:00:00.000Z"),
      endDate: new Date("2099-12-31T23:59:59.999Z"),
    }),
    findByDate: async () => ({
      id: "p-1",
      name: "2026-01",
      status: "OPEN",
      startDate: new Date("2000-01-01T00:00:00.000Z"),
      endDate: new Date("2099-12-31T23:59:59.999Z"),
    }),
  };
}

interface CapturingReceivablesPort extends DispatchReceivablesPort {
  calls: CreateReceivableInput[];
}

function makeCapturingReceivables(): CapturingReceivablesPort {
  const calls: CreateReceivableInput[] = [];
  return {
    calls,
    createTx: async (input) => {
      calls.push(input);
      return "recv-1";
    },
    voidTx: async () => {},
  };
}

function makeDeps(receivables: DispatchReceivablesPort): DispatchServiceDeps {
  return {
    repo: makeRepo(),
    journalEntryFactory: makeFactory(),
    accountBalances: makeBalances(),
    orgSettings: makeOrgSettings(),
    contacts: makeContacts(),
    fiscalPeriods: makePeriods(),
    receivables,
  };
}

function buildInput(
  dispatchType: "NOTA_DESPACHO" | "BOLETA_CERRADA",
  overrides: Partial<CreateDispatchInput> = {},
): CreateDispatchInput {
  return {
    dispatchType,
    date: new Date("2026-05-19"),
    contactId: "c-1",
    periodId: "p-1",
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

describe("DispatchService.createAndPost — passes sourceTypeCode (T-09)", () => {
  let receivables: CapturingReceivablesPort;
  let service: DispatchService;

  beforeEach(() => {
    receivables = makeCapturingReceivables();
    service = new DispatchService(makeDeps(receivables));
  });

  it("NOTA_DESPACHO → createTx called with sourceTypeCode: 'ND'", async () => {
    await service.createAndPost(ORG, buildInput("NOTA_DESPACHO"), "user-1");
    expect(receivables.calls).toHaveLength(1);
    expect(
      (receivables.calls[0] as CreateReceivableInput & { sourceTypeCode?: string })
        .sourceTypeCode,
    ).toBe("ND");
  });

  it("BOLETA_CERRADA → createTx called with sourceTypeCode: 'BC'", async () => {
    await service.createAndPost(
      ORG,
      buildInput("BOLETA_CERRADA", { chickenCount: 100, shrinkagePct: 5 }),
      "user-1",
    );
    expect(receivables.calls).toHaveLength(1);
    expect(
      (receivables.calls[0] as CreateReceivableInput & { sourceTypeCode?: string })
        .sourceTypeCode,
    ).toBe("BC");
  });
});
