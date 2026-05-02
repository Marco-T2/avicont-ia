/**
 * Tests de la ruta API: reactivate IvaSalesBook entry
 *
 * Cubre: PATCH 200 (reactivate + correlationId preserved), 404 (no existe),
 *        409 (ya está ACTIVE — IvaBookReactivateNonVoided guard), 401, 403.
 *
 * POC #11.0c A4-a Ciclo 1 RED — archivo nuevo dedicado (legacy NO tenía
 * test file para `sales/[id]/reactivate/route.ts`). RED honesty preventivo:
 * tests asertean hex spy `reactivateSale({ organizationId, userId, id })` que
 * la route legacy NO invoca (legacy invoca `service.reactivateSale(orgId,
 * userId, id)` positional). En GREEN cutover la route invoca hex spy →
 * assertions pasan.
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
  reactivateSale: vi.fn(),
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
  reactivateSale: vi.fn(),
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

describe("PATCH /api/organizations/[orgSlug]/iva-books/sales/[id]/reactivate", () => {
  it("retorna 200 con la entrada ACTIVE + correlationId preserved", async () => {
    const dto = makeSaleDTO({ status: "ACTIVE" });
    mockHexService.reactivateSale.mockResolvedValue({
      entry: dto,
      correlationId: "corr-reactivate-1",
    });

    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/sales/${ENTRY_ID}/reactivate`,
      { method: "PATCH" },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, id: ENTRY_ID }),
    });

    expect(res.status).toBe(200);
    expect(mockHexService.reactivateSale).toHaveBeenCalledWith({
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
    mockHexService.reactivateSale.mockRejectedValue(new IvaBookNotFound("sale"));

    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/sales/${ENTRY_ID}/reactivate`,
      { method: "PATCH" },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, id: ENTRY_ID }),
    });

    expect(res.status).toBe(404);
  });

  it("retorna 422 si la entrada ya está ACTIVE (IvaBookReactivateNonVoided guard idempotencia)", async () => {
    mockHexService.reactivateSale.mockRejectedValue(
      new IvaBookReactivateNonVoided("sale"),
    );

    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/sales/${ENTRY_ID}/reactivate`,
      { method: "PATCH" },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, id: ENTRY_ID }),
    });

    // IvaBookReactivateNonVoided extends ValidationError → statusCode 422
    expect(res.status).toBe(422);
  });

  it("retorna 401 sin auth", async () => {
    vi.mocked(requirePermission).mockRejectedValueOnce(new UnauthorizedError());

    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/sales/${ENTRY_ID}/reactivate`,
      { method: "PATCH" },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, id: ENTRY_ID }),
    });

    expect(res.status).toBe(401);
  });

  it("retorna 403 si no tiene acceso a la org", async () => {
    vi.mocked(requirePermission).mockRejectedValueOnce(new ForbiddenError());

    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/sales/${ENTRY_ID}/reactivate`,
      { method: "PATCH" },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, id: ENTRY_ID }),
    });

    expect(res.status).toBe(403);
  });
});
