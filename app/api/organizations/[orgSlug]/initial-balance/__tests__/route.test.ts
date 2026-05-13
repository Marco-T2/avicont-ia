/**
 * T18 — RED: API route tests for GET /api/organizations/[orgSlug]/initial-balance
 *
 * Covers:
 *   - runtime = "nodejs" export
 *   - ?format=json  + authorized → 200 application/json with serialized body
 *   - ?format=pdf   + authorized → 200 application/pdf buffer
 *   - ?format=xlsx  + authorized → 200 application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
 *   - Service throws NotFoundError → 404
 *   - requirePermission throws ForbiddenError → 403
 *   - ?format=csv  (invalid) → 400 with zod validation error in body
 *
 * Fails until route.ts is created (T19).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { ForbiddenError, NotFoundError } from "@/features/shared/errors";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockRequirePermission, mockGenerate } = vi.hoisted(() => ({
  mockRequirePermission: vi.fn(),
  mockGenerate: vi.fn(),
}));

// ── Module mocks ──────────────────────────────────────────────────────────────

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
      return Response.json({ error: e.message, code: e.code }, { status: e.statusCode });
    }
    return Response.json({ error: "Error interno" }, { status: 500 });
  }),
}));

// [[cross_module_boundary_mock_target_rewrite]] C4: server barrel repointed to hex presentation.
// [[mock_hygiene_commit_scope]]: vi.mock includes BOTH class AND makeInitialBalanceService factory
// because route.ts post-C4 calls makeInitialBalanceService() (not new InitialBalanceService()).
// Sister archive #2327 NEW INVARIANT: vi.mock must return BOTH class AND factory.
// Internal source: @/modules/accounting/initial-balance/application/initial-balance.service
vi.mock("@/modules/accounting/initial-balance/presentation/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/accounting/initial-balance/presentation/server")>()),
  InitialBalanceService: vi.fn().mockImplementation(function () {
    return { generate: mockGenerate };
  }),
  makeInitialBalanceService: vi.fn().mockReturnValue({ generate: mockGenerate }),
}));

// [[cross_module_boundary_mock_target_rewrite]] C4: repointed to hex infrastructure path.
vi.mock(
  "@/modules/accounting/initial-balance/infrastructure/exporters/initial-balance-pdf.exporter",
  () => ({
    exportInitialBalancePdf: vi.fn().mockResolvedValue({
      buffer: Buffer.from("%PDF-1.4 minimal"),
      docDef: {},
    }),
  }),
);

// [[cross_module_boundary_mock_target_rewrite]] C4: repointed to hex infrastructure path.
vi.mock(
  "@/modules/accounting/initial-balance/infrastructure/exporters/initial-balance-xlsx.exporter",
  () => ({
    exportInitialBalanceXlsx: vi.fn().mockResolvedValue(Buffer.from("PK xlsx content")),
  }),
);

vi.mock("@/modules/accounting/financial-statements/presentation/server", () => ({
  serializeStatement: vi.fn((obj: unknown) => obj),
  sumDecimals: vi.fn(),
  eq: vi.fn(),
  roundHalfUp: vi.fn(),
}));

// ── Minimal statement fixture ─────────────────────────────────────────────────

const D = (v: string | number) => new Prisma.Decimal(String(v));

const minimalStatement = {
  orgId: "org-1",
  org: {
    razonSocial: "Avicont SA",
    nit: "12345",
    representanteLegal: "John Doe",
    direccion: "La Paz",
  },
  dateAt: new Date("2024-01-01"),
  sections: [
    {
      key: "ACTIVO",
      label: "Activo",
      groups: [],
      sectionTotal: D("1000"),
    },
    {
      key: "PASIVO_PATRIMONIO",
      label: "Pasivo y Patrimonio",
      groups: [],
      sectionTotal: D("1000"),
    },
  ] as [unknown, unknown],
  imbalanced: false,
  imbalanceDelta: D("0"),
  multipleCA: false,
  caCount: 1,
};

// ── Import after mocks ────────────────────────────────────────────────────────

import { GET, runtime } from "../route";
import { exportInitialBalancePdf } from "@/modules/accounting/initial-balance/infrastructure/exporters/initial-balance-pdf.exporter";
import { exportInitialBalanceXlsx } from "@/modules/accounting/initial-balance/infrastructure/exporters/initial-balance-xlsx.exporter";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeParams(slug = "acme") {
  return Promise.resolve({ orgSlug: slug });
}

function makeRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/organizations/acme/initial-balance");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString());
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePermission.mockResolvedValue({ orgId: "org-1", role: "contador" });
  mockGenerate.mockResolvedValue(minimalStatement);
});

describe("GET /api/.../initial-balance — runtime", () => {
  it("runtime is 'nodejs'", () => {
    expect(runtime).toBe("nodejs");
  });
});

describe("GET /api/.../initial-balance — RBAC", () => {
  it("requirePermission throws ForbiddenError → 403", async () => {
    mockRequirePermission.mockRejectedValue(new ForbiddenError());
    const res = await GET(makeRequest({}), { params: makeParams() });
    expect(res.status).toBe(403);
  });
});

describe("GET /api/.../initial-balance — format dispatch", () => {
  it("?format=json → 200 with Content-Type application/json and serialized statement body", async () => {
    const res = await GET(makeRequest({ format: "json" }), { params: makeParams() });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();
    expect(body).toHaveProperty("orgId");
  });

  it("no format param defaults to json → 200 application/json", async () => {
    const res = await GET(makeRequest({}), { params: makeParams() });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("?format=pdf → 200 + Content-Type application/pdf + buffer body", async () => {
    const res = await GET(makeRequest({ format: "pdf" }), { params: makeParams() });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(exportInitialBalancePdf).toHaveBeenCalled();
  });

  it("?format=xlsx → 200 + Content-Type spreadsheetml + buffer body", async () => {
    const res = await GET(makeRequest({ format: "xlsx" }), { params: makeParams() });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("spreadsheetml");
    expect(exportInitialBalanceXlsx).toHaveBeenCalled();
  });
});

describe("GET /api/.../initial-balance — error cases", () => {
  it("service throws NotFoundError → 404", async () => {
    mockGenerate.mockRejectedValue(
      new NotFoundError("Comprobante de Apertura", "CA_NOT_FOUND"),
    );
    const res = await GET(makeRequest({ format: "json" }), { params: makeParams() });
    expect(res.status).toBe(404);
  });

  it("?format=csv (invalid) → 400 with zod validation error in body", async () => {
    const res = await GET(makeRequest({ format: "csv" }), { params: makeParams() });
    expect(res.status).toBe(400);
  });
});
