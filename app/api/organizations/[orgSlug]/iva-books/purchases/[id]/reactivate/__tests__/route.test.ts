/**
 * Tests de la ruta PATCH /[id]/reactivate — Libro de Compras IVA
 *
 * T2.5 RED (REQ-B.3):
 *   (a) 200 + DTO cuando exitoso
 *   (b) 404 cuando NotFoundError
 *   (c) 409 cuando ConflictError (entrada ya ACTIVE)
 *   (d) 401 sin autenticación
 *   (e) 403 sin acceso a org / rol insuficiente
 *
 * Patrón Next.js 16 async params: { params: Promise<{ orgSlug, id }> }
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@/generated/prisma/client";

vi.mock("@/features/shared/middleware", () => ({
  requireAuth: vi.fn(),
  requireOrgAccess: vi.fn(),
  requireRole: vi.fn(),
  handleError: vi.fn((err: unknown) => {
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

const mockServiceInstance = {
  reactivatePurchase: vi.fn(),
};

vi.mock("@/features/accounting/iva-books/server", () => ({
  IvaBooksService: vi.fn().mockImplementation(function () {
    return mockServiceInstance;
  }),
  IvaBooksRepository: vi.fn().mockImplementation(function () {
    return {};
  }),
}));

import {
  requireAuth,
  requireOrgAccess,
  requireRole,
} from "@/features/shared/middleware";
import {
  UnauthorizedError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from "@/features/shared/errors";

const D = (v: string | number) => new Prisma.Decimal(String(v));
const ZERO = D("0");

const ORG_SLUG = "test-org";
const ORG_ID = "org-test-id";
const USER_ID = "user-test-id";
const PERIOD_ID = "period-test-id";
const ENTRY_ID = "entry-test-id";

function makeActivePurchaseDTO() {
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
    tasaIva: D("0.1300"),
    status: "ACTIVE" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(requireAuth).mockResolvedValue({ userId: USER_ID } as Awaited<ReturnType<typeof requireAuth>>);
  vi.mocked(requireOrgAccess).mockResolvedValue(ORG_ID);
  vi.mocked(requireRole).mockResolvedValue({ role: "admin" } as Awaited<ReturnType<typeof requireRole>>);
});

describe("PATCH /api/organizations/[orgSlug]/iva-books/purchases/[id]/reactivate", () => {
  it("T2.5-a: retorna 200 + DTO con status ACTIVE cuando exitoso", async () => {
    const dto = makeActivePurchaseDTO();
    mockServiceInstance.reactivatePurchase.mockResolvedValue(dto);

    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/purchases/${ENTRY_ID}/reactivate`,
      { method: "PATCH" },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, id: ENTRY_ID }),
    });

    expect(res.status).toBe(200);
    expect(mockServiceInstance.reactivatePurchase).toHaveBeenCalledWith(ORG_ID, USER_ID, ENTRY_ID);

    const body = await res.json();
    expect(body.status).toBe("ACTIVE");
  });

  it("T2.5-b: retorna 404 cuando NotFoundError", async () => {
    mockServiceInstance.reactivatePurchase.mockRejectedValue(
      new NotFoundError("Entrada de Libro de Compras"),
    );

    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/purchases/${ENTRY_ID}/reactivate`,
      { method: "PATCH" },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, id: ENTRY_ID }),
    });

    expect(res.status).toBe(404);
  });

  it("T2.5-c: retorna 409 cuando ConflictError (entrada ya ACTIVE)", async () => {
    mockServiceInstance.reactivatePurchase.mockRejectedValue(
      new ConflictError("La entrada ya está activa (status !== VOIDED)"),
    );

    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/purchases/${ENTRY_ID}/reactivate`,
      { method: "PATCH" },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, id: ENTRY_ID }),
    });

    expect(res.status).toBe(409);
  });

  it("T2.5-d: retorna 401 sin autenticación", async () => {
    vi.mocked(requireAuth).mockRejectedValue(new UnauthorizedError());

    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/purchases/${ENTRY_ID}/reactivate`,
      { method: "PATCH" },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, id: ENTRY_ID }),
    });

    expect(res.status).toBe(401);
  });

  it("T2.5-e: retorna 403 con rol insuficiente", async () => {
    vi.mocked(requireRole).mockRejectedValue(new ForbiddenError("Rol insuficiente"));

    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/purchases/${ENTRY_ID}/reactivate`,
      { method: "PATCH" },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, id: ENTRY_ID }),
    });

    expect(res.status).toBe(403);
  });
});
