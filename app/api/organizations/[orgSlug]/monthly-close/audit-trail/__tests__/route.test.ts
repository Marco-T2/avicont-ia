/**
 * T59 — Audit-trail route handler tests.
 *
 * GET /api/organizations/[orgSlug]/monthly-close/audit-trail?correlationId=<uuid>
 *
 * Asserts:
 * (a) Returns AuditLog[] filtered by correlationId.
 * (b) Returns 400 when correlationId is missing.
 * (c) Returns 403 when requirePermission throws ForbiddenError.
 * (d) Gates on resource=period action=read.
 *
 * FLIPPED (audit-pure-read Group B): this test historically mocked
 * `@/lib/prisma` and asserted `prisma.auditLog.findMany` was invoked by the
 * route — i.e. it REQUIRED the route to import prisma directly. The read now
 * lives behind the audit-owned `AuditCloseEventReaderPort` exposed via
 * `makeAuditReads()`, so the test mocks the composition root instead and
 * asserts the tenant-scoped port call `(orgId, correlationId)`.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockRequirePermission, mockListByCorrelation } = vi.hoisted(() => ({
  mockRequirePermission: vi.fn(),
  mockListByCorrelation: vi.fn(),
}));

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("@/modules/permissions/application/server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/modules/audit/presentation/server", () => ({
  makeAuditReads: () => ({
    closeEvents: { listByCorrelation: mockListByCorrelation },
  }),
}));

vi.mock("@/modules/shared/presentation/middleware", () => ({
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
  mockListByCorrelation.mockResolvedValue(auditRows);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/.../monthly-close/audit-trail", () => {
  it("(a) returns AuditLog[] filtered by correlationId via the tenant-scoped audit read port", async () => {
    const res = await GET(makeRequest(CORRELATION_ID), { params: makeParams() });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
    expect(body[0].correlationId).toBe(CORRELATION_ID);
    expect(body[1].correlationId).toBe(CORRELATION_ID);

    expect(mockListByCorrelation).toHaveBeenCalledTimes(1);
    expect(mockListByCorrelation).toHaveBeenCalledWith(ORG_ID, CORRELATION_ID);
  });

  it("(b) returns 400 when correlationId is missing", async () => {
    const res = await GET(makeRequest(), { params: makeParams() });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION");
    expect(mockListByCorrelation).not.toHaveBeenCalled();
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

  it("(d) gates on resource=period action=read", async () => {
    await GET(makeRequest(CORRELATION_ID), { params: makeParams() });

    expect(mockRequirePermission).toHaveBeenCalledWith("period", "read", ORG_SLUG);
  });
});
