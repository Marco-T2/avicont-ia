/**
 * T45 RED — LOCKED-edit enforcement in JournalService.
 *
 * Covers BOTH callsites:
 *   - updateEntry() on a LOCKED entry (line ~332)
 *   - transitionStatus(LOCKED → VOIDED) (line ~569)
 *
 * Spec: REQ-A6 — justification length differentiated by period status.
 *
 * Current behavior (before T46): both callsites pass `undefined` as
 * periodStatus and hit the PERIOD_NOT_FOUND fail-safe regardless of the
 * actual period.
 *
 * All external dependencies mocked — no DB access.
 */
import { describe, it, expect, vi } from "vitest";
import { JournalService } from "@/features/accounting/journal.service";
import { LOCKED_EDIT_REQUIRES_JUSTIFICATION } from "@/features/shared/errors";
import type { JournalRepository } from "@/features/accounting/journal.repository";
import type { FiscalPeriodsService } from "@/features/fiscal-periods/server";
import type { JournalEntryWithLines } from "@/features/accounting/journal.types";

const ORG_ID = "org-locked-edit-journal";
const ENTRY_ID = "je-locked-001";
const PERIOD_ID = "period-locked-001";
const USER_ID = "user-admin";

function makeLockedEntry(): JournalEntryWithLines {
  return {
    id: ENTRY_ID,
    organizationId: ORG_ID,
    status: "LOCKED",
    sourceType: null, // manual entry — editable (vs auto-generated)
    sourceId: null,
    number: 1,
    date: new Date("2025-01-15"),
    description: "Asiento bloqueado",
    periodId: PERIOD_ID,
    voucherTypeId: "vt-001",
    referenceNumber: null,
    createdById: USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    lines: [],
    voucherType: {
      id: "vt-001",
      organizationId: ORG_ID,
      name: "VG",
      prefix: "VG",
      sequenceNumber: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  } as unknown as JournalEntryWithLines;
}

function buildService(periodStatus: "OPEN" | "CLOSED") {
  const entry = makeLockedEntry();

  const mockRepo = {
    findById: vi.fn().mockResolvedValue(entry),
    transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const mockTx = {
        $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
        journalEntry: {
          update: vi.fn().mockResolvedValue(entry),
        },
      };
      return fn(mockTx);
    }),
    updateStatusTx: vi.fn().mockResolvedValue(entry),
  } as unknown as JournalRepository;

  const mockPeriodsService = {
    getById: vi.fn().mockResolvedValue({
      id: PERIOD_ID,
      status: periodStatus,
    }),
    list: vi.fn(),
  } as unknown as FiscalPeriodsService;

  const service = new JournalService(
    mockRepo,
    undefined,
    undefined,
    mockPeriodsService,
  );

  return { service, mockRepo, mockPeriodsService };
}

describe("JournalService — LOCKED-edit enforcement (T45 RED)", () => {
  it("updateEntry LOCKED journal entry in CLOSED period, justification < 50 → LOCKED_EDIT_REQUIRES_JUSTIFICATION with requiredMin=50", async () => {
    const { service } = buildService("CLOSED");

    await expect(
      service.updateEntry(
        ORG_ID,
        ENTRY_ID,
        { description: "edited", updatedById: "user-1" },
        "admin",
        "too short justification",
      ),
    ).rejects.toMatchObject({
      code: LOCKED_EDIT_REQUIRES_JUSTIFICATION,
      details: { requiredMin: 50 },
    });
  });

  it("updateEntry LOCKED journal entry in OPEN period, justification < 10 → LOCKED_EDIT_REQUIRES_JUSTIFICATION with requiredMin=10", async () => {
    const { service } = buildService("OPEN");

    await expect(
      service.updateEntry(
        ORG_ID,
        ENTRY_ID,
        { description: "edited", updatedById: "user-1" },
        "admin",
        "short",
      ),
    ).rejects.toMatchObject({
      code: LOCKED_EDIT_REQUIRES_JUSTIFICATION,
      details: { requiredMin: 10 },
    });
  });

  it("transitionStatus LOCKED→VOIDED in CLOSED period, justification < 50 → LOCKED_EDIT_REQUIRES_JUSTIFICATION with requiredMin=50", async () => {
    const { service } = buildService("CLOSED");

    await expect(
      service.transitionStatus(
        ORG_ID,
        ENTRY_ID,
        "VOIDED",
        USER_ID,
        "admin",
        "too short justification",
      ),
    ).rejects.toMatchObject({
      code: LOCKED_EDIT_REQUIRES_JUSTIFICATION,
      details: { requiredMin: 50 },
    });
  });
});
