/**
 * Tests de las rutas API: Libro de Ventas IVA
 *
 * Estrategia: servicio y middleware mockeados — no toca la DB.
 * Cubre: GET 200, POST 201, POST 400 (Zod, incluyendo estadoSIN inválido),
 *        POST 401, POST 403, estadoSIN en payload validado.
 *
 * PR3 — Task 3.2
 *
 * POC #11.0c A4-a Ciclo 1 RED — assertions cutoveradas a hex composition-root
 * (`makeIvaBookService`). Legacy mock (`IvaBooksService` en
 * `@/features/accounting/iva-books/server`) preservado para que la route legacy
 * intacta NO crashee en RED. Failure mode RED declarado: hex spy
 * (`regenerateSale`/`listSalesByPeriod`) 0 calls porque la route aún invoca
 * `service.createSale`/`service.listSalesByPeriod` legacy. En GREEN cutover
 * la route invoca hex spies → assertions pasan.
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
  createSale: vi.fn(),
  listSalesByPeriod: vi.fn().mockResolvedValue([]),
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
  regenerateSale: vi.fn(),
  listSalesByPeriod: vi.fn().mockResolvedValue([]),
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

import { UnauthorizedError, ForbiddenError, ConflictError } from "@/features/shared/errors";

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

const validCreateBody = {
  fechaFactura: "2025-03-15",
  nitCliente: "7654321",
  razonSocial: "Cliente Test",
  numeroFactura: "FAC-SALE-001",
  codigoAutorizacion: "AUTH-SALE-001",
  codigoControl: "",
  estadoSIN: "A",
  fiscalPeriodId: PERIOD_ID,
  importeTotal: "2000.00",
  importeIce: "0",
  importeIehd: "0",
  importeIpj: "0",
  tasas: "0",
  otrosNoSujetos: "0",
  exentos: "0",
  tasaCero: "0",
  subtotal: "0",
  dfIva: "0",
  codigoDescuentoAdicional: "0",
  importeGiftCard: "0",
  baseIvaSujetoCf: "0",
  dfCfIva: "0",
  tasaIva: "0.1300",
};

beforeEach(() => {
  vi.clearAllMocks();

  mockLegacyServiceInstance.listSalesByPeriod.mockResolvedValue([]);
  mockHexService.listSalesByPeriod.mockResolvedValue([]);

  vi.mocked(requireAuth).mockResolvedValue({ userId: USER_ID } as Awaited<ReturnType<typeof requireAuth>>);
  vi.mocked(requireOrgAccess).mockResolvedValue(ORG_ID);
  vi.mocked(requireRole).mockResolvedValue({ role: "admin" } as Awaited<ReturnType<typeof requireRole>>);
  vi.mocked(requirePermission).mockResolvedValue({
    session: { userId: USER_ID } as Awaited<ReturnType<typeof requireAuth>>,
    orgId: ORG_ID,
    role: "admin",
  } as Awaited<ReturnType<typeof requirePermission>>);
});

// ── GET /sales ────────────────────────────────────────────────────────────────

describe("GET /api/organizations/[orgSlug]/iva-books/sales", () => {
  it("retorna 200 con lista vacía cuando no hay entradas", async () => {
    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/sales`,
    );
    const res = await GET(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it("filtra por fiscalPeriodId si se pasa en query", async () => {
    const entry = makeSaleDTO();
    mockHexService.listSalesByPeriod.mockResolvedValue([entry]);

    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/sales?fiscalPeriodId=${PERIOD_ID}`,
    );
    const res = await GET(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(200);
    expect(mockHexService.listSalesByPeriod).toHaveBeenCalledWith(
      ORG_ID,
      expect.objectContaining({ fiscalPeriodId: PERIOD_ID }),
    );
  });

  it("retorna 401 si no está autenticado", async () => {
    vi.mocked(requirePermission).mockRejectedValueOnce(new UnauthorizedError());

    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/sales`,
    );
    const res = await GET(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(401);
  });

  it("retorna 403 si el usuario no tiene acceso a la org", async () => {
    vi.mocked(requirePermission).mockRejectedValueOnce(new ForbiddenError());

    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/sales`,
    );
    const res = await GET(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(403);
  });
});

// ── POST /sales ───────────────────────────────────────────────────────────────

describe("POST /api/organizations/[orgSlug]/iva-books/sales", () => {
  it("retorna 201 con la entrada creada cuando el body es válido", async () => {
    const dto = makeSaleDTO();
    mockHexService.regenerateSale.mockResolvedValue({
      entry: dto,
      correlationId: "corr-1",
    });

    const { POST } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/sales`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validCreateBody),
      },
    );
    const res = await POST(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(201);
    expect(mockHexService.regenerateSale).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        userId: USER_ID,
        fiscalPeriodId: PERIOD_ID,
        fechaFactura: expect.any(Date),
        nitCliente: validCreateBody.nitCliente,
        razonSocial: validCreateBody.razonSocial,
        numeroFactura: validCreateBody.numeroFactura,
        codigoAutorizacion: validCreateBody.codigoAutorizacion,
        codigoControl: "",
        estadoSIN: "A",
        inputs: expect.any(Object),
      }),
    );

    const body = await res.json();
    expect(body.correlationId).toBeUndefined();
  });

  it("retorna 400 cuando estadoSIN tiene valor inválido (fuera de A/V/C/L)", async () => {
    const { POST } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/sales`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validCreateBody, estadoSIN: "X" }),
      },
    );
    const res = await POST(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Datos inválidos");
  });

  it("retorna 400 cuando faltan campos requeridos (Zod)", async () => {
    const { POST } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/sales`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ razonSocial: "Incompleto" }),
      },
    );
    const res = await POST(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(400);
  });

  it("retorna 400 cuando estadoSIN está ausente (campo obligatorio en ventas)", async () => {
    const { estadoSIN: _omitted, ...bodyWithoutEstado } = validCreateBody;
    const { POST } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/sales`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyWithoutEstado),
      },
    );
    const res = await POST(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(400);
  });

  it("retorna 409 cuando hay violación de restricción única", async () => {
    mockHexService.regenerateSale.mockRejectedValue(
      new ConflictError("Entrada de Libro de Ventas con los mismos datos ya existe"),
    );

    const { POST } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/sales`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validCreateBody),
      },
    );
    const res = await POST(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(409);
  });

  it("retorna 401 si no está autenticado", async () => {
    vi.mocked(requirePermission).mockRejectedValueOnce(new UnauthorizedError());

    const { POST } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/sales`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validCreateBody),
      },
    );
    const res = await POST(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(401);
  });

  it("retorna 403 si accede a org incorrecta", async () => {
    vi.mocked(requirePermission).mockRejectedValueOnce(new ForbiddenError());

    const { POST } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/sales`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validCreateBody),
      },
    );
    const res = await POST(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(403);
  });
});
