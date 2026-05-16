/**
 * Phase 5.4 RED — POST /api/organizations/[orgSlug]/annual-close route handler.
 *
 * Per design rev 2 §7 (HTTP map) + spec REQ-2.3 (canonical error contract) +
 * REQ-2.6 (RBAC `period:close`) + REQ-7.4 (voseo for any user-facing strings).
 *
 * Covers:
 *   (a) 200 OK with AnnualCloseResult shape on happy path
 *   (b) 403 ForbiddenError when requirePermission rejects
 *   (c) 409 PERIOD_ALREADY_CLOSED (ConflictError tree)
 *   (d) 409 FISCAL_YEAR_ALREADY_CLOSED
 *   (e) 409 YEAR_PERIODS_ALREADY_EXIST
 *   (f) 422 BALANCE_NOT_ZERO with debit/credit/diff details
 *   (g) 422 DRAFT_ENTRIES_IN_DECEMBER with counts
 *   (h) 422 JUSTIFICATION_TOO_SHORT
 *   (i) 422 FISCAL_YEAR_GATE_NOT_MET with payload
 *   (j) 422 INVALID_YEAR
 *   (k) 404 FISCAL_YEAR_NOT_FOUND
 *   (l) **500 MISSING_RESULT_ACCOUNT** — W-7 carve-out. System misconfig,
 *       NOT user input. MUST map to 500, never 422.
 *   (m) 400 Zod validation failure (missing justification)
 *   (n) 500 generic Error (unhandled)
 *
 * Declared failure mode (pre-GREEN per [[red_acceptance_failure_mode]]):
 *   - route.ts does not exist yet → `import { POST } from "../route"` rejects.
 *   - all 14 tests FAIL at import time.
 *
 * GREEN flips at Phase 5.4b once route.ts ships.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ForbiddenError } from "@/modules/shared/domain/errors";
import {
  FiscalYearAlreadyClosedError,
  FiscalYearGateNotMetError,
  FiscalYearNotFoundError,
  BalanceNotZeroError,
  DraftEntriesInDecemberError,
  PeriodAlreadyClosedError,
  YearOpeningPeriodsExistError,
  MissingResultAccountError,
  JustificationTooShortError,
  InvalidYearError,
  FISCAL_YEAR_ALREADY_CLOSED,
  FISCAL_YEAR_GATE_NOT_MET,
  FISCAL_YEAR_NOT_FOUND,
  BALANCE_NOT_ZERO,
  DRAFT_ENTRIES_IN_DECEMBER,
  PERIOD_ALREADY_CLOSED,
  YEAR_PERIODS_ALREADY_EXIST,
  MISSING_RESULT_ACCOUNT,
  JUSTIFICATION_TOO_SHORT,
  INVALID_YEAR,
} from "@/modules/annual-close/domain/errors/annual-close-errors";
import Decimal from "decimal.js";

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const { mockRequirePermission, mockClose, mockResolveByClerkId } = vi.hoisted(
  () => ({
    mockRequirePermission: vi.fn(),
    mockClose: vi.fn(),
    mockResolveByClerkId: vi.fn(),
  }),
);

// ── Module mocks ───────────────────────────────────────────────────────────

vi.mock("@/features/permissions/server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/modules/annual-close/presentation/server", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/modules/annual-close/presentation/server")
  >()),
  makeAnnualCloseService: vi
    .fn()
    .mockImplementation(() => ({ close: mockClose })),
}));

vi.mock("@/features/users/server", () => ({
  UsersService: vi.fn().mockImplementation(function () {
    return { resolveByClerkId: mockResolveByClerkId };
  }),
}));

// ── Import after mocks ─────────────────────────────────────────────────────

import { POST } from "../route";

// ── Fixtures ───────────────────────────────────────────────────────────────

const ORG_SLUG = "test-org";

const validResult = {
  fiscalYearId: "fy-1",
  year: 2025,
  status: "CLOSED" as const,
  closedAt: new Date("2026-01-15T12:00:00Z"),
  correlationId: "corr-abc",
  closingEntryId: "je-cc-1",
  openingEntryId: "je-ca-1",
  yearPlus1: { periodIds: Array.from({ length: 12 }, (_, i) => `p-${i + 1}`) },
  decClose: {
    locked: {
      dispatches: 5,
      payments: 3,
      journalEntries: 12,
      sales: 8,
      purchases: 2,
    },
  },
};

const validJustification =
  "Cierre de la gestión anual 2025 — aprobado por dirección financiera tras revisión.";

function makeParams(slug = ORG_SLUG) {
  return Promise.resolve({ orgSlug: slug });
}

function makeRequest(
  body: unknown = { year: 2025, justification: validJustification },
) {
  return new Request(
    "http://localhost/api/organizations/test-org/annual-close",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePermission.mockResolvedValue({
    session: { userId: "clerk-u1" },
    orgId: "org-1",
  });
  mockResolveByClerkId.mockResolvedValue({ id: "db-user-1" });
  mockClose.mockResolvedValue(validResult);
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/.../annual-close — success", () => {
  it("(a) returns 200 with AnnualCloseResult on happy path", async () => {
    const res = await POST(makeRequest(), { params: makeParams() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      fiscalYearId: "fy-1",
      year: 2025,
      status: "CLOSED",
      correlationId: "corr-abc",
    });
    expect(mockClose).toHaveBeenCalledWith(
      "org-1",
      2025,
      "db-user-1",
      validJustification,
    );
  });
});

describe("POST /api/.../annual-close — RBAC", () => {
  it("(b) returns 403 when requirePermission throws ForbiddenError", async () => {
    mockRequirePermission.mockRejectedValueOnce(
      new ForbiddenError("Sin permiso para cerrar la gestión"),
    );
    const res = await POST(makeRequest(), { params: makeParams() });
    expect(res.status).toBe(403);
  });
});

describe("POST /api/.../annual-close — error → HTTP mapping (REQ-2.3)", () => {
  it("(c) returns 409 PERIOD_ALREADY_CLOSED", async () => {
    mockClose.mockRejectedValueOnce(
      new PeriodAlreadyClosedError({ periodId: "p-dec", status: "CLOSED" }),
    );
    const res = await POST(makeRequest(), { params: makeParams() });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe(PERIOD_ALREADY_CLOSED);
  });

  it("(d) returns 409 FISCAL_YEAR_ALREADY_CLOSED", async () => {
    mockClose.mockRejectedValueOnce(
      new FiscalYearAlreadyClosedError({ fiscalYearId: "fy-1" }),
    );
    const res = await POST(makeRequest(), { params: makeParams() });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe(FISCAL_YEAR_ALREADY_CLOSED);
  });

  it("(e) returns 409 YEAR_PERIODS_ALREADY_EXIST", async () => {
    mockClose.mockRejectedValueOnce(
      new YearOpeningPeriodsExistError({ year: 2026, existingCount: 3 }),
    );
    const res = await POST(makeRequest(), { params: makeParams() });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe(YEAR_PERIODS_ALREADY_EXIST);
  });

  it("(f) returns 422 BALANCE_NOT_ZERO with debit/credit/diff details", async () => {
    mockClose.mockRejectedValueOnce(
      new BalanceNotZeroError(new Decimal("100.00"), new Decimal("99.00")),
    );
    const res = await POST(makeRequest(), { params: makeParams() });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe(BALANCE_NOT_ZERO);
    expect(body.details).toMatchObject({
      debit: "100",
      credit: "99",
      diff: "1",
    });
  });

  it("(g) returns 422 DRAFT_ENTRIES_IN_DECEMBER with counts", async () => {
    mockClose.mockRejectedValueOnce(
      new DraftEntriesInDecemberError({
        dispatches: 2,
        payments: 1,
        journalEntries: 0,
        sales: 0,
        purchases: 0,
      }),
    );
    const res = await POST(makeRequest(), { params: makeParams() });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe(DRAFT_ENTRIES_IN_DECEMBER);
    expect(body.details).toMatchObject({ dispatches: 2, payments: 1 });
  });

  it("(h) returns 422 JUSTIFICATION_TOO_SHORT", async () => {
    mockClose.mockRejectedValueOnce(
      new JustificationTooShortError({ minLength: 50, actualLength: 10 }),
    );
    const res = await POST(makeRequest(), { params: makeParams() });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe(JUSTIFICATION_TOO_SHORT);
  });

  it("(i) returns 422 FISCAL_YEAR_GATE_NOT_MET with payload", async () => {
    mockClose.mockRejectedValueOnce(
      new FiscalYearGateNotMetError({
        monthsClosed: 10,
        decStatus: "OPEN",
        ccExists: false,
        periodsCount: 12,
        reason: "Faltan meses por cerrar",
      }),
    );
    const res = await POST(makeRequest(), { params: makeParams() });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe(FISCAL_YEAR_GATE_NOT_MET);
    expect(body.details).toMatchObject({
      monthsClosed: 10,
      decStatus: "OPEN",
      ccExists: false,
      periodsCount: 12,
    });
  });

  it("(j) returns 422 INVALID_YEAR", async () => {
    mockClose.mockRejectedValueOnce(new InvalidYearError(1800));
    const res = await POST(makeRequest(), { params: makeParams() });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe(INVALID_YEAR);
  });

  it("(k) returns 404 FISCAL_YEAR_NOT_FOUND", async () => {
    mockClose.mockRejectedValueOnce(
      new FiscalYearNotFoundError({ organizationId: "org-1", year: 2025 }),
    );
    const res = await POST(makeRequest(), { params: makeParams() });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe(FISCAL_YEAR_NOT_FOUND);
  });

  it("(l) returns 500 MISSING_RESULT_ACCOUNT (W-7 — system misconfig, NOT 422)", async () => {
    mockClose.mockRejectedValueOnce(
      new MissingResultAccountError({ organizationId: "org-1" }),
    );
    const res = await POST(makeRequest(), { params: makeParams() });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe(MISSING_RESULT_ACCOUNT);
  });
});

describe("POST /api/.../annual-close — Zod validation", () => {
  it("(m) returns 400 on missing justification (Zod validation failure)", async () => {
    const res = await POST(makeRequest({ year: 2025 }), {
      params: makeParams(),
    });
    expect(res.status).toBe(400);
  });

  it("(m') returns 400 on short justification (Zod validation failure)", async () => {
    const res = await POST(
      makeRequest({ year: 2025, justification: "x" }),
      { params: makeParams() },
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/.../annual-close — unhandled error", () => {
  it("(n) returns 500 on generic unhandled Error", async () => {
    mockClose.mockRejectedValueOnce(new Error("boom"));
    const res = await POST(makeRequest(), { params: makeParams() });
    expect(res.status).toBe(500);
  });
});
