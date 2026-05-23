import { describe, expect, it } from "vitest";
import type { PayableRepository } from "@/modules/payables/presentation/server";
import type { PendingDocumentSnapshot } from "../../domain/ports/types";
import { PayablesQueryAdapter } from "../payables.adapter";

/**
 * Constructor-DI test for PayablesQueryAdapter.findPendingByContact — verifies
 * the adapter PASSES THROUGH the glosa fields (sourceTypeCode, referenceNumber,
 * sourceDate) from the payables repo snapshot rather than hardcoding null /
 * createdAt. Espejo simétrico de receivables.adapter:44-47 (design D7).
 *
 * No vi.mock: the adapter accepts a `repo` via constructor DI, so we inject a
 * minimal fake repo directly. Keeps the test at the mapping layer with zero
 * module-graph mocking (α18 vi.mock count untouched).
 */

const SOURCE_DATE = new Date("2025-05-15T00:00:00.000Z");
const CREATED_AT = new Date("2025-05-10T00:00:00.000Z");
const DUE_DATE = new Date("2025-06-15T00:00:00.000Z");

function fakeRepoReturning(
  snapshots: PendingDocumentSnapshot[],
): PayableRepository {
  return {
    findPendingByContact: async () => snapshots,
  } as unknown as PayableRepository;
}

function snapshot(
  overrides: Partial<PendingDocumentSnapshot> = {},
): PendingDocumentSnapshot {
  return {
    id: "ap-1",
    description: "Compra X",
    amount: 500,
    paid: 0,
    balance: 500,
    dueDate: DUE_DATE,
    sourceType: "purchase",
    sourceId: "pur-1",
    sourceTypeCode: "CG",
    createdAt: CREATED_AT,
    referenceNumber: 1023,
    sourceDate: SOURCE_DATE,
    ...overrides,
  };
}

describe("PayablesQueryAdapter.findPendingByContact — glosa pass-through (D7)", () => {
  it("passes through sourceTypeCode, referenceNumber and sourceDate from the repo snapshot", async () => {
    const repo = fakeRepoReturning([snapshot()]);
    const adapter = new PayablesQueryAdapter(repo);

    const [doc] = await adapter.findPendingByContact("org-1", "c-1");

    expect(doc.sourceTypeCode).toBe("CG");
    expect(doc.referenceNumber).toBe(1023);
    expect(doc.sourceDate).toEqual(SOURCE_DATE);
  });

  it("preserves null sourceTypeCode / null referenceNumber for orphan rows (no coercion)", async () => {
    const orphanSourceDate = new Date("2024-01-01T00:00:00.000Z");
    const repo = fakeRepoReturning([
      snapshot({
        sourceTypeCode: null,
        referenceNumber: null,
        sourceDate: orphanSourceDate,
      }),
    ]);
    const adapter = new PayablesQueryAdapter(repo);

    const [doc] = await adapter.findPendingByContact("org-1", "c-1");

    expect(doc.sourceTypeCode).toBeNull();
    expect(doc.referenceNumber).toBeNull();
    expect(doc.sourceDate).toEqual(orphanSourceDate);
  });
});
