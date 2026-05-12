/**
 * T5.5 — Route tests for GET /api/organizations/[orgSlug]/signature-configs.
 *
 * Covers:
 *   - REQ-OP.4 listAll returns exactly 8 views (one per DocumentPrintType)
 *   - REQ-OP.6 admin-only (requirePermission) including exact-args assertion (W-2)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequirePermission = vi.fn();

vi.mock("@/features/permissions/server", () => ({
  requirePermission: mockRequirePermission,
}));

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
    return Response.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }),
}));

const mockServiceInstance = {
  listAll: vi.fn(),
};

vi.mock("@/modules/document-signature-config/presentation/server", async () => {
  const actual = await import("@/modules/document-signature-config/domain/document-signature-config.entity");
  return {
    makeDocumentSignatureConfigService: vi.fn().mockImplementation(function () {
      return mockServiceInstance;
    }),
    ALL_DOCUMENT_PRINT_TYPES: actual.ALL_DOCUMENT_PRINT_TYPES,
  };
});

import { requireAuth } from "@/features/shared/middleware";
vi.mock("@/modules/organizations/presentation/server", () => ({
  requireOrgAccess: vi.fn(),
  requireRole: vi.fn(),
}));

import { requireOrgAccess, requireRole } from "@/modules/organizations/presentation/server";
import {
  UnauthorizedError,
  ForbiddenError,
} from "@/features/shared/errors";
import { ALL_DOCUMENT_PRINT_TYPES } from "@/modules/document-signature-config/presentation/server";

const ORG_SLUG = "test-org";
const ORG_ID = "org-test-id";
const USER_ID = "user-test-id";

function makeDefaultViews() {
  return ALL_DOCUMENT_PRINT_TYPES.map((documentType) => ({
    documentType,
    labels: [],
    showReceiverRow: false,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();

  mockServiceInstance.listAll.mockResolvedValue(makeDefaultViews());

  mockRequirePermission.mockResolvedValue({ orgId: ORG_ID });

  vi.mocked(requireAuth).mockResolvedValue({
    userId: USER_ID,
  } as Awaited<ReturnType<typeof requireAuth>>);
  vi.mocked(requireOrgAccess).mockResolvedValue(ORG_ID);
  vi.mocked(requireRole).mockResolvedValue({
    role: "admin",
  } as Awaited<ReturnType<typeof requireRole>>);
});

describe("GET /api/organizations/[orgSlug]/signature-configs", () => {
  it("retorna 200 con exactamente 8 vistas (una por DocumentPrintType)", async () => {
    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/signature-configs`,
    );
    const res = await GET(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(8);
    expect(mockServiceInstance.listAll).toHaveBeenCalledWith(ORG_ID);
  });

  it("retorna las vistas en el orden canónico de ALL_DOCUMENT_PRINT_TYPES", async () => {
    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/signature-configs`,
    );
    const res = await GET(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });
    const body = await res.json();
    expect(body.map((v: { documentType: string }) => v.documentType)).toEqual([
      ...ALL_DOCUMENT_PRINT_TYPES,
    ]);
  });

  it("retorna 401 si no está autenticado", async () => {
    mockRequirePermission.mockRejectedValue(new UnauthorizedError());

    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/signature-configs`,
    );
    const res = await GET(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });

    expect(res.status).toBe(401);
  });

  it("retorna 403 cuando requirePermission falla (non-admin)", async () => {
    mockRequirePermission.mockRejectedValue(new ForbiddenError());

    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/signature-configs`,
    );
    const res = await GET(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });

    expect(res.status).toBe(403);
    expect(mockServiceInstance.listAll).not.toHaveBeenCalled();
  });
});

// ── Permission key assertions (W-2) ──────────────────────────────────────────

describe("requirePermission args — signature-configs route", () => {
  it("GET calls requirePermission('accounting-config', 'write', orgSlug)", async () => {
    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/signature-configs`,
    );
    await GET(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "accounting-config",
      "write",
      ORG_SLUG,
    );
  });
});
