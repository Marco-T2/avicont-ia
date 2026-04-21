/**
 * B5 — RED: API route tests for GET /api/organizations/[orgSlug]/trial-balance
 *
 * Covers:
 *   C10.S1 — missing dateFrom → 400
 *   C10.S2 — missing dateTo → 400
 *   C10.S3 — invalid date format → 400
 *   C10.S4 — dateTo < dateFrom → 400
 *   C10.S5 — valid request, no format → 200 + application/json
 *   C10.S6 — format=pdf → 200 + application/pdf + Content-Disposition
 *   C10.S7 — format=xlsx → 200 + xlsx content-type
 *   C10.S8 — format=csv → 400 invalid format
 *   C10.E1 — orgSlug NOT used for auth; orgId from session
 *   C11.S1 — requirePermission throws ForbiddenError → 403
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { ForbiddenError } from "@/features/shared/errors";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const {
  mockRequirePermission,
  mockGenerate,
} = vi.hoisted(() => ({
  mockRequirePermission: vi.fn(),
  mockGenerate: vi.fn(),
}));

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("@/features/shared/permissions.server", () => ({
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
      return Response.json({ error: e.message, code: e.code }, { status: e.statusCode });
    }
    return Response.json({ error: "Error interno" }, { status: 500 });
  }),
}));

vi.mock("@/features/accounting/trial-balance/server", () => ({
  TrialBalanceService: vi.fn().mockImplementation(function () {
    return { generate: mockGenerate };
  }),
}));

vi.mock("@/features/accounting/trial-balance/exporters/trial-balance-pdf.exporter", () => ({
  exportTrialBalancePdf: vi.fn().mockResolvedValue({
    buffer: Buffer.from("%PDF-1.4 minimal"),
    docDef: {},
  }),
}));

vi.mock("@/features/accounting/trial-balance/exporters/trial-balance-xlsx.exporter", () => ({
  exportTrialBalanceXlsx: vi.fn().mockResolvedValue(Buffer.from("PK xlsx content")),
}));

vi.mock("@/features/accounting/financial-statements/money.utils", () => ({
  serializeStatement: vi.fn((obj: unknown) => obj),
  sumDecimals: vi.fn(),
  eq: vi.fn(),
  roundHalfUp: vi.fn(),
}));

// ── Minimal report fixture ────────────────────────────────────────────────────

const D = (v: string | number) => new Prisma.Decimal(String(v));

const minimalReport = {
  orgId: "org-1",
  dateFrom: new Date("2025-01-01"),
  dateTo: new Date("2025-12-31"),
  rows: [],
  totals: {
    sumasDebe: D("0"),
    sumasHaber: D("0"),
    saldoDeudor: D("0"),
    saldoAcreedor: D("0"),
  },
  imbalanced: false,
  deltaSumas: D("0"),
  deltaSaldos: D("0"),
};

// ── Import after mocks ────────────────────────────────────────────────────────

import { GET, runtime } from "../route";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeParams(slug = "acme") {
  return Promise.resolve({ orgSlug: slug });
}

function makeRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/organizations/acme/trial-balance");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString());
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePermission.mockResolvedValue({ orgId: "org-1", role: "contador" });
  mockGenerate.mockResolvedValue(minimalReport);
});

describe("GET /api/.../trial-balance — input validation (C10)", () => {
  it("C10.S1 — missing dateFrom → 400", async () => {
    const res = await GET(makeRequest({ dateTo: "2025-12-31" }), { params: makeParams() });
    expect(res.status).toBe(400);
  });

  it("C10.S2 — missing dateTo → 400", async () => {
    const res = await GET(makeRequest({ dateFrom: "2025-01-01" }), { params: makeParams() });
    expect(res.status).toBe(400);
  });

  it("C10.S3 — invalid date format → 400", async () => {
    const res = await GET(makeRequest({ dateFrom: "not-a-date", dateTo: "2025-12-31" }), { params: makeParams() });
    expect(res.status).toBe(400);
  });

  it("C10.S4 — dateTo < dateFrom → 400", async () => {
    const res = await GET(makeRequest({ dateFrom: "2025-12-01", dateTo: "2025-01-01" }), { params: makeParams() });
    expect(res.status).toBe(400);
  });

  it("C10.S8 — format=csv → 400 invalid format", async () => {
    const res = await GET(makeRequest({ dateFrom: "2025-01-01", dateTo: "2025-12-31", format: "csv" }), { params: makeParams() });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/.../trial-balance — format dispatch (C10)", () => {
  it("C10.S5 — valid request, no format → 200 + Content-Type: application/json", async () => {
    const res = await GET(makeRequest({ dateFrom: "2025-01-01", dateTo: "2025-12-31" }), { params: makeParams() });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("C10.S6 — format=pdf → 200 + application/pdf + Content-Disposition with sumas-y-saldos", async () => {
    const res = await GET(makeRequest({ dateFrom: "2025-01-01", dateTo: "2025-12-31", format: "pdf" }), { params: makeParams() });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/pdf");
    expect(res.headers.get("content-disposition")).toContain("sumas-y-saldos");
    expect(res.headers.get("content-disposition")).toContain(".pdf");
  });

  it("C10.S7 — format=xlsx → 200 + xlsx content-type + .xlsx in disposition", async () => {
    const res = await GET(makeRequest({ dateFrom: "2025-01-01", dateTo: "2025-12-31", format: "xlsx" }), { params: makeParams() });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("spreadsheetml");
    expect(res.headers.get("content-disposition")).toContain(".xlsx");
  });
});

describe("GET /api/.../trial-balance — RBAC (C11)", () => {
  it("C11.S1 — requirePermission throws ForbiddenError → 403", async () => {
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Forbidden", "FORBIDDEN"));
    const res = await GET(makeRequest({ dateFrom: "2025-01-01", dateTo: "2025-12-31" }), { params: makeParams() });
    expect(res.status).toBe(403);
  });
});

describe("GET /api/.../trial-balance — orgId from session (C10.E1)", () => {
  it("C10.E1 — service is called with orgId from session, not from slug", async () => {
    mockRequirePermission.mockResolvedValue({ orgId: "org-from-session", role: "contador" });
    await GET(makeRequest({ dateFrom: "2025-01-01", dateTo: "2025-12-31" }), { params: makeParams("other-slug") });
    expect(mockGenerate).toHaveBeenCalledWith(
      "org-from-session",
      expect.any(String),
      expect.any(Object),
    );
  });
});

describe("route module", () => {
  it("exports runtime = 'nodejs'", () => {
    expect(runtime).toBe("nodejs");
  });
});
