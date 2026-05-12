/**
 * Tests de la ruta de exportación: Libro de Ventas IVA → XLSX
 *
 * Estrategia: service y middleware mockeados — no toca la DB ni genera
 * un XLSX real (el exporter también está mockeado para velocidad).
 *
 * Cubre:
 * - GET 200: Content-Type y Content-Disposition correctos, body no vacío
 * - GET 401: sin sesión Clerk
 * - GET 403: sin acceso a la org
 *
 * PR5 — Task 5.1 (API export route — sales)
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

// POC #11.0c A4-c C2 GREEN coupled mock swap: route cutover hex
// `makeIvaBookService` + entriesToDto mapper. Mock split:
// - hex root mock: `makeIvaBookService` retorna instance mock con
//   `listSalesByPeriod` returning entity[] (mock empty array satisface
//   batch wrapper map identity sin mapper transform real).
// - legacy server mock preserva `exportIvaBookExcel` (XLSX exporter
//   no migrated) — split de mocks vs C1 single mock.
const FAKE_BUFFER = Buffer.from("FAKE_XLSX_CONTENT");
const mockServiceInstance = {
  listSalesByPeriod: vi.fn().mockResolvedValue([]),
};

vi.mock("@/modules/iva-books/presentation/composition-root", () => ({
  makeIvaBookService: vi.fn(() => mockServiceInstance),
}));

vi.mock("@/features/accounting/iva-books/server", () => ({
  exportIvaBookExcel: vi.fn().mockResolvedValue(FAKE_BUFFER),
}));

// ── Imports después de los mocks ─────────────────────────────────────────────

import { requireAuth } from "@/features/shared/middleware";
vi.mock("@/modules/organizations/presentation/server", () => ({
  requireOrgAccess: vi.fn(),
  requireRole: vi.fn(),
}));

import { requireOrgAccess, requireRole } from "@/modules/organizations/presentation/server";

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
  mockServiceInstance.listSalesByPeriod.mockResolvedValue([]);
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

describe("GET /api/organizations/[orgSlug]/iva-books/sales/export", () => {
  it("retorna 200 con Content-Type xlsx correcto", async () => {
    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/sales/export?periodId=${PERIOD_ID}`,
    );
    const res = await GET(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });

  it("retorna Content-Disposition con filename LibroVentas_{period}.xlsx", async () => {
    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/sales/export?periodId=${PERIOD_ID}`,
    );
    const res = await GET(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    const disposition = res.headers.get("Content-Disposition");
    expect(disposition).not.toBeNull();
    expect(disposition).toMatch(/attachment/);
    expect(disposition).toMatch(/LibroVentas_/);
    expect(disposition).toMatch(/\.xlsx/);
  });

  it("el body de la respuesta no está vacío", async () => {
    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/sales/export?periodId=${PERIOD_ID}`,
    );
    const res = await GET(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    const arrayBuffer = await res.arrayBuffer();
    expect(arrayBuffer.byteLength).toBeGreaterThan(0);
  });

  it("retorna 401 si no está autenticado", async () => {
    vi.mocked(requirePermission).mockRejectedValueOnce(new UnauthorizedError());

    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/sales/export?periodId=${PERIOD_ID}`,
    );
    const res = await GET(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(401);
  });

  it("retorna 403 si no tiene acceso a la org", async () => {
    vi.mocked(requirePermission).mockRejectedValueOnce(new ForbiddenError());

    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/sales/export?periodId=${PERIOD_ID}`,
    );
    const res = await GET(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(403);
  });

  it("acepta fiscalPeriodId como alias de periodId en query params", async () => {
    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/sales/export?fiscalPeriodId=${PERIOD_ID}`,
    );
    const res = await GET(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(200);
  });
});
