/**
 * Tests de las rutas API: Libro de Compras IVA
 *
 * Estrategia: servicio y middleware mockeados — no toca la DB.
 * Cubre: GET 200, POST 201, POST 400 (Zod), POST 401 (sin auth), POST 403 (wrong org).
 *
 * PR3 — Tasks 3.1
 *
 * POC #11.0c A4-a Ciclo 2 RED — assertions cutoveradas a hex composition-root
 * (`makeIvaBookService`). Legacy mock (`IvaBooksService` en
 * `@/features/accounting/iva-books/server`) preservado para que la route legacy
 * intacta NO crashee en RED. Failure mode RED declarado: hex spy
 * (`regeneratePurchase`/`listPurchasesByPeriod`) 0 calls porque la route aún
 * invoca `service.createPurchase`/`service.listPurchasesByPeriod` legacy. En
 * GREEN cutover la route invoca hex spies → assertions pasan.
 *
 * **POC siguiente A2-C2 update**: legacy mock keys `IvaBooksService` /
 * `IvaBooksRepository` dropeadas del vi.mock factory (Cat A surgical cleanup,
 * engram `poc-siguiente/a2/c2/closed`). POC siguiente A2-C3 deleted la legacy
 * class entirely — JSDoc historical reference preservada (engram
 * `poc-siguiente/a2/c3/closed`).
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

// ── A4-a Ciclo 2 hex composition-root mock ─────────────────────────────────────
const mockHexService = {
  regeneratePurchase: vi.fn(),
  listPurchasesByPeriod: vi.fn().mockResolvedValue([]),
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
import { UnauthorizedError, ForbiddenError, ConflictError } from "@/features/shared/errors";

vi.mock("@/features/permissions/server", () => ({
  requirePermission: vi.fn(),
}));
import { requirePermission } from "@/features/permissions/server";

// ── Helpers ──────────────────────────────────────────────────────────────────

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

const validCreateBody = {
  fechaFactura: "2025-03-15",
  nitProveedor: "1234567",
  razonSocial: "Proveedor Test",
  numeroFactura: "FAC-001",
  codigoAutorizacion: "AUTH-001",
  codigoControl: "",
  tipoCompra: 1,
  fiscalPeriodId: PERIOD_ID,
  importeTotal: "1000.00",
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

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // Restablecer el comportamiento por defecto después de clearAllMocks
  mockHexService.listPurchasesByPeriod.mockResolvedValue([]);

  vi.mocked(requireAuth).mockResolvedValue({ userId: USER_ID } as Awaited<ReturnType<typeof requireAuth>>);
  vi.mocked(requireOrgAccess).mockResolvedValue(ORG_ID);
  vi.mocked(requireRole).mockResolvedValue({ role: "admin" } as Awaited<ReturnType<typeof requireRole>>);
  vi.mocked(requirePermission).mockResolvedValue({
    session: { userId: USER_ID } as Awaited<ReturnType<typeof requireAuth>>,
    orgId: ORG_ID,
    role: "admin",
  } as Awaited<ReturnType<typeof requirePermission>>);
});

// ── Tests: GET /purchases ─────────────────────────────────────────────────────

describe("GET /api/organizations/[orgSlug]/iva-books/purchases", () => {
  it("retorna 200 con lista vacía cuando no hay entradas", async () => {
    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/purchases`,
    );
    const res = await GET(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(0);
    expect(mockHexService.listPurchasesByPeriod).toHaveBeenCalled();
  });

  it("filtra por fiscalPeriodId si se pasa en query", async () => {
    const entry = makePurchaseDTO();
    mockHexService.listPurchasesByPeriod.mockResolvedValue([entry]);

    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/purchases?fiscalPeriodId=${PERIOD_ID}`,
    );
    const res = await GET(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(200);
    expect(mockHexService.listPurchasesByPeriod).toHaveBeenCalledWith(
      ORG_ID,
      expect.objectContaining({ fiscalPeriodId: PERIOD_ID }),
    );
  });

  it("retorna 401 si no está autenticado", async () => {
    vi.mocked(requirePermission).mockRejectedValueOnce(new UnauthorizedError());

    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/purchases`,
    );
    const res = await GET(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(401);
  });

  it("retorna 403 si el usuario no tiene acceso a la org", async () => {
    vi.mocked(requirePermission).mockRejectedValueOnce(new ForbiddenError());

    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/purchases`,
    );
    const res = await GET(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(403);
  });
});

// ── Tests: POST /purchases ────────────────────────────────────────────────────

describe("POST /api/organizations/[orgSlug]/iva-books/purchases", () => {
  it("retorna 201 con la entrada creada + correlationId preserved", async () => {
    const dto = makePurchaseDTO();
    mockHexService.regeneratePurchase.mockResolvedValue({
      entry: dto,
      correlationId: "corr-regenerate-1",
    });

    const { POST } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/purchases`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validCreateBody),
      },
    );
    const res = await POST(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(201);
    expect(mockHexService.regeneratePurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG_ID,
        userId: USER_ID,
        fiscalPeriodId: PERIOD_ID,
        nitProveedor: "1234567",
        tipoCompra: 1,
      }),
    );

    const body = await res.json();
    expect(body.correlationId).toBeUndefined();
  });

  it("retorna 400 cuando faltan campos requeridos (Zod)", async () => {
    const { POST } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/purchases`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ razonSocial: "Incompleto" }),
      },
    );
    const res = await POST(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Datos inválidos");
  });

  it("retorna 409 cuando hay violación de restricción única", async () => {
    mockHexService.regeneratePurchase.mockRejectedValue(
      new ConflictError("Entrada de Libro de Compras con los mismos datos ya existe"),
    );

    const { POST } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/purchases`,
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
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/purchases`,
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
      `http://localhost/api/organizations/${ORG_SLUG}/iva-books/purchases`,
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
