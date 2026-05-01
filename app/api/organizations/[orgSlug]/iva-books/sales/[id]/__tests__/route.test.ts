/**
 * Tests de las rutas API: Libro de Ventas IVA — operaciones por id
 *
 * Cubre: GET /[id] (200, 404), PATCH /[id] (200, 400, 404), DELETE /[id] (204, 404)
 *
 * PR3 — Task 3.3
 *
 * POC #11.0c A4-a Ciclo 1 RED — assertions cutoveradas a hex composition-root
 * (`makeIvaBookService`). GET cutover: legacy `findSaleById` retorna null →
 * route hace manual `if (!entry) throw NotFoundError`; hex `getSaleById` throws
 * `IvaBookNotFound("sale")` directo (drop manual throw). DELETE cutover: extract
 * `entry` del `{entry, correlationId}` hex + spread §13 preserve correlationId.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@/generated/prisma/client";

vi.mock("@/features/shared/middleware", () => ({
  requireAuth: vi.fn(),
  requireOrgAccess: vi.fn(),
  requireRole: vi.fn(),
  handleError: vi.fn((err: unknown) => {
    // Duck-typing: avoids require() alias issues inside vi.mock factories
    if (err != null && typeof err === "object" && "flatten" in err && typeof (err as Record<string, unknown>).flatten === "function") {
      return Response.json(
        { error: "Datos inválidos", details: (err as { flatten: () => unknown }).flatten() },
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
    return Response.json({ error: "Error interno del servidor" }, { status: 500 });
  }),
}));

const mockLegacyServiceInstance = {
  findSaleById: vi.fn(),
  updateSale: vi.fn(),
  voidSale: vi.fn(),
};

vi.mock("@/features/accounting/iva-books/server", () => ({
  IvaBooksService: vi.fn().mockImplementation(function () {
    return mockLegacyServiceInstance;
  }),
  IvaBooksRepository: vi.fn().mockImplementation(function () {
    return {};
  }),
}));

// ── A4-a Ciclo 1 hex composition-root mock ─────────────────────────────────────
const mockHexService = {
  getSaleById: vi.fn(),
  recomputeSale: vi.fn(),
  voidSale: vi.fn(),
};

vi.mock("@/modules/iva-books/presentation/composition-root", () => ({
  makeIvaBookService: vi.fn(() => mockHexService),
}));

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

import { UnauthorizedError } from "@/features/shared/errors";
import { IvaBookNotFound } from "@/modules/iva-books/domain/errors/iva-book-errors";

const D = (v: string | number) => new Prisma.Decimal(String(v));
const ZERO = D("0");
const TASA_IVA = D("0.1300");

const ORG_SLUG = "test-org";
const ORG_ID = "org-test-id";
const USER_ID = "user-test-id";
const PERIOD_ID = "period-test-id";
const ENTRY_ID = "sale-entry-test-id";

function makeSaleDTO(overrides = {}) {
  return {
    id: ENTRY_ID,
    organizationId: ORG_ID,
    fiscalPeriodId: PERIOD_ID,
    fechaFactura: "2025-03-15",
    nitCliente: "7654321",
    razonSocial: "Cliente Test",
    numeroFactura: "FAC-SALE-001",
    codigoAutorizacion: "AUTH-SALE-001",
    codigoControl: "",
    estadoSIN: "A" as const,
    importeTotal: D("2000.00"),
    importeIce: ZERO,
    importeIehd: ZERO,
    importeIpj: ZERO,
    tasas: ZERO,
    otrosNoSujetos: ZERO,
    exentos: ZERO,
    tasaCero: ZERO,
    subtotal: D("2000.00"),
    dfIva: D("260.00"),
    codigoDescuentoAdicional: ZERO,
    importeGiftCard: ZERO,
    baseIvaSujetoCf: D("2000.00"),
    dfCfIva: D("260.00"),
    tasaIva: TASA_IVA,
    status: "ACTIVE" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(requireAuth).mockResolvedValue({ userId: USER_ID } as Awaited<ReturnType<typeof requireAuth>>);
  vi.mocked(requireOrgAccess).mockResolvedValue(ORG_ID);
  vi.mocked(requireRole).mockResolvedValue({ role: "admin" } as Awaited<ReturnType<typeof requireRole>>);
  vi.mocked(requirePermission).mockResolvedValue({
    session: { userId: USER_ID } as Awaited<ReturnType<typeof requireAuth>>,
    orgId: ORG_ID,
    role: "admin",
  } as Awaited<ReturnType<typeof requirePermission>>);
});

// ── GET /[id] ────────────────────────────────────────────────────────────────

describe("GET /api/organizations/[orgSlug]/iva-books/sales/[id]", () => {
  it("retorna 200 con la entrada si existe", async () => {
    const dto = makeSaleDTO();
    mockHexService.getSaleById.mockResolvedValue(dto);

    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/sales/${ENTRY_ID}`,
    );
    const res = await GET(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, id: ENTRY_ID }),
    });

    expect(res.status).toBe(200);
    expect(mockHexService.getSaleById).toHaveBeenCalledWith(ORG_ID, ENTRY_ID);
  });

  it("retorna 404 si la entrada no existe (hex throws IvaBookNotFound)", async () => {
    mockHexService.getSaleById.mockRejectedValue(new IvaBookNotFound("sale"));

    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/sales/${ENTRY_ID}`,
    );
    const res = await GET(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, id: ENTRY_ID }),
    });

    expect(res.status).toBe(404);
  });

  it("retorna 401 sin auth", async () => {
    vi.mocked(requirePermission).mockRejectedValueOnce(new UnauthorizedError());

    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/sales/${ENTRY_ID}`,
    );
    const res = await GET(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, id: ENTRY_ID }),
    });

    expect(res.status).toBe(401);
  });
});

// ── PATCH /[id] ──────────────────────────────────────────────────────────────

describe("PATCH /api/organizations/[orgSlug]/iva-books/sales/[id]", () => {
  it("retorna 200 con la entrada actualizada + correlationId preserved", async () => {
    const dto = makeSaleDTO({ razonSocial: "Cliente Actualizado" });
    mockHexService.recomputeSale.mockResolvedValue({
      entry: dto,
      correlationId: "corr-recompute-1",
    });

    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/sales/${ENTRY_ID}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ razonSocial: "Cliente Actualizado" }),
      },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, id: ENTRY_ID }),
    });

    expect(res.status).toBe(200);
    expect(mockHexService.recomputeSale).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        userId: USER_ID,
        id: ENTRY_ID,
        razonSocial: "Cliente Actualizado",
      }),
    );

    // §13 correlationId leak preserved
    const body = await res.json();
    expect(body.correlationId).toBe("corr-recompute-1");
  });

  it("retorna 400 si estadoSIN tiene valor inválido en PATCH", async () => {
    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/sales/${ENTRY_ID}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estadoSIN: "Z" }),
      },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, id: ENTRY_ID }),
    });

    expect(res.status).toBe(400);
  });

  it("retorna 404 si la entrada no existe (hex throws IvaBookNotFound)", async () => {
    mockHexService.recomputeSale.mockRejectedValue(new IvaBookNotFound("sale"));

    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/sales/${ENTRY_ID}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ razonSocial: "Nuevo Nombre" }),
      },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, id: ENTRY_ID }),
    });

    expect(res.status).toBe(404);
  });
});

// ── DELETE /[id] ─────────────────────────────────────────────────────────────

describe("DELETE /api/organizations/[orgSlug]/iva-books/sales/[id]", () => {
  it("retorna 204 al anular (void) la entrada", async () => {
    const dto = makeSaleDTO({ status: "VOIDED" });
    mockHexService.voidSale.mockResolvedValue({
      entry: dto,
      correlationId: "corr-void-delete-1",
    });

    const { DELETE } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/sales/${ENTRY_ID}`,
      { method: "DELETE" },
    );
    const res = await DELETE(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, id: ENTRY_ID }),
    });

    expect(res.status).toBe(204);
    expect(mockHexService.voidSale).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      userId: USER_ID,
      id: ENTRY_ID,
    });
  });

  it("retorna 404 si la entrada no existe (hex throws IvaBookNotFound)", async () => {
    mockHexService.voidSale.mockRejectedValue(new IvaBookNotFound("sale"));

    const { DELETE } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/sales/${ENTRY_ID}`,
      { method: "DELETE" },
    );
    const res = await DELETE(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, id: ENTRY_ID }),
    });

    expect(res.status).toBe(404);
  });
});
