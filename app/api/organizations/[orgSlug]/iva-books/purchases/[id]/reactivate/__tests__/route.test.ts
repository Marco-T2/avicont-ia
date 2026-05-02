/**
 * Tests de la ruta API: reactivate IvaPurchaseBook entry
 *
 * Cubre: PATCH 200 (reactivate + correlationId preserved), 404 (no existe),
 *        422 (ya está ACTIVE — IvaBookReactivateNonVoided guard, ValidationError),
 *        401, 403.
 *
 * POC #11.0c A4-a Ciclo 2 RED — assertions cutoveradas a hex composition-root
 * (`makeIvaBookService`). Tests asertean hex spy `reactivatePurchase({
 * organizationId, userId, id })` que la route legacy NO invoca (legacy invoca
 * `service.reactivatePurchase(orgId, userId, id)` positional). En GREEN cutover
 * la route invoca hex spy → assertions pasan.
 *
 * 422 reactivate correctness fix heredado C1 (pre-aprobado): legacy retornaba
 * 409 ConflictError; hex throws `IvaBookReactivateNonVoided` (extends
 * `ValidationError` cuya `statusCode = 422`). NO §13 — error class statusCode
 * mismatch en assumption RED. JSDoc route 409→422 alineado con realidad
 * inheritance.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@/generated/prisma/client";

vi.mock("@/features/shared/middleware", () => ({
  requireAuth: vi.fn(),
  requireOrgAccess: vi.fn(),
  requireRole: vi.fn(),
  handleError: vi.fn((err: unknown) => {
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
  reactivatePurchase: vi.fn(),
};

vi.mock("@/features/accounting/iva-books/server", () => ({
  IvaBooksService: vi.fn().mockImplementation(function () {
    return mockLegacyServiceInstance;
  }),
  IvaBooksRepository: vi.fn().mockImplementation(function () {
    return {};
  }),
}));

const mockHexService = {
  reactivatePurchase: vi.fn(),
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

import { UnauthorizedError, ForbiddenError } from "@/features/shared/errors";
import {
  IvaBookNotFound,
  IvaBookReactivateNonVoided,
} from "@/modules/iva-books/domain/errors/iva-book-errors";

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
  vi.mocked(requirePermission).mockResolvedValue({
    session: { userId: USER_ID } as Awaited<ReturnType<typeof requireAuth>>,
    orgId: ORG_ID,
    role: "admin",
  } as Awaited<ReturnType<typeof requirePermission>>);
});

describe("PATCH /api/organizations/[orgSlug]/iva-books/purchases/[id]/reactivate", () => {
  it("retorna 200 con la entrada ACTIVE + correlationId preserved", async () => {
    const dto = makeActivePurchaseDTO();
    mockHexService.reactivatePurchase.mockResolvedValue({
      entry: dto,
      correlationId: "corr-reactivate-1",
    });

    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/purchases/${ENTRY_ID}/reactivate`,
      { method: "PATCH" },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, id: ENTRY_ID }),
    });

    expect(res.status).toBe(200);
    expect(mockHexService.reactivatePurchase).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      userId: USER_ID,
      id: ENTRY_ID,
    });

    const body = await res.json();
    expect(body.correlationId).toBeUndefined();
    expect(body.id).toBe(ENTRY_ID);
    expect(body.status).toBe("ACTIVE");
  });

  it("retorna 404 si la entrada no existe (hex throws IvaBookNotFound)", async () => {
    mockHexService.reactivatePurchase.mockRejectedValue(new IvaBookNotFound("purchase"));

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

  it("retorna 422 si la entrada ya está ACTIVE (IvaBookReactivateNonVoided guard idempotencia)", async () => {
    mockHexService.reactivatePurchase.mockRejectedValue(
      new IvaBookReactivateNonVoided("purchase"),
    );

    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/purchases/${ENTRY_ID}/reactivate`,
      { method: "PATCH" },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, id: ENTRY_ID }),
    });

    // IvaBookReactivateNonVoided extends ValidationError → statusCode 422
    expect(res.status).toBe(422);
  });

  it("retorna 401 sin autenticación", async () => {
    vi.mocked(requirePermission).mockRejectedValueOnce(new UnauthorizedError());

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

  it("retorna 403 con rol insuficiente", async () => {
    vi.mocked(requirePermission).mockRejectedValueOnce(new ForbiddenError("Rol insuficiente"));

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
