/**
 * RED — Route contract for GET /api/.../contact-balances/dashboard (C6c).
 *
 * Spec REQ "API Contract — Contact Balances" + "Contact Dashboard".
 *
 * Cases:
 *   T1 — GET ?type=CLIENTE → 200 + ContactsDashboardPaginatedResult shape
 *   T2 — GET ?type=PROVEEDOR → 200 + paginated dto
 *   T3 — GET sin type → 400/422 ValidationError (type es required)
 *   T4 — GET ?type=INVALID → 400/422 ValidationError
 *   T5 — GET ?type=CLIENTE&includeZeroBalance=true → forwards true al service
 *   T6 — Permission: requirePermission called con (reports, read, orgSlug)
 *   T7 — sin permission reports:read → 403 ForbiddenError
 *   T8 — pagination params (page=2, pageSize=10) forwarded al service
 *   T9 — sort + direction forwarded al service
 *
 * Expected RED failure mode per [[red_acceptance_failure_mode]]:
 *   Route file `app/api/organizations/[orgSlug]/contact-balances/dashboard/
 *   route.ts` does not exist yet — vitest import resolution fails. C6c GREEN
 *   ships the route + Zod schema + service dispatch.
 *
 * Sister precedent: trial-balance route test + contact-ledger route test
 * (paired sister apply directly per [[paired_sister_default_no_surface]]).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ForbiddenError } from "@/features/shared/errors";

// ── Hoisted mocks ────────────────────────────────────────────────────────────
const {
  mockRequirePermission,
  mockListContactsWithOpenBalance,
} = vi.hoisted(() => ({
  mockRequirePermission: vi.fn(),
  mockListContactsWithOpenBalance: vi.fn(),
}));

// ── Module mocks ─────────────────────────────────────────────────────────────
vi.mock("@/features/permissions/server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/features/shared/middleware", () => ({
  handleError: vi.fn((err: unknown) => {
    if (
      err != null &&
      typeof err === "object" &&
      "flatten" in err &&
      typeof (err as Record<string, unknown>).flatten === "function"
    ) {
      return Response.json({ error: "Datos inválidos" }, { status: 400 });
    }
    if (err != null && typeof err === "object" && "statusCode" in err) {
      const e = err as { message: string; code?: string; statusCode: number };
      return Response.json(
        { error: e.message, code: e.code },
        { status: e.statusCode },
      );
    }
    return Response.json({ error: "Error interno" }, { status: 500 });
  }),
}));

// [[mock_hygiene_commit_scope]] + [[cross_module_boundary_mock_target_rewrite]]:
// makeContactBalancesService factory mock — route.ts will call it once at
// module load. Stub exposes only `listContactsWithOpenBalance`.
vi.mock("@/modules/contact-balances/presentation/server", () => ({
  makeContactBalancesService: vi.fn().mockReturnValue({
    listContactsWithOpenBalance: mockListContactsWithOpenBalance,
  }),
}));

// ── Fixture DTO ──────────────────────────────────────────────────────────────
const minimalDto = {
  items: [
    {
      contactId: "c-1",
      name: "Acme",
      lastMovementDate: "2025-01-15T00:00:00.000Z",
      openBalance: "1500.50",
    },
  ],
  total: 1,
  page: 1,
  pageSize: 20,
  totalPages: 1,
};

// ── Import after mocks ───────────────────────────────────────────────────────
import { GET } from "../route";

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeParams(slug = "acme") {
  return Promise.resolve({ orgSlug: slug });
}

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL(
    "http://localhost/api/organizations/acme/contact-balances/dashboard",
  );
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString());
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePermission.mockResolvedValue({
    orgId: "org-1",
    role: "contador",
  });
  mockListContactsWithOpenBalance.mockResolvedValue(minimalDto);
});

describe("GET /api/.../contact-balances/dashboard — happy path (T1, T2)", () => {
  it("T1 — type=CLIENTE → 200 + paginated dto shape", async () => {
    const res = await GET(makeRequest({ type: "CLIENTE" }), {
      params: makeParams(),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      items: expect.any(Array),
      total: expect.any(Number),
      page: expect.any(Number),
      pageSize: expect.any(Number),
      totalPages: expect.any(Number),
    });
  });

  it("T2 — type=PROVEEDOR → 200 + paginated dto", async () => {
    const res = await GET(makeRequest({ type: "PROVEEDOR" }), {
      params: makeParams(),
    });
    expect(res.status).toBe(200);
    expect(mockListContactsWithOpenBalance).toHaveBeenCalledWith(
      "org-1",
      "PROVEEDOR",
      expect.any(Object),
    );
  });
});

describe("GET /api/.../contact-balances/dashboard — validation (T3, T4, T5)", () => {
  it("T3 — sin type → 4xx ValidationError", async () => {
    const res = await GET(makeRequest({}), { params: makeParams() });
    expect([400, 422]).toContain(res.status);
  });

  it("T4 — type=INVALID → 4xx ValidationError", async () => {
    const res = await GET(makeRequest({ type: "INVALID" }), {
      params: makeParams(),
    });
    expect([400, 422]).toContain(res.status);
  });

  it("T5 — includeZeroBalance=true → forwarded al service", async () => {
    await GET(
      makeRequest({ type: "CLIENTE", includeZeroBalance: "true" }),
      { params: makeParams() },
    );
    expect(mockListContactsWithOpenBalance).toHaveBeenCalledWith(
      "org-1",
      "CLIENTE",
      expect.objectContaining({ includeZeroBalance: true }),
    );
  });
});

describe("GET /api/.../contact-balances/dashboard — RBAC (T6, T7)", () => {
  it("T6 — requirePermission called with (reports, read, orgSlug)", async () => {
    await GET(makeRequest({ type: "CLIENTE" }), { params: makeParams("foo") });
    expect(mockRequirePermission).toHaveBeenCalledWith(
      "reports",
      "read",
      "foo",
    );
  });

  it("T7 — sin permission reports:read → 403 ForbiddenError", async () => {
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Forbidden", "FORBIDDEN"),
    );
    const res = await GET(makeRequest({ type: "CLIENTE" }), {
      params: makeParams(),
    });
    expect(res.status).toBe(403);
  });
});

describe("GET /api/.../contact-balances/dashboard — pagination + sort (T8, T9)", () => {
  it("T8 — page + pageSize forwarded al service", async () => {
    await GET(
      makeRequest({ type: "CLIENTE", page: "2", pageSize: "10" }),
      { params: makeParams() },
    );
    expect(mockListContactsWithOpenBalance).toHaveBeenCalledWith(
      "org-1",
      "CLIENTE",
      expect.objectContaining({ page: 2, pageSize: 10 }),
    );
  });

  it("T9 — sort + direction forwarded al service", async () => {
    await GET(
      makeRequest({ type: "CLIENTE", sort: "name", direction: "asc" }),
      { params: makeParams() },
    );
    expect(mockListContactsWithOpenBalance).toHaveBeenCalledWith(
      "org-1",
      "CLIENTE",
      expect.objectContaining({ sort: "name", direction: "asc" }),
    );
  });
});
