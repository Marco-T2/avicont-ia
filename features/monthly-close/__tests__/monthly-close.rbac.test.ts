/**
 * T34 — RED: RBAC tests for monthly-close POST route.
 *
 * Covers:
 *   - POST /monthly-close calls requirePermission with ('period', 'close', orgSlug)
 *   - POST /monthly-close returns 403 when requirePermission throws ForbiddenError
 *
 * Fails until T35 adds 'period' to the Resource union and updates the route.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ForbiddenError } from "@/features/shared/errors";
import type { Resource } from "@/features/permissions";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockRequirePermission, mockClose, mockResolveByClerkId } = vi.hoisted(() => ({
  mockRequirePermission: vi.fn(),
  mockClose: vi.fn(),
  mockResolveByClerkId: vi.fn(),
}));

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("@/features/permissions/server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/features/monthly-close/server", () => ({
  MonthlyCloseService: vi.fn().mockImplementation(function () {
    return { close: mockClose };
  }),
}));

vi.mock("@/features/users/server", () => ({
  UsersService: vi.fn().mockImplementation(function () {
    return { resolveByClerkId: mockResolveByClerkId };
  }),
}));

vi.mock("@/features/shared/middleware", () => ({
  handleError: vi.fn((err: unknown) => {
    if (err != null && typeof err === "object" && "statusCode" in err) {
      const e = err as { message: string; code?: string; statusCode: number };
      return Response.json({ error: e.message, code: e.code }, { status: e.statusCode });
    }
    return Response.json({ error: "Error interno" }, { status: 500 });
  }),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { POST } from "@/app/api/organizations/[orgSlug]/monthly-close/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

const ORG_SLUG = "test-org";

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

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePermission.mockResolvedValue({ session: { userId: "u1" }, orgId: "o1" });
  mockResolveByClerkId.mockResolvedValue({ id: "db-user-1" });
  mockClose.mockResolvedValue({
    periodId: "period-1",
    periodStatus: "CLOSED",
    closedAt: new Date(),
    correlationId: "corr-1",
    locked: { dispatches: 0, payments: 0, journalEntries: 0, sales: 0, purchases: 0 },
  });
});

describe("POST /monthly-close — RBAC", () => {
  it("calls requirePermission with period and close", async () => {
    await POST(makeRequest(), { params: makeParams() });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "period" as Resource,
      "close",
      ORG_SLUG,
    );
  });

  it("returns 403 when requirePermission throws ForbiddenError", async () => {
    mockRequirePermission.mockRejectedValue(new ForbiddenError());

    const res = await POST(makeRequest(), { params: makeParams() });

    expect(res.status).toBe(403);
  });
});
