/**
 * T07 — RED: API route tests for GET /api/organizations/[orgSlug]/equity-statement
 *
 * Covers: REQ-9 (RBAC 403), REQ-10 (date validation 400), REQ-11 (format dispatch)
 *
 * C4 cutover [[cross_module_boundary_mock_target_rewrite]]:
 * - vi.mock for server barrel → modules/accounting/equity-statement/presentation/server
 * - vi.mock for pdf exporter → modules/accounting/equity-statement/infrastructure/exporters/equity-statement-pdf.exporter
 * - vi.mock for xlsx exporter → modules/accounting/equity-statement/infrastructure/exporters/equity-statement-xlsx.exporter
 *
 * [[mock_hygiene_commit_scope]]: factory shape extended — vi.mock for server barrel now includes
 * makeEquityStatementService factory mock returning { generate, getOrgMetadata }.
 * AXIS-DISTINCT vs TB: route.ts uses service.getOrgMetadata() (design §9.1 Option A), so
 * factory mock stub MUST include getOrgMetadata — no separate PrismaEquityStatementRepo mock needed.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { ForbiddenError } from "@/features/shared/errors";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockRequirePermission, mockGenerate, mockGetOrgMetadata } = vi.hoisted(() => ({
  mockRequirePermission: vi.fn(),
  mockGenerate: vi.fn(),
  mockGetOrgMetadata: vi.fn(),
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

// [[cross_module_boundary_mock_target_rewrite]]: repointed from @/features/ → @/modules/
// [[mock_hygiene_commit_scope]]: factory shape extended — added makeEquityStatementService mock.
// [[mock_hygiene_commit_scope]] + sister archive #2282 NEW INVARIANT #3:
//   vi.mock MUST return BOTH class AND factory.
// AXIS-DISTINCT vs TB: factory stub includes getOrgMetadata (route.ts uses service.getOrgMetadata)
vi.mock("@/modules/accounting/equity-statement/presentation/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/accounting/equity-statement/presentation/server")>()),
  EquityStatementService: vi.fn().mockImplementation(function () {
    return { generate: mockGenerate, getOrgMetadata: mockGetOrgMetadata };
  }),
  makeEquityStatementService: vi.fn().mockReturnValue({
    generate: mockGenerate,
    getOrgMetadata: mockGetOrgMetadata,
  }),
}));

// [[cross_module_boundary_mock_target_rewrite]]: repointed from exporters/ → infrastructure/exporters/
vi.mock("@/modules/accounting/equity-statement/infrastructure/exporters/equity-statement-pdf.exporter", () => ({
  exportEquityStatementPdf: vi.fn().mockResolvedValue({
    buffer: Buffer.from("%PDF-1.4 minimal"),
    docDef: {},
  }),
}));

// [[cross_module_boundary_mock_target_rewrite]]: repointed from exporters/ → infrastructure/exporters/
vi.mock("@/modules/accounting/equity-statement/infrastructure/exporters/equity-statement-xlsx.exporter", () => ({
  exportEquityStatementXlsx: vi.fn().mockResolvedValue(Buffer.from("PK xlsx content")),
}));

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
  dateFrom: new Date("2024-01-01"),
  dateTo: new Date("2024-12-31"),
  columns: [],
  rows: [
    { key: "SALDO_INICIAL", label: "Saldo al inicio del período", cells: [], total: D("0") },
    { key: "RESULTADO_EJERCICIO", label: "Resultado del ejercicio", cells: [], total: D("0") },
    { key: "SALDO_FINAL", label: "Saldo al cierre del período", cells: [], total: D("0") },
  ],
  columnTotals: {},
  grandTotal: D("0"),
  periodResult: D("0"),
  imbalanced: false,
  imbalanceDelta: D("0"),
  preliminary: true,
};

// ── Import after mocks ────────────────────────────────────────────────────────

import { GET, runtime } from "../route";
import { exportEquityStatementPdf } from "@/modules/accounting/equity-statement/infrastructure/exporters/equity-statement-pdf.exporter";
import { exportEquityStatementXlsx } from "@/modules/accounting/equity-statement/infrastructure/exporters/equity-statement-xlsx.exporter";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeParams(slug = "acme") {
  return Promise.resolve({ orgSlug: slug });
}

function makeRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/organizations/acme/equity-statement");
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
  mockGetOrgMetadata.mockResolvedValue({ name: "Avicont SA", taxId: "12345", address: "La Paz" });
});

describe("GET /api/.../equity-statement — runtime", () => {
  it("runtime is 'nodejs'", () => {
    expect(runtime).toBe("nodejs");
  });
});

describe("GET /api/.../equity-statement — input validation", () => {
  it("missing dateFrom → 400", async () => {
    const res = await GET(makeRequest({ dateTo: "2024-12-31" }), { params: makeParams() });
    expect(res.status).toBe(400);
  });

  it("missing dateTo → 400", async () => {
    const res = await GET(makeRequest({ dateFrom: "2024-01-01" }), { params: makeParams() });
    expect(res.status).toBe(400);
  });

  it("invalid date format → 400", async () => {
    const res = await GET(makeRequest({ dateFrom: "not-a-date", dateTo: "2024-12-31" }), { params: makeParams() });
    expect(res.status).toBe(400);
  });

  it("dateFrom > dateTo → 400", async () => {
    const res = await GET(makeRequest({ dateFrom: "2024-12-31", dateTo: "2024-01-01" }), { params: makeParams() });
    expect(res.status).toBe(400);
  });

  it("format=csv → 400", async () => {
    const res = await GET(makeRequest({ dateFrom: "2024-01-01", dateTo: "2024-12-31", format: "csv" }), { params: makeParams() });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/.../equity-statement — RBAC", () => {
  it("requirePermission throws ForbiddenError → 403", async () => {
    mockRequirePermission.mockRejectedValue(new ForbiddenError());
    const res = await GET(makeRequest({ dateFrom: "2024-01-01", dateTo: "2024-12-31" }), { params: makeParams() });
    expect(res.status).toBe(403);
  });

  it("requirePermission throws 401-style → 401", async () => {
    const err = { message: "No autorizado", statusCode: 401 };
    mockRequirePermission.mockRejectedValue(err);
    const res = await GET(makeRequest({ dateFrom: "2024-01-01", dateTo: "2024-12-31" }), { params: makeParams() });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/.../equity-statement — happy path JSON", () => {
  it("valid request → 200 with Content-Type application/json and rows", async () => {
    const res = await GET(makeRequest({ dateFrom: "2024-01-01", dateTo: "2024-12-31" }), { params: makeParams() });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();
    expect(body).toHaveProperty("rows");
    expect(body.rows).toHaveLength(3);
  });
});

describe("GET /api/.../equity-statement — format dispatch", () => {
  it("format=pdf → 200 + Content-Type application/pdf + Content-Disposition with eepn-", async () => {
    const res = await GET(makeRequest({ dateFrom: "2024-01-01", dateTo: "2024-12-31", format: "pdf" }), { params: makeParams() });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    const cd = res.headers.get("content-disposition") ?? "";
    expect(cd).toContain("eepn-");
    expect(exportEquityStatementPdf).toHaveBeenCalled();
  });

  it("format=xlsx → 200 + Content-Type spreadsheetml + xlsx filename", async () => {
    const res = await GET(makeRequest({ dateFrom: "2024-01-01", dateTo: "2024-12-31", format: "xlsx" }), { params: makeParams() });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("spreadsheetml");
    const cd = res.headers.get("content-disposition") ?? "";
    expect(cd).toContain(".xlsx");
    expect(exportEquityStatementXlsx).toHaveBeenCalled();
  });
});
