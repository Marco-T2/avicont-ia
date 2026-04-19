/**
 * T5.1 — Route tests for GET/PATCH /api/organizations/[orgSlug]/profile.
 *
 * Strategy: service + middleware mocks — no DB.
 *
 * Covers:
 *   - REQ-OP.1 getOrCreate + partial update
 *   - REQ-OP.2 zod validation at edge
 *   - REQ-OP.6 admin-only (requirePermission) including exact-args assertion
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
  getOrCreate: vi.fn(),
  update: vi.fn(),
  updateLogo: vi.fn(),
  deleteLogoBlob: vi.fn(),
};

vi.mock("@/features/org-profile/server", () => ({
  OrgProfileService: vi.fn().mockImplementation(function () {
    return mockServiceInstance;
  }),
}));

import {
  requireAuth,
  requireOrgAccess,
  requireRole,
} from "@/features/shared/middleware";
import {
  UnauthorizedError,
  ForbiddenError,
} from "@/features/shared/errors";

const ORG_SLUG = "test-org";
const ORG_ID = "org-test-id";
const USER_ID = "user-test-id";

function makeProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: "p-1",
    organizationId: ORG_ID,
    razonSocial: "",
    nit: "",
    direccion: "",
    ciudad: "",
    telefono: "",
    nroPatronal: null,
    logoUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  mockServiceInstance.getOrCreate.mockResolvedValue(makeProfile());
  mockServiceInstance.update.mockResolvedValue(makeProfile());

  mockRequirePermission.mockResolvedValue({ orgId: ORG_ID });

  vi.mocked(requireAuth).mockResolvedValue({
    userId: USER_ID,
  } as Awaited<ReturnType<typeof requireAuth>>);
  vi.mocked(requireOrgAccess).mockResolvedValue(ORG_ID);
  vi.mocked(requireRole).mockResolvedValue({
    role: "admin",
  } as Awaited<ReturnType<typeof requireRole>>);
});

// ── GET /profile ──────────────────────────────────────────────────────────────

describe("GET /api/organizations/[orgSlug]/profile", () => {
  it("retorna 200 con el perfil (getOrCreate)", async () => {
    const profile = makeProfile({ razonSocial: "Empresa X" });
    mockServiceInstance.getOrCreate.mockResolvedValue(profile);

    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/profile`,
    );
    const res = await GET(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.razonSocial).toBe("Empresa X");
    expect(mockServiceInstance.getOrCreate).toHaveBeenCalledWith(ORG_ID);
  });

  it("retorna 401 si no está autenticado", async () => {
    mockRequirePermission.mockRejectedValue(new UnauthorizedError());

    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/profile`,
    );
    const res = await GET(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });

    expect(res.status).toBe(401);
  });

  it("retorna 403 si el usuario no tiene acceso (requirePermission falla)", async () => {
    mockRequirePermission.mockRejectedValue(new ForbiddenError());

    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/profile`,
    );
    const res = await GET(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });

    expect(res.status).toBe(403);
  });
});

// ── PATCH /profile ────────────────────────────────────────────────────────────

describe("PATCH /api/organizations/[orgSlug]/profile", () => {
  it("retorna 200 con el perfil actualizado cuando el body es válido", async () => {
    const updated = makeProfile({
      razonSocial: "Empresa Nueva",
      ciudad: "Sucre",
    });
    mockServiceInstance.update.mockResolvedValue(updated);

    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/profile`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ razonSocial: "Empresa Nueva", ciudad: "Sucre" }),
      },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.razonSocial).toBe("Empresa Nueva");
    expect(body.ciudad).toBe("Sucre");
    expect(mockServiceInstance.update).toHaveBeenCalledWith(
      ORG_ID,
      expect.objectContaining({
        razonSocial: "Empresa Nueva",
        ciudad: "Sucre",
      }),
    );
  });

  it("retorna 400 con fieldErrors cuando razonSocial está vacío", async () => {
    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/profile`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ razonSocial: "   " }),
      },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Datos inválidos");
    expect(body.details).toBeDefined();
    expect(mockServiceInstance.update).not.toHaveBeenCalled();
  });

  it("retorna 400 cuando logoUrl no es una URL válida", async () => {
    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/profile`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: "not-a-url" }),
      },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });

    expect(res.status).toBe(400);
    expect(mockServiceInstance.update).not.toHaveBeenCalled();
  });

  it("retorna 403 cuando requirePermission falla (non-admin)", async () => {
    mockRequirePermission.mockRejectedValue(new ForbiddenError());

    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/profile`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ razonSocial: "Empresa X" }),
      },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });

    expect(res.status).toBe(403);
    expect(mockServiceInstance.update).not.toHaveBeenCalled();
  });

  it("llama al service con el orgId resuelto por requirePermission (no desde la URL)", async () => {
    // Aunque la URL tenga un slug, el orgId debe venir resuelto por la guard,
    // no por parsear el path. El mock resuelve ORG_ID para este slug.
    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/profile`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ razonSocial: "Empresa X" }),
      },
    );
    await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });

    expect(mockServiceInstance.update).toHaveBeenCalledWith(
      ORG_ID,
      expect.any(Object),
    );
  });
});

// ── Permission key assertions (W-2) ──────────────────────────────────────────

describe("requirePermission args — profile route", () => {
  it("GET calls requirePermission('accounting-config', 'write', orgSlug)", async () => {
    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/profile`,
    );
    await GET(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "accounting-config",
      "write",
      ORG_SLUG,
    );
  });

  it("PATCH calls requirePermission('accounting-config', 'write', orgSlug)", async () => {
    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/profile`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ razonSocial: "Empresa X" }),
      },
    );
    await PATCH(request, { params: Promise.resolve({ orgSlug: ORG_SLUG }) });

    expect(mockRequirePermission).toHaveBeenCalledWith(
      "accounting-config",
      "write",
      ORG_SLUG,
    );
  });
});
