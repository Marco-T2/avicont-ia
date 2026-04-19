/**
 * T5.7 — Route tests for
 *   PATCH /api/organizations/[orgSlug]/signature-configs/[documentType]
 *
 * Covers:
 *   - REQ-OP.4 upsert by (orgId, documentType)
 *   - REQ-OP.5 reject duplicate labels + unknown enum values
 *   - REQ-OP.6 admin-only including exact-args assertion (W-2)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequirePermission = vi.fn();

vi.mock("@/features/shared/permissions.server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/features/shared/middleware", () => ({
  requireAuth: vi.fn(),
  requireOrgAccess: vi.fn(),
  requireRole: vi.fn(),
  handleError: vi.fn((err: unknown) => {
    if (
      err != null &&
      typeof err === "object" &&
      "flatten" in err &&
      typeof (err as Record<string, unknown>).flatten === "function"
    ) {
      return Response.json(
        {
          error: "Datos inválidos",
          details: (err as { flatten: () => unknown }).flatten(),
        },
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
    return Response.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }),
}));

const mockServiceInstance = {
  upsert: vi.fn(),
};

vi.mock("@/features/document-signature-config/server", () => ({
  DocumentSignatureConfigService: vi.fn().mockImplementation(function () {
    return mockServiceInstance;
  }),
}));

import {
  requireAuth,
  requireOrgAccess,
  requireRole,
} from "@/features/shared/middleware";
import { ForbiddenError } from "@/features/shared/errors";

const ORG_SLUG = "test-org";
const ORG_ID = "org-test-id";
const USER_ID = "user-test-id";

beforeEach(() => {
  vi.clearAllMocks();

  mockServiceInstance.upsert.mockResolvedValue({
    id: "c-1",
    organizationId: ORG_ID,
    documentType: "COMPROBANTE",
    labels: ["ELABORADO", "APROBADO"],
    showReceiverRow: false,
  });

  mockRequirePermission.mockResolvedValue({ orgId: ORG_ID });

  vi.mocked(requireAuth).mockResolvedValue({
    userId: USER_ID,
  } as Awaited<ReturnType<typeof requireAuth>>);
  vi.mocked(requireOrgAccess).mockResolvedValue(ORG_ID);
  vi.mocked(requireRole).mockResolvedValue({
    role: "admin",
  } as Awaited<ReturnType<typeof requireRole>>);
});

describe("PATCH /api/organizations/[orgSlug]/signature-configs/[documentType]", () => {
  it("retorna 200 con el upsert válido", async () => {
    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/signature-configs/COMPROBANTE`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labels: ["ELABORADO", "APROBADO"],
          showReceiverRow: false,
        }),
      },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({
        orgSlug: ORG_SLUG,
        documentType: "COMPROBANTE",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.labels).toEqual(["ELABORADO", "APROBADO"]);
    expect(mockServiceInstance.upsert).toHaveBeenCalledWith(
      ORG_ID,
      "COMPROBANTE",
      {
        labels: ["ELABORADO", "APROBADO"],
        showReceiverRow: false,
      },
    );
  });

  it("retorna 400 cuando las labels tienen duplicados", async () => {
    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/signature-configs/COMPROBANTE`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labels: ["ELABORADO", "ELABORADO"],
          showReceiverRow: false,
        }),
      },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({
        orgSlug: ORG_SLUG,
        documentType: "COMPROBANTE",
      }),
    });

    expect(res.status).toBe(400);
    expect(mockServiceInstance.upsert).not.toHaveBeenCalled();
  });

  it("retorna 400 cuando labels contiene un valor desconocido (FACTURA)", async () => {
    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/signature-configs/COMPROBANTE`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labels: ["FACTURA"],
          showReceiverRow: false,
        }),
      },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({
        orgSlug: ORG_SLUG,
        documentType: "COMPROBANTE",
      }),
    });

    expect(res.status).toBe(400);
    expect(mockServiceInstance.upsert).not.toHaveBeenCalled();
  });

  it("retorna 400 cuando el documentType del path es desconocido", async () => {
    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/signature-configs/FACTURA`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labels: ["ELABORADO"],
          showReceiverRow: false,
        }),
      },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({
        orgSlug: ORG_SLUG,
        documentType: "FACTURA",
      }),
    });

    expect(res.status).toBe(400);
    expect(mockServiceInstance.upsert).not.toHaveBeenCalled();
  });

  it("retorna 400 cuando showReceiverRow falta (campo obligatorio)", async () => {
    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/signature-configs/COMPROBANTE`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labels: ["ELABORADO"] }),
      },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({
        orgSlug: ORG_SLUG,
        documentType: "COMPROBANTE",
      }),
    });

    expect(res.status).toBe(400);
    expect(mockServiceInstance.upsert).not.toHaveBeenCalled();
  });

  it("retorna 403 cuando requirePermission falla (non-admin)", async () => {
    mockRequirePermission.mockRejectedValue(new ForbiddenError());

    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/signature-configs/COMPROBANTE`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labels: ["ELABORADO"],
          showReceiverRow: false,
        }),
      },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({
        orgSlug: ORG_SLUG,
        documentType: "COMPROBANTE",
      }),
    });

    expect(res.status).toBe(403);
    expect(mockServiceInstance.upsert).not.toHaveBeenCalled();
  });

  it("preserva el orden de las labels tal como llegan", async () => {
    mockServiceInstance.upsert.mockResolvedValue({
      id: "c-1",
      organizationId: ORG_ID,
      documentType: "COMPROBANTE",
      labels: ["VISTO_BUENO", "ELABORADO", "APROBADO"],
      showReceiverRow: true,
    });

    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/signature-configs/COMPROBANTE`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labels: ["VISTO_BUENO", "ELABORADO", "APROBADO"],
          showReceiverRow: true,
        }),
      },
    );
    await PATCH(request, {
      params: Promise.resolve({
        orgSlug: ORG_SLUG,
        documentType: "COMPROBANTE",
      }),
    });

    expect(mockServiceInstance.upsert).toHaveBeenCalledWith(
      ORG_ID,
      "COMPROBANTE",
      {
        labels: ["VISTO_BUENO", "ELABORADO", "APROBADO"],
        showReceiverRow: true,
      },
    );
  });
});

// ── Permission key assertions (W-2) ──────────────────────────────────────────

describe("requirePermission args — signature-configs/[documentType] route", () => {
  it("PATCH calls requirePermission('accounting-config', 'write', orgSlug)", async () => {
    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/signature-configs/COMPROBANTE`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labels: ["ELABORADO", "APROBADO"],
          showReceiverRow: false,
        }),
      },
    );
    await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, documentType: "COMPROBANTE" }),
    });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "accounting-config",
      "write",
      ORG_SLUG,
    );
  });
});
