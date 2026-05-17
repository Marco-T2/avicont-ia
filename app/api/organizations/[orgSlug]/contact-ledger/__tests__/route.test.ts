/**
 * C4 — RED: API route tests for GET /api/organizations/[orgSlug]/contact-ledger
 *
 * Covers spec REQ "API Contract — Contact Ledger":
 *   T1 — format=json + valid params → 200 + ContactLedgerPaginatedDto shape
 *   T2 — format=json sin params → 200 (defaults aplicados)
 *   T3 — format=pdf sin contactId → ValidationError (422)
 *   T4 — format=xlsx sin dateFrom/dateTo → ValidationError (422)
 *   T5 — sin permission `reports:read` → 403 ForbiddenError
 *   T6 — format=pdf con contactId+rango → 501 NotImplementedError (stub C7)
 *   T7 — format=xlsx con contactId+rango → 501 NotImplementedError (stub C7)
 *   T8 — Decimal serializados como string en json (NO Decimal objects)
 *
 * Expected RED failure mode per [[red_acceptance_failure_mode]]:
 *   Route file `app/api/organizations/[orgSlug]/contact-ledger/route.ts` does
 *   not exist yet — import resolution fails (ERR_MODULE_NOT_FOUND or
 *   vitest path-resolve error). PDF/XLSX stubs throw NotImplementedError
 *   (deliberate staged-red until C7 per design D6).
 *
 * Sister precedent: `app/api/organizations/[orgSlug]/trial-balance/__tests__/route.test.ts`
 * (paired sister apply directly per [[paired_sister_default_no_surface]]).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ForbiddenError, ValidationError } from "@/features/shared/errors";

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  mockRequirePermission,
  mockGetContactLedgerPaginated,
} = vi.hoisted(() => ({
  mockRequirePermission: vi.fn(),
  mockGetContactLedgerPaginated: vi.fn(),
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
      return Response.json(
        { error: "Datos inválidos" },
        { status: 400 },
      );
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
// makeLedgerService factory mock — route.ts calls `makeLedgerService()` once at
// module load and reuses the singleton across requests. Mock returns a service
// stub exposing only `getContactLedgerPaginated` (the method this route exercises).
vi.mock("@/modules/accounting/presentation/server", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/modules/accounting/presentation/server")
  >()),
  makeLedgerService: vi.fn().mockReturnValue({
    getContactLedgerPaginated: mockGetContactLedgerPaginated,
  }),
}));

// ── Minimal DTO fixture (Decimal fields as string per DEC-1 boundary) ────────

const minimalDto = {
  items: [
    {
      entryId: "je-1",
      date: new Date("2025-01-15"),
      entryNumber: 1,
      voucherCode: "CD",
      displayNumber: "CD2501-000001",
      description: "Venta a cliente",
      debit: "150.50",
      credit: "0.00",
      balance: "150.50",
      status: "PENDING",
      dueDate: "2025-02-15T00:00:00.000Z",
      voucherTypeHuman: "Nota de despacho",
      sourceType: "sale",
      paymentMethod: null,
      bankAccountName: null,
      withoutAuxiliary: false,
    },
  ],
  total: 1,
  page: 1,
  pageSize: 25,
  totalPages: 1,
  openingBalance: "0.00",
};

// ── Import after mocks ───────────────────────────────────────────────────────

import { GET, runtime } from "../route";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeParams(slug = "acme") {
  return Promise.resolve({ orgSlug: slug });
}

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/organizations/acme/contact-ledger");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString());
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePermission.mockResolvedValue({ orgId: "org-1", role: "contador" });
  mockGetContactLedgerPaginated.mockResolvedValue(minimalDto);
});

describe("GET /api/.../contact-ledger — json branch (T1, T2, T8)", () => {
  it("T1 — format=json + valid params → 200 + ContactLedgerPaginatedDto shape", async () => {
    const res = await GET(
      makeRequest({
        contactId: "contact-1",
        dateFrom: "2025-01-01",
        dateTo: "2025-01-31",
        format: "json",
      }),
      { params: makeParams() },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();
    expect(body).toMatchObject({
      items: expect.any(Array),
      total: expect.any(Number),
      page: expect.any(Number),
      pageSize: expect.any(Number),
      totalPages: expect.any(Number),
      openingBalance: expect.any(String),
    });
  });

  it("T2 — format=json sin params → 200 (defaults aplicados)", async () => {
    const res = await GET(makeRequest({ format: "json" }), {
      params: makeParams(),
    });
    expect(res.status).toBe(200);
    // Service called even sin contactId (json branch tolerates filters opcionales).
    expect(mockGetContactLedgerPaginated).toHaveBeenCalled();
  });

  it("T8 — monetary fields serializados como string (DEC-1)", async () => {
    const res = await GET(
      makeRequest({
        contactId: "contact-1",
        dateFrom: "2025-01-01",
        dateTo: "2025-01-31",
      }),
      { params: makeParams() },
    );
    const body = await res.json();
    expect(typeof body.openingBalance).toBe("string");
    expect(typeof body.items[0].debit).toBe("string");
    expect(typeof body.items[0].credit).toBe("string");
    expect(typeof body.items[0].balance).toBe("string");
  });
});

describe("GET /api/.../contact-ledger — input validation (T3, T4)", () => {
  it("T3 — format=pdf sin contactId → ValidationError (422)", async () => {
    const res = await GET(
      makeRequest({ format: "pdf", dateFrom: "2025-01-01", dateTo: "2025-01-31" }),
      { params: makeParams() },
    );
    expect(res.status).toBe(422);
  });

  it("T4 — format=xlsx sin dateFrom/dateTo → ValidationError (422)", async () => {
    const res = await GET(
      makeRequest({ format: "xlsx", contactId: "contact-1" }),
      { params: makeParams() },
    );
    expect(res.status).toBe(422);
  });
});

describe("GET /api/.../contact-ledger — RBAC (T5)", () => {
  it("T5 — sin permission `reports:read` → 403 ForbiddenError", async () => {
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Forbidden", "FORBIDDEN"),
    );
    const res = await GET(makeRequest({ format: "json" }), {
      params: makeParams(),
    });
    expect(res.status).toBe(403);
  });

  it("T5b — requirePermission called with (resource='reports', action='read', orgSlug)", async () => {
    await GET(makeRequest({ format: "json" }), { params: makeParams("acme") });
    expect(mockRequirePermission).toHaveBeenCalledWith(
      "reports",
      "read",
      "acme",
    );
  });
});

describe("GET /api/.../contact-ledger — PDF/XLSX stubs (T6, T7) — staged red until C7", () => {
  it("T6 — format=pdf + contactId + rango → 501 NotImplementedError (stub)", async () => {
    const res = await GET(
      makeRequest({
        format: "pdf",
        contactId: "contact-1",
        dateFrom: "2025-01-01",
        dateTo: "2025-01-31",
      }),
      { params: makeParams() },
    );
    expect(res.status).toBe(501);
  });

  it("T7 — format=xlsx + contactId + rango → 501 NotImplementedError (stub)", async () => {
    const res = await GET(
      makeRequest({
        format: "xlsx",
        contactId: "contact-1",
        dateFrom: "2025-01-01",
        dateTo: "2025-01-31",
      }),
      { params: makeParams() },
    );
    expect(res.status).toBe(501);
  });
});

describe("route module — runtime config", () => {
  it("exports runtime = 'nodejs' (pdfmake/exceljs need Buffer)", () => {
    expect(runtime).toBe("nodejs");
  });
});

// Surface unused import to keep tsc clean when ValidationError pattern check
// isn't directly asserted (handleError mock maps statusCode → response status).
void ValidationError;
