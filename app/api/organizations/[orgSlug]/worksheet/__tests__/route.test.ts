/**
 * T23 — RED: API route tests for GET /api/organizations/[orgSlug]/worksheet
 *
 * Covers:
 *   (a) GET ?format=json → 200 + JSON body with WorksheetReport shape
 *   (b) GET ?format=pdf  → 200 + Content-Type: application/pdf
 *   (c) GET ?format=xlsx → 200 + Content-Type: application/vnd.openxmlformats…
 *   (d) missing auth → 401
 *   (e) viewer role → 403
 *   (f) missing dateFrom/dateTo AND fiscalPeriodId → 400 (Zod validation)
 *   (g) export const runtime === "nodejs" present in the route module
 *
 * Mock pattern mirrors dispatches-hub route tests (duck-typing, vi.mock).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@/generated/prisma/client";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const {
  mockRequirePermission,
  mockGenerateWorksheet,
} = vi.hoisted(() => ({
  mockRequirePermission: vi.fn(),
  mockGenerateWorksheet: vi.fn(),
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
      return Response.json(
        { error: "Datos inválidos", details: (err as { flatten: () => unknown }).flatten() },
        { status: 400 },
      );
    }
    if (err != null && typeof err === "object" && "statusCode" in err) {
      const e = err as { message: string; code?: string; statusCode: number };
      return Response.json({ error: e.message, code: e.code }, { status: e.statusCode });
    }
    return Response.json({ error: "Error interno del servidor" }, { status: 500 });
  }),
}));

// [[cross_module_boundary_mock_target_rewrite]] C4: server barrel repointed to hex presentation.
// [[mock_hygiene_commit_scope]]: vi.mock includes BOTH class AND makeWorksheetService factory mock
// because route.ts post-C4 calls makeWorksheetService() (not new WorksheetService()).
// Sister archive #2298 + #2312 NEW INVARIANT #3: vi.mock must return BOTH class AND factory.
vi.mock("@/modules/accounting/worksheet/presentation/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/accounting/worksheet/presentation/server")>()),
  WorksheetService: vi.fn().mockImplementation(function () {
    return { generateWorksheet: mockGenerateWorksheet };
  }),
  makeWorksheetService: vi.fn().mockReturnValue({ generateWorksheet: mockGenerateWorksheet }),
}));

// PDF exporter mock — returns a minimal Buffer starting with %PDF
// [[cross_module_boundary_mock_target_rewrite]] C4: repointed to hex infrastructure path.
vi.mock("@/modules/accounting/worksheet/infrastructure/exporters/worksheet-pdf.exporter", () => ({
  exportWorksheetPdf: vi.fn().mockResolvedValue({
    buffer: Buffer.from("%PDF-1.4 minimal"),
    docDef: {},
  }),
}));

// XLSX exporter mock — returns a minimal Buffer
// [[cross_module_boundary_mock_target_rewrite]] C4: repointed to hex infrastructure path.
vi.mock("@/modules/accounting/worksheet/infrastructure/exporters/worksheet-xlsx.exporter", () => ({
  exportWorksheetXlsx: vi.fn().mockResolvedValue(Buffer.from("PK xlsx content")),
}));

// serializeStatement re-export from financial-statements SERVER barrel.
// [[cross_module_boundary_mock_target_rewrite]]: mock target follows route.ts —
// serializeStatement is server-only (instanceof Prisma.Decimal), so it lives in
// presentation/server, NOT the client-safe presentation/index barrel.
vi.mock("@/modules/accounting/financial-statements/presentation/server", () => ({
  serializeStatement: vi.fn((obj: unknown) => obj),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { UnauthorizedError, ForbiddenError } from "@/features/shared/errors";

// ── Constants ─────────────────────────────────────────────────────────────────

const ORG_SLUG = "test-org";
const ORG_ID = "org-ws-id";
const USER_ID = "user-ws-id";
const D = (v: string | number) => new Prisma.Decimal(String(v));
const z = () => D(0);

function makeZeroTotals() {
  return {
    sumasDebe: z(), sumasHaber: z(), saldoDeudor: z(), saldoAcreedor: z(),
    ajustesDebe: z(), ajustesHaber: z(), saldoAjDeudor: z(), saldoAjAcreedor: z(),
    resultadosPerdidas: z(), resultadosGanancias: z(), bgActivo: z(), bgPasPat: z(),
  };
}

function makeMinimalReport() {
  return {
    orgId: ORG_ID,
    dateFrom: new Date("2025-01-01"),
    dateTo: new Date("2025-12-31"),
    groups: [],
    carryOverRow: undefined,
    grandTotals: makeZeroTotals(),
    imbalanced: false,
    imbalanceDelta: z(),
  };
}

const BASE_URL = `http://localhost/api/organizations/${ORG_SLUG}/worksheet`;
const VALID_PARAMS = "?dateFrom=2025-01-01&dateTo=2025-12-31";

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  mockRequirePermission.mockResolvedValue({
    session: { userId: USER_ID },
    orgId: ORG_ID,
    role: "contador",
  });

  mockGenerateWorksheet.mockResolvedValue(makeMinimalReport());
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/organizations/[orgSlug]/worksheet", () => {
  it("(a) ?format=json → 200 with WorksheetReport JSON shape", async () => {
    const { GET } = await import("../route");
    const req = new Request(`${BASE_URL}${VALID_PARAMS}&format=json`);
    const res = await GET(req, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("orgId");
    expect(body).toHaveProperty("groups");
    expect(body).toHaveProperty("grandTotals");
    expect(body).toHaveProperty("imbalanced");
  });

  it("(b) ?format=pdf → 200 with Content-Type application/pdf", async () => {
    const { GET } = await import("../route");
    const req = new Request(`${BASE_URL}${VALID_PARAMS}&format=pdf`);
    const res = await GET(req, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toMatch(/hoja-de-trabajo/);
    expect(res.headers.get("Content-Disposition")).toMatch(/\.pdf/);
  });

  it("(c) ?format=xlsx → 200 with Content-Type application/vnd.openxmlformats…", async () => {
    const { GET } = await import("../route");
    const req = new Request(`${BASE_URL}${VALID_PARAMS}&format=xlsx`);
    const res = await GET(req, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(res.headers.get("Content-Disposition")).toMatch(/hoja-de-trabajo/);
    expect(res.headers.get("Content-Disposition")).toMatch(/\.xlsx/);
  });

  it("(d) missing auth → 401", async () => {
    mockRequirePermission.mockRejectedValue(new UnauthorizedError());

    const { GET } = await import("../route");
    const req = new Request(`${BASE_URL}${VALID_PARAMS}`);
    const res = await GET(req, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(401);
  });

  it("(e) viewer role → 403 (requirePermission gate or service gate)", async () => {
    mockRequirePermission.mockRejectedValue(new ForbiddenError("Rol insuficiente"));

    const { GET } = await import("../route");
    const req = new Request(`${BASE_URL}${VALID_PARAMS}`);
    const res = await GET(req, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(403);
  });

  it("(f) missing dateFrom/dateTo AND fiscalPeriodId → 400 (Zod)", async () => {
    const { GET } = await import("../route");
    // No query params at all — Zod refine will fail
    const req = new Request(BASE_URL);
    const res = await GET(req, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Datos inválidos");
  });

  it("(g) runtime=nodejs is exported from the route module", async () => {
    const mod = await import("../route");
    expect((mod as Record<string, unknown>).runtime).toBe("nodejs");
  });

  it("default format=json when no format param", async () => {
    const { GET } = await import("../route");
    const req = new Request(`${BASE_URL}${VALID_PARAMS}`);
    const res = await GET(req, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(200);
    // Should be JSON (not PDF/XLSX)
    const contentType = res.headers.get("Content-Type");
    expect(contentType).toMatch(/application\/json/);
  });
});
