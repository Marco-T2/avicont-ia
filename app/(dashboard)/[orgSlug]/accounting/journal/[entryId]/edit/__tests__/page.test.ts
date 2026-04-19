/**
 * T3.1–T3.4 RED — edit page guard unlock tests (REQ-A.1)
 *
 * Tests the guard logic in EditJournalEntryPage:
 * - DRAFT manual → no redirect (renders form)
 * - POSTED manual (sourceType=null) → no redirect (renders form) [T3.1]
 * - POSTED auto (sourceType="sale") → redirect to detail [T3.2]
 * - VOIDED → redirect to detail [T3.4]
 *
 * Tests run in Node project (async function, no DOM rendering needed).
 * Guard assertions via redirect() call tracking.
 *
 * RED: fails until T3.5 relaxes the guard condition.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks declared BEFORE vi.mock (hoisted automatically)
const { mockRedirect, mockNotFound } = vi.hoisted(() => ({
  mockRedirect: vi.fn(),
  mockNotFound: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
  notFound: mockNotFound,
}));

const { mockGetById } = vi.hoisted(() => ({
  mockGetById: vi.fn(),
}));

vi.mock("@/features/shared/permissions.server", () => ({
  requirePermission: vi
    .fn()
    .mockResolvedValue({ orgId: "org-db-id", session: { userId: "clerk-user-1" }, role: "owner" }),
}));

vi.mock("@/features/accounting", () => ({
  JournalService: vi.fn().mockImplementation(function () {
    return { getById: mockGetById };
  }),
  AccountsService: vi.fn().mockImplementation(function () {
    return { list: vi.fn().mockResolvedValue([]) };
  }),
}));

const { mockPeriodsList } = vi.hoisted(() => ({
  mockPeriodsList: vi.fn(),
}));

vi.mock("@/features/fiscal-periods/server", () => ({
  FiscalPeriodsService: vi.fn().mockImplementation(function () {
    return { list: mockPeriodsList };
  }),
}));

vi.mock("@/features/voucher-types/server", () => ({
  VoucherTypesService: vi.fn().mockImplementation(function () {
    return { list: vi.fn().mockResolvedValue([]) };
  }),
}));

// Mock JournalEntryForm — we just care about guard, not rendering
vi.mock("@/components/accounting/journal-entry-form", () => ({
  default: vi.fn().mockReturnValue(null),
}));

import EditJournalEntryPage from "../page";

// ── Fixture ────────────────────────────────────────────────────────────────────

function makeEntry(
  status: string,
  sourceType: string | null,
  id = "je-test-001",
  periodId = "period-001",
) {
  return {
    id,
    organizationId: "org-db-id",
    status,
    sourceType,
    number: 1,
    date: new Date("2026-01-15"),
    description: "Test entry",
    periodId,
    voucherTypeId: "vt-001",
    referenceNumber: null,
    createdById: "user-001",
    createdAt: new Date(),
    updatedAt: new Date(),
    lines: [],
    voucherType: { id: "vt-001", name: "VG", prefix: "VG" },
  };
}

function makePeriod(id: string, status: "OPEN" | "CLOSED") {
  return {
    id,
    organizationId: "org-db-id",
    name: `Período ${id}`,
    status,
    year: 2026,
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-12-31"),
  };
}

const ORG_SLUG = "test-org";
const ENTRY_ID = "je-test-001";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG, entryId: ENTRY_ID });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: return an OPEN period for period-001
  mockPeriodsList.mockResolvedValue([makePeriod("period-001", "OPEN")]);
});

// ── T3.3 — DRAFT manual → renders (regression check, should pass before T3.5) ──

describe("EditJournalEntryPage — DRAFT guard (regression)", () => {
  it("T3.3 — DRAFT manual (sourceType=null) → redirect NOT called", async () => {
    mockGetById.mockResolvedValue(makeEntry("DRAFT", null));

    await EditJournalEntryPage({ params: makeParams() });

    expect(mockRedirect).not.toHaveBeenCalled();
  });
});

// ── T3.1 — POSTED manual → edit page renders ────────────────────────────────

describe("EditJournalEntryPage — POSTED manual (REQ-A.1)", () => {
  it("T3.1 — POSTED + sourceType=null → redirect NOT called (form renders)", async () => {
    mockGetById.mockResolvedValue(makeEntry("POSTED", null));

    await EditJournalEntryPage({ params: makeParams() });

    expect(mockRedirect).not.toHaveBeenCalled();
  });
});

// ── T3.2 — POSTED auto → redirect ───────────────────────────────────────────

describe("EditJournalEntryPage — POSTED auto (REQ-A.1)", () => {
  it("T3.2 — POSTED + sourceType='sale' → redirect to detail", async () => {
    mockGetById.mockResolvedValue(makeEntry("POSTED", "sale"));

    await EditJournalEntryPage({ params: makeParams() });

    expect(mockRedirect).toHaveBeenCalledWith(
      `/${ORG_SLUG}/accounting/journal/${ENTRY_ID}`,
    );
  });

  it("T3.2b — POSTED + sourceType='purchase' → redirect to detail", async () => {
    mockGetById.mockResolvedValue(makeEntry("POSTED", "purchase"));

    await EditJournalEntryPage({ params: makeParams() });

    expect(mockRedirect).toHaveBeenCalledWith(
      `/${ORG_SLUG}/accounting/journal/${ENTRY_ID}`,
    );
  });
});

// ── T3.4 — VOIDED → redirect ─────────────────────────────────────────────────

describe("EditJournalEntryPage — VOIDED (REQ-A.1)", () => {
  it("T3.4 — VOIDED + sourceType=null → redirect to detail (VOIDED not editable)", async () => {
    mockGetById.mockResolvedValue(makeEntry("VOIDED", null));

    await EditJournalEntryPage({ params: makeParams() });

    expect(mockRedirect).toHaveBeenCalledWith(
      `/${ORG_SLUG}/accounting/journal/${ENTRY_ID}`,
    );
  });

  it("T3.4b — VOIDED + sourceType='sale' → redirect to detail", async () => {
    mockGetById.mockResolvedValue(makeEntry("VOIDED", "sale"));

    await EditJournalEntryPage({ params: makeParams() });

    expect(mockRedirect).toHaveBeenCalledWith(
      `/${ORG_SLUG}/accounting/journal/${ENTRY_ID}`,
    );
  });
});

// ── T7.8 — DRAFT manual + period CLOSED → notFound (period-gate) ─────────────
// RED: current guard does not check period.status, so these will pass through.

describe("EditJournalEntryPage — period CLOSED gate (REQ-A.1 amended, PR7)", () => {
  it("T7.8 — DRAFT manual + period CLOSED → notFound or redirect (immutable)", async () => {
    mockGetById.mockResolvedValue(makeEntry("DRAFT", null, ENTRY_ID, "period-closed"));
    mockPeriodsList.mockResolvedValue([makePeriod("period-closed", "CLOSED")]);

    await EditJournalEntryPage({ params: makeParams() });

    // Either notFound() or redirect() must have been called — period is closed
    const blocked = mockNotFound.mock.calls.length > 0 || mockRedirect.mock.calls.length > 0;
    expect(blocked).toBe(true);
  });

  it("T7.9 — POSTED manual + period CLOSED → notFound or redirect (immutable)", async () => {
    mockGetById.mockResolvedValue(makeEntry("POSTED", null, ENTRY_ID, "period-closed"));
    mockPeriodsList.mockResolvedValue([makePeriod("period-closed", "CLOSED")]);

    await EditJournalEntryPage({ params: makeParams() });

    const blocked = mockNotFound.mock.calls.length > 0 || mockRedirect.mock.calls.length > 0;
    expect(blocked).toBe(true);
  });
});
