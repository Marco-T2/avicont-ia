/**
 * T52 — RED: Legacy-deprecation tests for PATCH /periods/[periodId]
 *
 * Covers:
 *   (a) PATCH with close payload returns 410 Gone with LEGACY_CLOSE_REMOVED code
 *   (b) GET /periods/[periodId] still works — returns 200
 *
 * Fails until T53 replaces the PATCH handler with a 410 response.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { LEGACY_CLOSE_REMOVED } from "@/features/shared/errors";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockRequirePermission, mockGetById } = vi.hoisted(() => ({
  mockRequirePermission: vi.fn(),
  mockGetById: vi.fn(),
}));

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("@/features/permissions/server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/modules/fiscal-periods/presentation/server", () => ({
  makeFiscalPeriodsService: vi.fn(() => ({
    getById: mockGetById,
    close: vi.fn(),
  })),
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

import { GET, PATCH } from "../route";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ORG_SLUG = "test-org";
const PERIOD_ID = "period-1";

function makeParams(orgSlug = ORG_SLUG, periodId = PERIOD_ID) {
  return Promise.resolve({ orgSlug, periodId });
}

function makePatchRequest(body: unknown) {
  return new Request(
    `http://localhost/api/organizations/${ORG_SLUG}/periods/${PERIOD_ID}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function makeGetRequest() {
  return new Request(
    `http://localhost/api/organizations/${ORG_SLUG}/periods/${PERIOD_ID}`,
    { method: "GET" },
  );
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePermission.mockResolvedValue({ orgId: "org-1" });
  mockGetById.mockResolvedValue({
    toSnapshot: () => ({ id: PERIOD_ID, name: "Abril 2026", status: "OPEN" }),
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PATCH /periods/[periodId] — legacy deprecation", () => {
  it("PATCH /periods/[periodId] with close payload returns 410 Gone", async () => {
    const res = await PATCH(makePatchRequest({ status: "CLOSED" }), { params: makeParams() });

    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body).toEqual({
      code: LEGACY_CLOSE_REMOVED,
      newEndpoint: "POST /api/organizations/{orgSlug}/monthly-close",
    });
  });
});

describe("GET /periods/[periodId] — retained", () => {
  it("GET /periods/[periodId] still works", async () => {
    const res = await GET(makeGetRequest(), { params: makeParams() });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ id: PERIOD_ID });
  });
});

describe("PATCH /periods/[periodId] — RBAC gate (REQ-4f)", () => {
  it("calls requirePermission with (\"period\",\"write\",orgSlug) on PATCH non-close branch", async () => {
    // RED: currently gates on ("accounting-config","write","test-org")
    // A non-close body hits the write gate before returning 400
    await PATCH(makePatchRequest({ name: "Enero 2026" }), { params: makeParams() });

    expect(mockRequirePermission).toHaveBeenCalledWith("period", "write", ORG_SLUG);
  });

  it("REQ-4g — contador receives 403 on PATCH (not in PERMISSIONS_WRITE[\"period\"])", async () => {
    const { ForbiddenError } = await import("@/features/shared/errors");
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("No tenés acceso a este recurso", "FORBIDDEN"),
    );

    const res = await PATCH(makePatchRequest({ name: "Enero 2026" }), { params: makeParams() });

    expect(res.status).toBe(403);
  });
});
