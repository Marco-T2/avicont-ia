/**
 * RED → GREEN: LegacyJournalEntryFactoryAdapter resolves operationalDocTypeId
 * via OperationalDocTypesRepository.findByCode (journal-physical-document
 * Phase 6 tasks 6.3, 6.4).
 *
 * Layer: unit test against an in-memory fake of the OperationalDocTypesRepository.
 * The full Postgres-real integration relies on the production adapter wiring
 * (dispatch composition root + AutoEntryGenerator + Prisma); this test pins
 * the FK-resolution path discretely so a regression in dispatchTypeToCode →
 * findByCode → template.operationalDocTypeId is caught without spinning the
 * whole transaction.
 *
 * R-D1 enforcement: the adapter MUST take docTypesRepo via constructor DI;
 * the test passing the repo as a single positional arg proves the contract.
 */

import { describe, expect, it, vi } from "vitest";

import type { OperationalDocTypesRepository } from "@/modules/operational-doc-type/domain/operational-doc-type.repository";
import { OperationalDocType } from "@/modules/operational-doc-type/domain/operational-doc-type.entity";

// Mock prisma BEFORE importing the adapter (the adapter calls
// `prisma.$transaction` in `generateForDispatch`; we intercept it so the
// generator callback receives a fake tx and never touches the network).
vi.mock("@/lib/prisma", () => {
  return {
    prisma: {
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({}),
      ),
    },
  };
});

// Mock the AutoEntryGenerator so its `generate()` becomes the assertion
// surface — we capture the template it receives and return a sentinel
// JournalEntryWithLines so the adapter's `entry.id` extraction works.
const generateMock = vi.fn(async (_tx: unknown, template: { operationalDocTypeId?: string | null }) => ({
  id: "je-1",
  capturedTemplate: template,
}));
vi.mock("@/modules/accounting/application/auto-entry-generator", () => ({
  AutoEntryGenerator: class {
    generate = generateMock;
  },
}));
// PrismaAccountsRepo + makeVoucherTypeRepository: stub-out since the
// real AutoEntryGenerator is mocked above.
vi.mock("@/modules/accounting/infrastructure/prisma-accounts.repo", () => ({
  PrismaAccountsRepo: class {},
}));
vi.mock("@/modules/voucher-types/presentation/server", () => ({
  makeVoucherTypeRepository: () => ({}),
}));

import { LegacyJournalEntryFactoryAdapter } from "../infrastructure/legacy-journal-entry-factory.adapter";

function makeDocTypesRepoFake(
  registry: Record<string, string | null>,
): OperationalDocTypesRepository {
  return {
    findAll: vi.fn(async () => []),
    findById: vi.fn(async () => null),
    findByCode: vi.fn(async (orgId, code) => {
      const id = registry[code];
      if (id === undefined || id === null) return null;
      return OperationalDocType.fromPersistence({
        id,
        organizationId: orgId,
        code,
        name: `Mock ${code}`,
        direction: code === "ND" ? "DESPACHO" : "DESPACHO",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }),
    save: vi.fn(async () => undefined),
    countActivePayments: vi.fn(async () => 0),
  };
}

const baseTemplate = {
  organizationId: "org-1",
  contactId: "contact-1",
  date: new Date("2099-01-15"),
  periodId: "period-1",
  description: "Dispatch JE",
  sourceType: "dispatch" as const,
  sourceId: "dispatch-1",
  createdById: "user-1",
  lines: [
    { accountCode: "1.1.4.1", side: "DEBIT" as const, amount: 100 },
    { accountCode: "4.1.2", side: "CREDIT" as const, amount: 100 },
  ],
};

describe("LegacyJournalEntryFactoryAdapter — operationalDocTypeId resolution (Phase 6)", () => {
  it("6.4-S1 — NOTA_DESPACHO → findByCode(orgId, 'ND') → operationalDocTypeId='odt-nd-1'", async () => {
    const docTypesRepo = makeDocTypesRepoFake({ ND: "odt-nd-1", BC: "odt-bc-1" });
    const adapter = new LegacyJournalEntryFactoryAdapter(docTypesRepo);

    generateMock.mockClear();
    await adapter.generateForDispatch({
      ...baseTemplate,
      dispatchType: "NOTA_DESPACHO",
    });

    expect(docTypesRepo.findByCode).toHaveBeenCalledWith("org-1", "ND");
    expect(generateMock).toHaveBeenCalledTimes(1);
    const tpl = generateMock.mock.calls[0][1];
    expect(tpl.operationalDocTypeId).toBe("odt-nd-1");
  });

  it("6.4-S2 — BOLETA_CERRADA → findByCode(orgId, 'BC') → operationalDocTypeId='odt-bc-1'", async () => {
    const docTypesRepo = makeDocTypesRepoFake({ ND: "odt-nd-1", BC: "odt-bc-1" });
    const adapter = new LegacyJournalEntryFactoryAdapter(docTypesRepo);

    generateMock.mockClear();
    await adapter.generateForDispatch({
      ...baseTemplate,
      dispatchType: "BOLETA_CERRADA",
    });

    expect(docTypesRepo.findByCode).toHaveBeenCalledWith("org-1", "BC");
    const tpl = generateMock.mock.calls[0][1];
    expect(tpl.operationalDocTypeId).toBe("odt-bc-1");
  });

  it("6.4-S3 — findByCode returns null → operationalDocTypeId=null (graceful degradation per spec I-5)", async () => {
    const docTypesRepo = makeDocTypesRepoFake({}); // empty registry — code absent
    const adapter = new LegacyJournalEntryFactoryAdapter(docTypesRepo);

    generateMock.mockClear();
    await adapter.generateForDispatch({
      ...baseTemplate,
      dispatchType: "NOTA_DESPACHO",
    });

    expect(docTypesRepo.findByCode).toHaveBeenCalledWith("org-1", "ND");
    const tpl = generateMock.mock.calls[0][1];
    expect(tpl.operationalDocTypeId).toBeNull();
  });

  it("forwards template.referenceNumber (789) to the AutoEntryGenerator (Marco bug — dispatch-generated JE was getting referenceNumber=NULL)", async () => {
    const docTypesRepo = makeDocTypesRepoFake({ ND: "odt-nd-1", BC: "odt-bc-1" });
    const adapter = new LegacyJournalEntryFactoryAdapter(docTypesRepo);

    generateMock.mockClear();
    await adapter.generateForDispatch({
      ...baseTemplate,
      dispatchType: "NOTA_DESPACHO",
      referenceNumber: 789,
    });

    const tpl = generateMock.mock.calls[0][1] as { referenceNumber?: number | null };
    expect(tpl.referenceNumber).toBe(789);
  });
});
