/**
 * Tests de la ruta PATCH /[id]/void — Libro de Ventas IVA
 *
 * Cubre: 200 con status VOIDED, 404 si no existe, 401 sin auth.
 * CRÍTICO: void SOLO cambia status (lifecycle interno Avicont).
 *          estadoSIN NO se toca — es ortogonal (eje SIN independiente).
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
  voidSale: vi.fn(),
};

vi.mock("@/features/accounting/iva-books/iva-books.service", () => ({
  IvaBooksService: vi.fn().mockImplementation(function () {
    return mockServiceInstance;
  }),
}));

import {
  requireAuth,
  requireOrgAccess,
  requireRole,
} from "@/features/shared/middleware";
import { UnauthorizedError, NotFoundError } from "@/features/shared/errors";

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
    dfIva: D("230.09"),
    codigoDescuentoAdicional: ZERO,
    importeGiftCard: ZERO,
    baseIvaSujetoCf: D("2000.00"),
    dfCfIva: D("230.09"),
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
});

describe("PATCH /api/organizations/[orgSlug]/iva-books/sales/[id]/void", () => {
  it("retorna 200 con status=VOIDED, estadoSIN intacto (eje ortogonal)", async () => {
    const dto = makeVoidedSaleDTO();
    mockServiceInstance.voidSale.mockResolvedValue(dto);

    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/sales/${ENTRY_ID}/void`,
      { method: "PATCH" },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, id: ENTRY_ID }),
    });

    expect(res.status).toBe(200);
    expect(mockServiceInstance.voidSale).toHaveBeenCalledWith(ORG_ID, USER_ID, ENTRY_ID);

    const body = await res.json();
    expect(body.status).toBe("VOIDED");
    // estadoSIN NO cambia — eje ortogonal
    expect(body.estadoSIN).toBe("A");
  });

  it("retorna 404 si la entrada no existe", async () => {
    mockServiceInstance.voidSale.mockRejectedValue(
      new NotFoundError("Entrada de Libro de Ventas"),
    );

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
    vi.mocked(requireAuth).mockRejectedValue(new UnauthorizedError());

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
});
