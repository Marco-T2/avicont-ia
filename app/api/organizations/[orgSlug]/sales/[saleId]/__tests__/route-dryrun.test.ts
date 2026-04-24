/**
 * PR2 — sale-edit-cascade: PATCH route dryRun / confirmTrim (RED → GREEN)
 *
 * Tests route-level behavior for:
 * - dryRun: true → returns { dryRun: true, trimPreview } without executing edit (SC-13 variant)
 * - no confirmTrim + trim needed → returns { requiresConfirmation: true, trimPreview } (SC-14)
 * - confirmTrim: true → proceeds with edit normally (SC-13)
 *
 * REQ-7, SC-13, SC-14
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Module mocks (must be hoisted before any import of the route) ─────────────

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
      return Response.json({ error: e.message, code: e.code }, { status: e.statusCode });
    }
    return Response.json({ error: "Error interno del servidor" }, { status: 500 });
  }),
}));

const mockSaleServiceInstance = {
  update: vi.fn(),
  getEditPreview: vi.fn(),
};

vi.mock("@/features/sale/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/sale")>();
  return {
    ...actual,
    SaleService: vi.fn().mockImplementation(function () {
      return mockSaleServiceInstance;
    }),
  };
});

vi.mock("@/features/accounting/iva-books/server", () => ({
  IvaBooksService: vi.fn().mockImplementation(function () {
    return {};
  }),
}));

vi.mock("@/features/shared/users.service", () => ({
  UsersService: vi.fn().mockImplementation(function () {
    return {
      resolveByClerkId: vi.fn().mockResolvedValue({ id: "user-db-id" }),
    };
  }),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { requireAuth } from "@/features/shared/middleware";
vi.mock("@/features/organizations/server", () => ({
  requireOrgAccess: vi.fn(),
  requireRole: vi.fn(),
}));

import { requireOrgAccess, requireRole } from "@/features/organizations/server";

// ── Constants ─────────────────────────────────────────────────────────────────

const ORG_SLUG = "test-org-dr";
const ORG_ID = "org-route-dr-id";
const SALE_ID = "sale-route-dr-id";
const CLERK_USER_ID = "clerk-user-dr";

const TRIM_PREVIEW = [
  {
    allocationId: "alloc-route-01",
    paymentDate: "2025-02-20",
    originalAmount: "40.00",
    trimmedTo: "20.00",
  },
];

const UPDATED_SALE = {
  id: SALE_ID,
  organizationId: ORG_ID,
  status: "POSTED",
  totalAmount: 80,
  displayCode: "VG-003",
};

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(requireAuth).mockResolvedValue({
    userId: CLERK_USER_ID,
  } as Awaited<ReturnType<typeof requireAuth>>);
  vi.mocked(requireOrgAccess).mockResolvedValue(ORG_ID);
  vi.mocked(requireRole).mockResolvedValue({
    role: "admin",
  } as Awaited<ReturnType<typeof requireRole>>);

  mockSaleServiceInstance.update.mockResolvedValue(UPDATED_SALE);
  mockSaleServiceInstance.getEditPreview.mockResolvedValue({ trimPreview: [] });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PATCH /api/organizations/[orgSlug]/sales/[saleId] — dryRun & confirmTrim (PR2)", () => {
  // SC-13 variant: dryRun: true → preview without executing
  it("dryRun=true retorna { dryRun: true, trimPreview } sin ejecutar el edit", async () => {
    mockSaleServiceInstance.getEditPreview.mockResolvedValue({ trimPreview: TRIM_PREVIEW });

    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/sales/${SALE_ID}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dryRun: true,
          details: [{ description: "Servicio", lineAmount: 80, incomeAccountId: "acc-id" }],
        }),
      },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, saleId: SALE_ID }),
    });

    expect(res.status).toBe(200);
    const json = await res.json() as { dryRun: boolean; trimPreview: unknown[] };
    expect(json.dryRun).toBe(true);
    expect(json.trimPreview).toEqual(TRIM_PREVIEW);
    // Must NOT call saleService.update (no mutation)
    expect(mockSaleServiceInstance.update).not.toHaveBeenCalled();
  });

  // SC-14: no confirmTrim + trim needed → requiresConfirmation: true
  it("sin confirmTrim con recorte necesario retorna { requiresConfirmation: true, trimPreview }", async () => {
    mockSaleServiceInstance.getEditPreview.mockResolvedValue({ trimPreview: TRIM_PREVIEW });

    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/sales/${SALE_ID}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          details: [{ description: "Servicio reducido", lineAmount: 80, incomeAccountId: "acc-id" }],
        }),
      },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, saleId: SALE_ID }),
    });

    expect(res.status).toBe(200);
    const json = await res.json() as { requiresConfirmation: boolean; trimPreview: unknown[] };
    expect(json.requiresConfirmation).toBe(true);
    expect(json.trimPreview).toEqual(TRIM_PREVIEW);
    // Must NOT call saleService.update (awaiting confirmation)
    expect(mockSaleServiceInstance.update).not.toHaveBeenCalled();
  });

  // SC-13: confirmTrim: true → proceeds with edit normally
  it("confirmTrim=true con recorte necesario ejecuta el edit y retorna la venta actualizada", async () => {
    mockSaleServiceInstance.getEditPreview.mockResolvedValue({ trimPreview: TRIM_PREVIEW });

    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/sales/${SALE_ID}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmTrim: true,
          details: [{ description: "Servicio confirmado", lineAmount: 80, incomeAccountId: "acc-id" }],
        }),
      },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, saleId: SALE_ID }),
    });

    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json).not.toHaveProperty("requiresConfirmation");
    expect(json).not.toHaveProperty("dryRun");
    expect(mockSaleServiceInstance.update).toHaveBeenCalledOnce();
  });

  // No trim needed → single roundtrip, proceeds normally
  it("sin recorte necesario (trimPreview vacío) ejecuta el edit directamente", async () => {
    mockSaleServiceInstance.getEditPreview.mockResolvedValue({ trimPreview: [] });

    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/sales/${SALE_ID}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          details: [{ description: "Servicio aumento", lineAmount: 120, incomeAccountId: "acc-id" }],
        }),
      },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, saleId: SALE_ID }),
    });

    expect(res.status).toBe(200);
    expect(mockSaleServiceInstance.update).toHaveBeenCalledOnce();
  });
});
