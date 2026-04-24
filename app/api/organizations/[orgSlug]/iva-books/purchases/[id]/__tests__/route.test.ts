/**
 * Tests de las rutas API: Libro de Compras IVA — operaciones por id
 *
 * Cubre: GET /[id] (200, 404), PATCH /[id] (200, 400, 404), DELETE /[id] (204, 404)
 *
 * PR3 — Task 3.3
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
      const e = err as { message: string; code?: string; statusCode: number; details?: Record<string, unknown> };
      return Response.json(
        { error: e.message, code: e.code, ...(e.details ? { details: e.details } : {}) },
        { status: e.statusCode },
      );
    }
    return Response.json({ error: "Error interno del servidor" }, { status: 500 });
  }),
}));

const mockServiceInstance = {
  findPurchaseById: vi.fn(),
  updatePurchase: vi.fn(),
  voidPurchase: vi.fn(),
};

vi.mock("@/features/accounting/iva-books/server", () => ({
  IvaBooksService: vi.fn().mockImplementation(function () {
    return mockServiceInstance;
  }),
  IvaBooksRepository: vi.fn().mockImplementation(function () {
    return {};
  }),
}));

import { requireAuth } from "@/features/shared/middleware";
vi.mock("@/features/organizations/server", () => ({
  requireOrgAccess: vi.fn(),
  requireRole: vi.fn(),
}));

import { requireOrgAccess, requireRole } from "@/features/organizations/server";
import {
  UnauthorizedError,
  NotFoundError,
  ValidationError,
  LOCKED_EDIT_REQUIRES_JUSTIFICATION,
} from "@/features/shared/errors";

const D = (v: string | number) => new Prisma.Decimal(String(v));
const ZERO = D("0");
const TASA_IVA = D("0.1300");

const ORG_SLUG = "test-org";
const ORG_ID = "org-test-id";
const USER_ID = "user-test-id";
const PERIOD_ID = "period-test-id";
const ENTRY_ID = "entry-test-id";

function makePurchaseDTO(overrides = {}) {
  return {
    id: ENTRY_ID,
    organizationId: ORG_ID,
    fiscalPeriodId: PERIOD_ID,
    fechaFactura: "2025-03-15",
    nitProveedor: "1234567",
    razonSocial: "Proveedor Test",
    numeroFactura: "FAC-001",
    codigoAutorizacion: "AUTH-001",
    codigoControl: "",
    tipoCompra: 1,
    importeTotal: D("1000.00"),
    importeIce: ZERO,
    importeIehd: ZERO,
    importeIpj: ZERO,
    tasas: ZERO,
    otrosNoSujetos: ZERO,
    exentos: ZERO,
    tasaCero: ZERO,
    subtotal: D("1000.00"),
    dfIva: D("130.00"),
    codigoDescuentoAdicional: ZERO,
    importeGiftCard: ZERO,
    baseIvaSujetoCf: D("1000.00"),
    dfCfIva: D("130.00"),
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
});

// ── GET /[id] ────────────────────────────────────────────────────────────────

describe("GET /api/organizations/[orgSlug]/iva-books/purchases/[id]", () => {
  it("retorna 200 con la entrada si existe", async () => {
    const dto = makePurchaseDTO();
    mockServiceInstance.findPurchaseById.mockResolvedValue(dto);

    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/purchases/${ENTRY_ID}`,
    );
    const res = await GET(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, id: ENTRY_ID }),
    });

    expect(res.status).toBe(200);
    expect(mockServiceInstance.findPurchaseById).toHaveBeenCalledWith(ORG_ID, ENTRY_ID);
  });

  it("retorna 404 si la entrada no existe (service retorna null)", async () => {
    mockServiceInstance.findPurchaseById.mockResolvedValue(null);

    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/purchases/${ENTRY_ID}`,
    );
    const res = await GET(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, id: ENTRY_ID }),
    });

    expect(res.status).toBe(404);
  });

  it("retorna 401 sin auth", async () => {
    vi.mocked(requireAuth).mockRejectedValue(new UnauthorizedError());

    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/purchases/${ENTRY_ID}`,
    );
    const res = await GET(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, id: ENTRY_ID }),
    });

    expect(res.status).toBe(401);
  });
});

// ── PATCH /[id] ──────────────────────────────────────────────────────────────

describe("PATCH /api/organizations/[orgSlug]/iva-books/purchases/[id]", () => {
  it("retorna 200 con la entrada actualizada", async () => {
    const dto = makePurchaseDTO({ razonSocial: "Proveedor Actualizado" });
    mockServiceInstance.updatePurchase.mockResolvedValue(dto);

    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/purchases/${ENTRY_ID}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ razonSocial: "Proveedor Actualizado" }),
      },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, id: ENTRY_ID }),
    });

    expect(res.status).toBe(200);
    expect(mockServiceInstance.updatePurchase).toHaveBeenCalledWith(
      ORG_ID,
      USER_ID,
      ENTRY_ID,
      expect.objectContaining({ razonSocial: "Proveedor Actualizado" }),
    );
  });

  it("retorna 400 si el body tiene valores inválidos (Zod)", async () => {
    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/purchases/${ENTRY_ID}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importeTotal: "no-es-un-numero" }),
      },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, id: ENTRY_ID }),
    });

    expect(res.status).toBe(400);
  });

  it("retorna 404 si la entrada no existe", async () => {
    mockServiceInstance.updatePurchase.mockRejectedValue(
      new NotFoundError("Entrada de Libro de Compras"),
    );

    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/purchases/${ENTRY_ID}`,
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

  it("retorna 422 LOCKED_EDIT_REQUIRES_JUSTIFICATION con details.requiredMin cuando justificación es insuficiente", async () => {
    mockServiceInstance.updatePurchase.mockRejectedValue(
      new ValidationError(
        "Se requiere una justificación de al menos 50 caracteres para modificar un documento bloqueado en un período cerrado",
        LOCKED_EDIT_REQUIRES_JUSTIFICATION,
        { requiredMin: 50 },
      ),
    );

    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/purchases/${ENTRY_ID}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ razonSocial: "Actualización", justification: "corta" }),
      },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, id: ENTRY_ID }),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe(LOCKED_EDIT_REQUIRES_JUSTIFICATION);
    expect(body.details.requiredMin).toBe(50);
  });
});

// ── DELETE /[id] ─────────────────────────────────────────────────────────────

describe("DELETE /api/organizations/[orgSlug]/iva-books/purchases/[id]", () => {
  it("retorna 204 al anular (void) la entrada", async () => {
    const dto = makePurchaseDTO({ status: "VOIDED" });
    mockServiceInstance.voidPurchase.mockResolvedValue(dto);

    const { DELETE } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/purchases/${ENTRY_ID}`,
      { method: "DELETE" },
    );
    const res = await DELETE(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, id: ENTRY_ID }),
    });

    expect(res.status).toBe(204);
    expect(mockServiceInstance.voidPurchase).toHaveBeenCalledWith(ORG_ID, USER_ID, ENTRY_ID);
  });

  it("retorna 404 si la entrada no existe", async () => {
    mockServiceInstance.voidPurchase.mockRejectedValue(
      new NotFoundError("Entrada de Libro de Compras"),
    );

    const { DELETE } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/purchases/${ENTRY_ID}`,
      { method: "DELETE" },
    );
    const res = await DELETE(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, id: ENTRY_ID }),
    });

    expect(res.status).toBe(404);
  });
});
