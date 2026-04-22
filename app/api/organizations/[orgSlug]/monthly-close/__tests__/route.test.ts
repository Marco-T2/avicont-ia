/**
 * T36 — RED: Route handler tests for POST /api/organizations/[orgSlug]/monthly-close
 *
 * Covers:
 *   (a) 200 with CloseResult on success
 *   (b) 409 PERIOD_ALREADY_CLOSED
 *   (c) 422 PERIOD_UNBALANCED with details
 *   (d) 422 PERIOD_HAS_DRAFT_ENTRIES with details
 *   (e) 404 PERIOD_NOT_FOUND
 *   (f) 400 on invalid payload (missing periodId) — Zod validation
 *
 * Fails until T37 rewrites the route with Zod + new CloseRequest shape.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  PERIOD_ALREADY_CLOSED,
  PERIOD_HAS_DRAFT_ENTRIES,
  PERIOD_NOT_FOUND,
  PERIOD_UNBALANCED,
} from "@/features/shared/errors";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockRequirePermission, mockClose, mockResolveByClerkId } = vi.hoisted(() => ({
  mockRequirePermission: vi.fn(),
  mockClose: vi.fn(),
  mockResolveByClerkId: vi.fn(),
}));

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("@/features/shared/permissions.server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/features/monthly-close/server", () => ({
  MonthlyCloseService: vi.fn().mockImplementation(function () {
    return { close: mockClose };
  }),
}));

vi.mock("@/features/shared/users.service", () => ({
  UsersService: vi.fn().mockImplementation(function () {
    return { resolveByClerkId: mockResolveByClerkId };
  }),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { POST } from "../route";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ORG_SLUG = "test-org";

const validCloseResult = {
  periodId: "period-1",
  periodStatus: "CLOSED" as const,
  closedAt: new Date("2025-04-01T00:00:00Z"),
  correlationId: "corr-abc",
  locked: {
    dispatches: 5,
    payments: 3,
    journalEntries: 12,
    sales: 8,
    purchases: 2,
  },
};

function makeParams(slug = ORG_SLUG) {
  return Promise.resolve({ orgSlug: slug });
}

function makeRequest(body: unknown = { periodId: "period-1" }) {
  return new Request("http://localhost/api/organizations/test-org/monthly-close", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePermission.mockResolvedValue({ session: { userId: "clerk-u1" }, orgId: "org-1" });
  mockResolveByClerkId.mockResolvedValue({ id: "db-user-1" });
  mockClose.mockResolvedValue(validCloseResult);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/.../monthly-close — success", () => {
  it("(a) returns 200 with CloseResult on success", async () => {
    const res = await POST(makeRequest({ periodId: "period-1" }), { params: makeParams() });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      periodId: "period-1",
      periodStatus: "CLOSED",
      correlationId: "corr-abc",
      locked: expect.objectContaining({ dispatches: 5 }),
    });
    // Verify service was called with the new CloseRequest shape
    expect(mockClose).toHaveBeenCalledWith({
      organizationId: "org-1",
      periodId: "period-1",
      userId: "db-user-1",
      justification: undefined,
    });
  });

  it("(a) passes justification when provided", async () => {
    await POST(makeRequest({ periodId: "period-2", justification: "End of month" }), { params: makeParams() });

    expect(mockClose).toHaveBeenCalledWith({
      organizationId: "org-1",
      periodId: "period-2",
      userId: "db-user-1",
      justification: "End of month",
    });
  });
});

describe("POST /api/.../monthly-close — error cases", () => {
  it("(b) returns 409 PERIOD_ALREADY_CLOSED", async () => {
    mockClose.mockRejectedValue(
      new ConflictError("period-1", PERIOD_ALREADY_CLOSED),
    );

    const res = await POST(makeRequest(), { params: makeParams() });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe(PERIOD_ALREADY_CLOSED);
  });

  it("(c) returns 422 PERIOD_UNBALANCED with details", async () => {
    mockClose.mockRejectedValue(
      new ValidationError("El período no está balanceado", PERIOD_UNBALANCED, {
        debit: "10000.00",
        credit: "9500.00",
        diff: "500.00",
      }),
    );

    const res = await POST(makeRequest(), { params: makeParams() });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe(PERIOD_UNBALANCED);
    expect(body.details).toMatchObject({
      debit: "10000.00",
      credit: "9500.00",
      diff: "500.00",
    });
  });

  it("(d) returns 422 PERIOD_HAS_DRAFT_ENTRIES with details", async () => {
    mockClose.mockRejectedValue(
      new ValidationError("Hay comprobantes en borrador", PERIOD_HAS_DRAFT_ENTRIES, {
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
    expect(body.code).toBe(PERIOD_HAS_DRAFT_ENTRIES);
    expect(body.details).toMatchObject({
      dispatches: 2,
      payments: 1,
    });
  });

  it("(e) returns 404 PERIOD_NOT_FOUND", async () => {
    mockClose.mockRejectedValue(
      new NotFoundError("period-1", PERIOD_NOT_FOUND),
    );

    const res = await POST(makeRequest(), { params: makeParams() });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe(PERIOD_NOT_FOUND);
  });

  it("(f) returns 400 on invalid payload (missing periodId)", async () => {
    const res = await POST(makeRequest({}), { params: makeParams() });

    expect(res.status).toBe(400);
  });
});
