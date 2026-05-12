/**
 * PR2 — Tasks 2.1–2.5 (RED → GREEN): Route integration tests.
 *
 * GET /api/organizations/[orgSlug]/dispatches-hub
 *
 * Covers: REQ-1 (200 merged result), REQ-3 (type param), REQ-4 (date params),
 *         REQ-5 (status param), REQ-9 (auth/role gates), Zod 400 on bad params.
 *
 * Mock pattern: duck-typing inside vi.mock factories — no require() path aliases.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Middleware mock ───────────────────────────────────────────────────────────

vi.mock("@/features/shared/middleware", () => ({
  requireAuth: vi.fn(),
  requireOrgAccess: vi.fn(),
  requireRole: vi.fn(),
  handleError: vi.fn((err: unknown) => {
    // Duck-typing: ZodError has a flatten() method
    if (
      err != null &&
      typeof err === "object" &&
      "flatten" in err &&
      typeof (err as Record<string, unknown>).flatten === "function"
    ) {
      return Response.json(
        { error: "Datos inválidos", details: (err as { flatten: () => unknown }).flatten() },
        { status: 400 },
      );
    }
    // AppError-style objects carry statusCode
    if (err != null && typeof err === "object" && "statusCode" in err) {
      const e = err as { message: string; code?: string; statusCode: number };
      return Response.json({ error: e.message, code: e.code }, { status: e.statusCode });
    }
    return Response.json({ error: "Error interno del servidor" }, { status: 500 });
  }),
}));

// ── permissions.server mock (PR3.1 — resource-nav-mapping-fix) ───────────────
// The route calls requirePermission(resource, action, orgSlug) directly.
// We mock it so tests can assert the exact resource string passed to the gate.

vi.mock("@/features/permissions/server", () => ({
  requirePermission: vi.fn(),
}));

// ── HubService mock ───────────────────────────────────────────────────────────

const mockListHub = vi.fn();

vi.mock("@/modules/dispatch/presentation/server", () => ({
  HubService: vi.fn().mockImplementation(function () {
    return { listHub: mockListHub };
  }),
  // These are only imported for type information — stub them so the import resolves
  SaleServiceForHub: undefined,
  DispatchServiceForHub: undefined,
}));

// ── SaleService / DispatchService mocks (constructor deps) ───────────────────

// vi.mock("@/features/sale/sale.service") REMOVED en A3-C7 GREEN (mock_hygiene_
// commit_scope MEMORY.md): DEAD-MOCK post A3-C5 cutover — route.ts:4 importa
// `makeSaleService` desde `@/modules/sale/presentation/composition-root` (hex),
// NO importa de `@/features/sale/sale.service`. Path siendo deleted A3-C7 GREEN
// sub-pasos 1-19 (features/sale/ wholesale removal). Sub-paso 21 atomic batch.

vi.mock("@/modules/dispatch/presentation/server", () => ({
  DispatchService: vi.fn().mockImplementation(function () {
    return {};
  }),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { requireAuth } from "@/features/shared/middleware";
vi.mock("@/modules/organizations/presentation/server", () => ({
  requireOrgAccess: vi.fn(),
  requireRole: vi.fn(),
}));

import { requireOrgAccess, requireRole } from "@/modules/organizations/presentation/server";
import { requirePermission } from "@/features/permissions/server";
import { UnauthorizedError, ForbiddenError } from "@/features/shared/errors";

// ── Constants ─────────────────────────────────────────────────────────────────

const ORG_SLUG = "test-org";
const ORG_ID = "org-hub-id";
const USER_ID = "user-hub-id";

function makeHubItem(source: "sale" | "dispatch" = "sale") {
  return {
    source,
    type: source === "sale" ? "VENTA_GENERAL" : "NOTA_DESPACHO",
    id: `${source}-1`,
    displayCode: source === "sale" ? "V-001" : "ND-001",
    referenceNumber: null,
    date: new Date("2024-06-01").toISOString(),
    contactId: "contact-1",
    contactName: "Cliente Test",
    periodId: "period-1",
    description: "Test item",
    totalAmount: 1000,
    status: "DRAFT",
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  mockListHub.mockResolvedValue({ items: [], total: 0 });

  vi.mocked(requireAuth).mockResolvedValue(
    { userId: USER_ID } as Awaited<ReturnType<typeof requireAuth>>,
  );
  vi.mocked(requireOrgAccess).mockResolvedValue(ORG_ID);
  vi.mocked(requireRole).mockResolvedValue(
    { role: "admin" } as Awaited<ReturnType<typeof requireRole>>,
  );
  vi.mocked(requirePermission).mockResolvedValue({
    session: { userId: USER_ID },
    orgId: ORG_ID,
    role: "admin",
  } as Awaited<ReturnType<typeof requirePermission>>);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/organizations/[orgSlug]/dispatches-hub", () => {
  // Task 2.1 — REQ-1, REQ-9: 200 with { items, total }
  it("retorna 200 con { items, total } para un rol válido", async () => {
    const sale = makeHubItem("sale");
    const dispatch = makeHubItem("dispatch");
    mockListHub.mockResolvedValue({ items: [sale, dispatch], total: 2 });

    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/dispatches-hub`,
    );
    const res = await GET(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("items");
    expect(body).toHaveProperty("total", 2);
    expect(body.items).toHaveLength(2);
  });

  // Task 2.1 — 200 con lista vacía
  it("retorna 200 con lista vacía cuando no hay items", async () => {
    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/dispatches-hub`,
    );
    const res = await GET(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
  });

  // Task 2.2 — REQ-9: role viewer → 403
  it("retorna 403 cuando el rol es viewer (sin permiso)", async () => {
    vi.mocked(requirePermission).mockRejectedValue(
      new ForbiddenError("Rol insuficiente"),
    );

    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/dispatches-hub`,
    );
    const res = await GET(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(403);
  });

  // Task 2.3 — REQ-3: ?type=VENTA_GENERAL forwarded to listHub
  it("reenvía ?type=VENTA_GENERAL a HubService.listHub como filters.type", async () => {
    mockListHub.mockResolvedValue({ items: [makeHubItem("sale")], total: 1 });

    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/dispatches-hub?type=VENTA_GENERAL`,
    );
    const res = await GET(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(200);
    expect(mockListHub).toHaveBeenCalledWith(
      ORG_ID,
      expect.objectContaining({ type: "VENTA_GENERAL" }),
    );
  });

  // Task 2.4 — REQ-4: ?dateFrom & ?dateTo forwarded as Date objects
  it("reenvía ?dateFrom y ?dateTo como objetos Date a HubService.listHub", async () => {
    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/dispatches-hub?dateFrom=2024-01-01&dateTo=2024-03-31`,
    );
    const res = await GET(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(200);
    expect(mockListHub).toHaveBeenCalledWith(
      ORG_ID,
      expect.objectContaining({
        dateFrom: expect.any(Date),
        dateTo: expect.any(Date),
      }),
    );
  });

  // Task 2.5 — REQ-5: ?status=DRAFT forwarded
  it("reenvía ?status=DRAFT a HubService.listHub como filters.status", async () => {
    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/dispatches-hub?status=DRAFT`,
    );
    const res = await GET(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(200);
    expect(mockListHub).toHaveBeenCalledWith(
      ORG_ID,
      expect.objectContaining({ status: "DRAFT" }),
    );
  });

  // Zod 400 — invalid type param
  it("retorna 400 cuando ?type tiene valor inválido (Zod)", async () => {
    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/dispatches-hub?type=INVALID_TYPE`,
    );
    const res = await GET(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Datos inválidos");
  });

  // 401 — no auth
  it("retorna 401 cuando no hay sesión autenticada", async () => {
    vi.mocked(requirePermission).mockRejectedValue(new UnauthorizedError());

    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/dispatches-hub`,
    );
    const res = await GET(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(401);
  });

  // 403 — no org access
  it("retorna 403 cuando el usuario no tiene acceso a la org", async () => {
    vi.mocked(requirePermission).mockRejectedValue(new ForbiddenError());

    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/dispatches-hub`,
    );
    const res = await GET(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(res.status).toBe(403);
  });

  // PR3.1 [RED] — REQ-RNM.4: dispatches-hub gate requires "sales", not "dispatches"
  it("retorna 403 cuando el rol tiene dispatches:read pero NO sales:read — gate ahora requiere sales", async () => {
    // Mock requirePermission so it passes for ("sales","read",...) but throws
    // ForbiddenError for ("dispatches","read",...). The route must call it
    // with "sales" (post resource-nav-mapping-fix) to reach 200.
    vi.mocked(requirePermission).mockImplementation(async (resource, _action, _orgSlug) => {
      if (resource === "sales") {
        return {
          session: { userId: USER_ID },
          orgId: ORG_ID,
          role: "cobrador",
        } as Awaited<ReturnType<typeof requirePermission>>;
      }
      throw new ForbiddenError("Rol insuficiente");
    });

    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/dispatches-hub`,
    );
    const res = await GET(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    // Route must call requirePermission with "sales" → 200
    expect(res.status).toBe(200);
    expect(vi.mocked(requirePermission)).toHaveBeenCalledWith(
      "sales",
      "read",
      ORG_SLUG,
    );
    // And it must NOT have tried "dispatches"
    expect(vi.mocked(requirePermission)).not.toHaveBeenCalledWith(
      "dispatches",
      "read",
      ORG_SLUG,
    );
  });
});
