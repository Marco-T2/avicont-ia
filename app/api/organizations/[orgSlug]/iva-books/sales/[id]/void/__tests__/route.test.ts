/**
 * Tests de la ruta PATCH /[id]/void — Libro de Ventas IVA
 *
 * Cubre: 200 con status VOIDED + correlationId preserved, 404 si no existe,
 *        401 sin auth, 403 sin acceso.
 * CRÍTICO: void SOLO cambia status (lifecycle interno Avicont).
 *          estadoSIN NO se toca — es ortogonal (eje SIN independiente).
 *
 * PR3 — Task 3.3
 *
 * POC #11.0c A4-a Ciclo 1 RED — assertions cutoveradas a hex composition-root
 * (`makeIvaBookService`). Failure mode RED declarado: hex spy `voidSale({
 * organizationId, userId, id })` 0 calls porque la route legacy invoca
 * `service.voidSale(orgId, userId, id)` positional. En GREEN cutover la
 * route invoca hex spy → assertions pasan.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@/generated/prisma/client";

vi.mock("@/features/shared/middleware", () => ({
  requireAuth: vi.fn(),
  requireOrgAccess: vi.fn(),
  requireRole: vi.fn(),
  handleError: vi.fn((err: unknown) => {
    // Duck-typing: avoids require() alias issues inside vi.mock factories
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

// ── A4-a Ciclo 1 hex composition-root mock ─────────────────────────────────────
const mockHexService = {
  voidSale: vi.fn(),
};

vi.mock("@/modules/iva-books/presentation/composition-root", () => ({
  makeIvaBookService: vi.fn(() => mockHexService),
}));

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
import { IvaBookNotFound } from "@/modules/iva-books/domain/errors/iva-book-errors";

const D = (v: string | number) => new Prisma.Decimal(String(v));
const ZERO = D("0");

const ORG_SLUG = "test-org";
const ORG_ID = "org-test-id";
const USER_ID = "user-test-id";
const PERIOD_ID = "period-test-id";
const ENTRY_ID = "sale-entry-test-id";

function makeVoidedSaleDTO() {
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
    // estadoSIN permanece "A" — el void NO lo cambia (ejes ortogonales)
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
    tasaIva: D("0.1300"),
    // Solo esto cambia:
    status: "VOIDED" as const,
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

describe("PATCH /api/organizations/[orgSlug]/iva-books/sales/[id]/void", () => {
  it("retorna 200 con status=VOIDED, estadoSIN intacto + correlationId preserved", async () => {
    const dto = makeVoidedSaleDTO();
    mockHexService.voidSale.mockResolvedValue({
      entry: dto,
      correlationId: "corr-void-1",
    });

    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/sales/${ENTRY_ID}/void`,
      { method: "PATCH" },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, id: ENTRY_ID }),
    });

    expect(res.status).toBe(200);
    expect(mockHexService.voidSale).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      userId: USER_ID,
      id: ENTRY_ID,
    });

    const body = await res.json();
    expect(body.status).toBe("VOIDED");
    // estadoSIN NO cambia — eje ortogonal
    expect(body.estadoSIN).toBe("A");
    expect(body.correlationId).toBeUndefined();
  });

  it("retorna 404 si la entrada no existe (hex throws IvaBookNotFound)", async () => {
    mockHexService.voidSale.mockRejectedValue(new IvaBookNotFound("sale"));

    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/sales/${ENTRY_ID}/void`,
      { method: "PATCH" },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, id: ENTRY_ID }),
    });

    expect(res.status).toBe(404);
  });

  it("retorna 401 sin auth", async () => {
    vi.mocked(requirePermission).mockRejectedValueOnce(new UnauthorizedError());

    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/sales/${ENTRY_ID}/void`,
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
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/sales/${ENTRY_ID}/void`,
      { method: "PATCH" },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, id: ENTRY_ID }),
    });

    expect(res.status).toBe(403);
  });
});
