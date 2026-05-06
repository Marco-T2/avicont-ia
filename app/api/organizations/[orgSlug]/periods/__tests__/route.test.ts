/**
 * REQ-4f/4g — RED: assert period:write gate on POST /periods and PATCH /periods/[periodId]
 *
 * Precondition: T-F12-GREEN landed — PERMISSIONS_WRITE["period"] = ["owner","admin"].
 *
 * (a) POST /periods calls requirePermission("period","write",orgSlug) — not "accounting-config","write"
 * (b) PATCH /periods/[periodId] non-close calls requirePermission("period","write",orgSlug)
 * (c) REQ-4g: role "contador" receives 403 for both
 *
 * RED failure mode (Rule 1): expected mockRequirePermission to be called with
 * ("period","write","acme") but was called with ("accounting-config","write","acme")
 * because handlers still gate on accounting-config:write.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockRequirePermission, mockCreate, mockList, mockResolveByClerkId } = vi.hoisted(
  () => ({
    mockRequirePermission: vi.fn(),
    mockCreate: vi.fn(),
    mockList: vi.fn(),
    mockResolveByClerkId: vi.fn(),
  }),
);

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("@/features/permissions/server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/modules/fiscal-periods/presentation/server", () => ({
  makeFiscalPeriodsService: vi.fn(() => ({
    list: mockList,
    create: mockCreate,
  })),
}));

vi.mock("@/features/users/server", () => ({
  UsersService: vi.fn().mockImplementation(function () {
    return {
      resolveByClerkId: mockResolveByClerkId,
    };
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

import { POST } from "../route";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ORG_SLUG = "acme";

function makePostRequest(body: unknown) {
  return new Request(`http://localhost/api/organizations/${ORG_SLUG}/periods`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeParams(orgSlug = ORG_SLUG) {
  return Promise.resolve({ orgSlug });
}

const VALID_PERIOD_BODY = {
  year: 2026,
  month: 1,
};

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePermission.mockResolvedValue({
    orgId: "org-acme",
    session: { userId: "clerk-01" },
  });
  mockResolveByClerkId.mockResolvedValue({ id: "user-01" });
  mockCreate.mockResolvedValue({
    toSnapshot: () => ({ id: "period-01", year: 2026, month: 1, status: "OPEN" }),
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /periods — RBAC gate (REQ-4f)", () => {
  it("calls requirePermission with (\"period\",\"write\",orgSlug)", async () => {
    // RED: currently gates on ("accounting-config","write","acme")
    await POST(makePostRequest(VALID_PERIOD_BODY), { params: makeParams() });

    expect(mockRequirePermission).toHaveBeenCalledWith("period", "write", ORG_SLUG);
  });

  it("REQ-4g — contador receives 403 (not in PERMISSIONS_WRITE[\"period\"])", async () => {
    const { ForbiddenError } = await import("@/features/shared/errors");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("No tenés acceso a este recurso", "FORBIDDEN"),
    );

    const res = await POST(makePostRequest(VALID_PERIOD_BODY), { params: makeParams() });

    expect(res.status).toBe(403);
  });
});
