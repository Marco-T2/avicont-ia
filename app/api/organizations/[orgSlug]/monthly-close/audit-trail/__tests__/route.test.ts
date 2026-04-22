/**
 * T59 — RED: Audit-trail route handler tests.
 *
 * GET /api/organizations/[orgSlug]/monthly-close/audit-trail?correlationId=<uuid>
 *
 * Asserts:
 * (a) Returns AuditLog[] filtered by correlationId.
 * (b) Returns 400 when correlationId is missing.
 * (c) Returns 403 when requirePermission throws ForbiddenError.
 *
 * Fails until T60 creates the route.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockRequirePermission, mockFindMany } = vi.hoisted(() => ({
  mockRequirePermission: vi.fn(),
  mockFindMany: vi.fn(),
}));

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("@/features/shared/permissions.server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: {
      findMany: mockFindMany,
    },
  },
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

import { GET } from "../route";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ORG_SLUG = "test-org";
const ORG_ID = "org-audit-1";
const CORRELATION_ID = "corr-uuid-test-1234";

const auditRows = [
  {
    id: "audit-1",
    organizationId: ORG_ID,
    entityType: "fiscal_periods",
    entityId: "period-1",
    action: "STATUS_CHANGE",
    oldValues: { status: "OPEN" },
    newValues: { status: "CLOSED" },
    changedById: null,
    justification: null,
    correlationId: CORRELATION_ID,
    createdAt: new Date("2026-04-21T10:00:00.000Z"),
  },
  {
    id: "audit-2",
    organizationId: ORG_ID,
    entityType: "dispatches",
    entityId: "dispatch-1",
    action: "STATUS_CHANGE",
    oldValues: { status: "POSTED" },
    newValues: { status: "LOCKED" },
    changedById: null,
    justification: null,
    correlationId: CORRELATION_ID,
    createdAt: new Date("2026-04-21T10:00:01.000Z"),
  },
];

function makeParams(slug = ORG_SLUG) {
  return Promise.resolve({ orgSlug: slug });
}

function makeRequest(correlationId?: string) {
  const url = correlationId
    ? `http://localhost/api/organizations/${ORG_SLUG}/monthly-close/audit-trail?correlationId=${correlationId}`
    : `http://localhost/api/organizations/${ORG_SLUG}/monthly-close/audit-trail`;
  return new Request(url);
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePermission.mockResolvedValue({ orgId: ORG_ID });
  mockFindMany.mockResolvedValue(auditRows);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/.../monthly-close/audit-trail", () => {
  it("(a) returns AuditLog[] filtered by correlationId", async () => {
    const res = await GET(makeRequest(CORRELATION_ID), { params: makeParams() });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
    expect(body[0].correlationId).toBe(CORRELATION_ID);
    expect(body[1].correlationId).toBe(CORRELATION_ID);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ correlationId: CORRELATION_ID }),
      }),
    );
  });

  it("(b) returns 400 when correlationId is missing", async () => {
    const res = await GET(makeRequest(), { params: makeParams() });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION");
  });

  it("(c) returns 403 when requirePermission throws ForbiddenError", async () => {
    const forbiddenError = Object.assign(new Error("Forbidden"), {
      statusCode: 403,
      code: "FORBIDDEN",
    });
    mockRequirePermission.mockRejectedValue(forbiddenError);

    const res = await GET(makeRequest(CORRELATION_ID), { params: makeParams() });

    expect(res.status).toBe(403);
  });
});
