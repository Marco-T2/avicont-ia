/**
 * RED → GREEN: JournalRepository.createWithRetryTx persists operationalDocTypeId
 * + journalIncludeLines eager-hydrates operationalDocType (journal-physical-document
 * Phase 5 tasks 5.1, 5.2).
 *
 * Layer: unit test against a Prisma-shape mock. The full Postgres-real
 * integration test lives in `prisma-journal-entries.repo.integration.test.ts`
 * but requires DATABASE_URL connectivity + applied migrations; this test
 * confirms the wiring without the DB roundtrip.
 *
 * What this checks:
 * - createWithRetryTx forwards `data.operationalDocTypeId` into the Prisma
 *   create.data payload (so the FK column gets written, not silently dropped).
 * - The hydrate `include` clause requests `operationalDocType: true` so the
 *   returned row carries `operationalDocType: { code, ... } | null`.
 * - Defaults: omitted field → `null` (sister of contactId/referenceNumber).
 */

import { describe, it, expect, vi } from "vitest";
import { JournalRepository } from "../prisma-journal-entries.repo";

function makeTxMock() {
  const findFirst = vi.fn(async () => ({ number: 0 }));
  const create = vi.fn(async (args: { data: Record<string, unknown>; include: unknown }) => ({
    id: "je-1",
    number: 1,
    status: "POSTED",
    organizationId: args.data.organizationId,
    voucherTypeId: args.data.voucherTypeId,
    periodId: args.data.periodId,
    contactId: null,
    sourceType: null,
    sourceId: null,
    aiOriginalText: null,
    referenceNumber: null,
    operationalDocTypeId: args.data.operationalDocTypeId ?? null,
    date: args.data.date,
    description: args.data.description,
    createdById: args.data.createdById,
    updatedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lines: [],
    voucherType: { id: args.data.voucherTypeId, code: "TEST", prefix: "T" },
    operationalDocType: args.data.operationalDocTypeId
      ? { id: args.data.operationalDocTypeId, code: "VG", name: "Venta de Gestión" }
      : null,
  }));
  return {
    findFirst,
    create,
    tx: {
      journalEntry: { findFirst, create },
    } as never,
  };
}

const baseData = {
  date: new Date("2026-04-15"),
  description: "test entry",
  periodId: "period-1",
  voucherTypeId: "voucher-1",
  createdById: "user-1",
};

const baseLines = [
  { accountId: "acc-1", debit: 100, credit: 0, order: 0 },
  { accountId: "acc-2", debit: 0, credit: 100, order: 1 },
];

describe("JournalRepository.createWithRetryTx — operationalDocTypeId (Phase 5)", () => {
  it("forwards operationalDocTypeId into the Prisma create payload", async () => {
    const mock = makeTxMock();
    const repo = new JournalRepository();

    await repo.createWithRetryTx(
      mock.tx,
      "org-1",
      { ...baseData, operationalDocTypeId: "odt-vg-1" },
      baseLines,
      "POSTED",
    );

    expect(mock.create).toHaveBeenCalledTimes(1);
    const callArgs = mock.create.mock.calls[0][0] as unknown as {
      data: { operationalDocTypeId: string | null };
    };
    expect(callArgs.data.operationalDocTypeId).toBe("odt-vg-1");
  });

  it("defaults operationalDocTypeId to null when the caller omits it", async () => {
    const mock = makeTxMock();
    const repo = new JournalRepository();

    await repo.createWithRetryTx(mock.tx, "org-1", baseData, baseLines, "POSTED");

    const callArgs = mock.create.mock.calls[0][0] as unknown as {
      data: { operationalDocTypeId: string | null };
    };
    expect(callArgs.data.operationalDocTypeId).toBeNull();
  });

  it("requests operationalDocType in the include clause for eager hydration", async () => {
    const mock = makeTxMock();
    const repo = new JournalRepository();

    await repo.createWithRetryTx(
      mock.tx,
      "org-1",
      { ...baseData, operationalDocTypeId: "odt-vg-1" },
      baseLines,
      "POSTED",
    );

    const callArgs = mock.create.mock.calls[0][0] as unknown as {
      include: { operationalDocType?: boolean };
    };
    expect(callArgs.include.operationalDocType).toBe(true);
  });

  it("returns the row with operationalDocType populated (hydration carries through)", async () => {
    const mock = makeTxMock();
    const repo = new JournalRepository();

    const row = await repo.createWithRetryTx(
      mock.tx,
      "org-1",
      { ...baseData, operationalDocTypeId: "odt-vg-1" },
      baseLines,
      "POSTED",
    );

    expect(row.operationalDocType?.code).toBe("VG");
    expect(row.operationalDocTypeId).toBe("odt-vg-1");
  });
});
