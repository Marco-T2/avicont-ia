/**
 * T5.1, T5.2, T5.3 RED (REQ-C.1, S-C1.1..S-C1.4)
 *
 * JournalRepository.findAll() honors the origin filter:
 *   "manual" → where.sourceType IS NULL
 *   "auto"   → where.sourceType IS NOT NULL
 *   undefined / "all" → no filter (both entries returned)
 *
 * Uses a mocked Prisma client — no real DB access.
 * RED: fails until JournalFilters.origin and the repo query branch are added (T5.5 + T5.6).
 */

import { describe, it, expect, vi } from "vitest";
import { JournalRepository } from "@/modules/accounting/infrastructure/prisma-journal-entries.repo";
import type { JournalEntryWithLines } from "@/features/accounting/journal.types";

// ── Helpers ──

const ORG_ID = "org-filter-origin";

function makeJE(overrides: Record<string, unknown> = {}): JournalEntryWithLines {
  return {
    id: "je-1",
    organizationId: ORG_ID,
    number: 1,
    date: new Date("2026-04-17"),
    description: "Test",
    status: "POSTED",
    sourceType: null,
    sourceId: null,
    periodId: "period-1",
    voucherTypeId: "vt-1",
    referenceNumber: null,
    contactId: null,
    createdById: "user-1",
    updatedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lines: [],
    contact: null,
    voucherType: {
      id: "vt-1",
      organizationId: ORG_ID,
      code: "CE",
      name: "Egreso",
      description: null,
      isActive: true,
    },
    ...overrides,
  } as unknown as JournalEntryWithLines;
}

const MANUAL_JE = makeJE({ id: "je-manual", sourceType: null });
const AUTO_JE = makeJE({ id: "je-auto", sourceType: "sale" });

// ── Mock builder ──

function buildRepo(results: JournalEntryWithLines[]) {
  const mockFindMany = vi.fn().mockResolvedValue(results);
  const mockDb = {
    journalEntry: { findMany: mockFindMany },
  };

  // JournalRepository extends BaseRepository which calls this.requireOrg() — we need to
  // provide a minimal shim that satisfies the interface without actual DB.
  const repo = new JournalRepository(mockDb as any);
  return { repo, mockFindMany };
}

// ── T5.1: origin="manual" → sourceType: null ──

describe("JournalRepository.findAll — origin='manual' (S-C1.1)", () => {
  it("T5.1 — passes where.sourceType: null to Prisma when origin='manual'", async () => {
    const { repo, mockFindMany } = buildRepo([MANUAL_JE]);

    await repo.findAll(ORG_ID, { origin: "manual" });

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where).toMatchObject({ sourceType: null });
  });

  it("T5.1b — result contains only the manual entry", async () => {
    const { repo } = buildRepo([MANUAL_JE]);

    const result = await repo.findAll(ORG_ID, { origin: "manual" });

    expect(result).toHaveLength(1);
    expect(result[0].sourceType).toBeNull();
  });
});

// ── T5.2: origin="auto" → sourceType: { not: null } ──

describe("JournalRepository.findAll — origin='auto' (S-C1.2)", () => {
  it("T5.2 — passes where.sourceType: { not: null } to Prisma when origin='auto'", async () => {
    const { repo, mockFindMany } = buildRepo([AUTO_JE]);

    await repo.findAll(ORG_ID, { origin: "auto" });

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where).toMatchObject({ sourceType: { not: null } });
  });

  it("T5.2b — result contains only the auto entry", async () => {
    const { repo } = buildRepo([AUTO_JE]);

    const result = await repo.findAll(ORG_ID, { origin: "auto" });

    expect(result).toHaveLength(1);
    expect(result[0].sourceType).not.toBeNull();
  });
});

// ── T5.3: no origin → no sourceType filter ──

describe("JournalRepository.findAll — no origin filter (S-C1.3 + S-C1.4)", () => {
  it("T5.3a — origin undefined → where does NOT contain sourceType key", async () => {
    const { repo, mockFindMany } = buildRepo([MANUAL_JE, AUTO_JE]);

    await repo.findAll(ORG_ID, {});

    const callArgs = mockFindMany.mock.calls[0][0];
    // sourceType must not appear at all (no filter)
    expect(callArgs.where).not.toHaveProperty("sourceType");
  });

  it("T5.3b — origin undefined → both entries returned (mock returns both)", async () => {
    const { repo } = buildRepo([MANUAL_JE, AUTO_JE]);

    const result = await repo.findAll(ORG_ID, {});

    expect(result).toHaveLength(2);
  });

  it("T5.3c — origin='manual' composable with periodId → where contains both filters", async () => {
    const { repo, mockFindMany } = buildRepo([MANUAL_JE]);

    await repo.findAll(ORG_ID, { origin: "manual", periodId: "period-1" });

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where).toMatchObject({ sourceType: null, periodId: "period-1" });
  });
});
