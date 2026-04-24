/**
 * Tests de la ruta de exportación: Libro de Compras IVA → XLSX
 *
 * Estrategia: service y middleware mockeados — no toca la DB ni genera
 * un XLSX real (el exporter también está mockeado para velocidad).
 *
 * Cubre:
 * - GET 200: Content-Type y Content-Disposition correctos, body no vacío
 * - GET 401: sin sesión Clerk
 * - GET 403: sin acceso a la org
 *
 * PR5 — Task 5.1 (API export route)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ANTES de cualquier import de los handlers ──────────────────────────

vi.mock("@/features/shared/middleware", () => ({
  requireAuth: vi.fn(),
  requireOrgAccess: vi.fn(),
  requireRole: vi.fn(),
  handleError: vi.fn((err: unknown) => {
    if (err != null && typeof err === "object" && "statusCode" in err) {
      const e = err as { message: string; statusCode: number };
      return Response.json({ error: e.message }, { status: e.statusCode });
    }
    return Response.json({ error: "Error interno" }, { status: 500 });
  }),
}));

// Mock del exporter + service (mismo barrel /server)
const FAKE_BUFFER = Buffer.from("FAKE_XLSX_CONTENT");
const mockServiceInstance = {
  listPurchasesByPeriod: vi.fn().mockResolvedValue([]),
};

vi.mock("@/features/accounting/iva-books/server", () => ({
  IvaBooksService: vi.fn().mockImplementation(function () {
    return mockServiceInstance;
  }),
  exportIvaBookExcel: vi.fn().mockResolvedValue(FAKE_BUFFER),
}));

// ── Imports después de los mocks ─────────────────────────────────────────────

import { requireAuth } from "@/features/shared/middleware";
vi.mock("@/features/organizations/server", () => ({
  requireOrgAccess: vi.fn(),
  requireRole: vi.fn(),
}));

import { requireOrgAccess, requireRole } from "@/features/organizations/server";

vi.mock("@/features/permissions/server", () => ({
  requirePermission: vi.fn(),
}));
import { requirePermission } from "@/features/permissions/server";

import { UnauthorizedError, ForbiddenError } from "@/features/shared/errors";

// ── Constantes ────────────────────────────────────────────────────────────────

const ORG_SLUG = "test-org";
const ORG_ID = "org-test-id";
const USER_ID = "user-test-id";
const PERIOD_ID = "period-2025-03";

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockServiceInstance.listPurchasesByPeriod.mockResolvedValue([]);
  vi.mocked(requireAuth).mockResolvedValue({ userId: USER_ID } as Awaited<ReturnType<typeof requireAuth>>);
  vi.mocked(requireOrgAccess).mockResolvedValue(ORG_ID);
  vi.mocked(requireRole).mockResolvedValue({ role: "admin" } as Awaited<ReturnType<typeof requireRole>>);
  vi.mocked(requirePermission).mockResolvedValue({
    session: { userId: USER_ID } as Awaited<ReturnType<typeof requireAuth>>,
    orgId: ORG_ID,
    role: "admin",
  } as Awaited<ReturnType<typeof requirePermission>>);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/organizations/[orgSlug]/iva-books/purchases/export", () => {
  it("retorna 200 con Content-Type xlsx correcto", async () => {
    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/purchases/export?periodId=${PERIOD_ID}`,
    );
    const res = await GET(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });

  it("retorna Content-Disposition con filename LibroCompras_{period}.xlsx", async () => {
    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/purchases/export?periodId=${PERIOD_ID}`,
    );
    const res = await GET(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    const disposition = res.headers.get("Content-Disposition");
    expect(disposition).not.toBeNull();
    expect(disposition).toMatch(/attachment/);
    expect(disposition).toMatch(/LibroCompras_/);
    expect(disposition).toMatch(/\.xlsx/);
  });

  it("el body de la respuesta no está vacío", async () => {
    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/purchases/export?periodId=${PERIOD_ID}`,
    );
    const res = await GET(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    const arrayBuffer = await res.arrayBuffer();
    expect(arrayBuffer.byteLength).toBeGreaterThan(0);
  });

  it("retorna 401 si no está autenticado", async () => {
    vi.mocked(requirePermission).mockRejectedValueOnce(new UnauthorizedError());

    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/purchases/export?periodId=${PERIOD_ID}`,
    );
    const res = await GET(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(401);
  });

  it("retorna 403 si no tiene acceso a la org", async () => {
    vi.mocked(requirePermission).mockRejectedValueOnce(new ForbiddenError());

    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/purchases/export?periodId=${PERIOD_ID}`,
    );
    const res = await GET(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(403);
  });

  it("acepta fiscalPeriodId como alias de periodId en query params", async () => {
    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/purchases/export?fiscalPeriodId=${PERIOD_ID}`,
    );
    const res = await GET(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(200);
  });
});
