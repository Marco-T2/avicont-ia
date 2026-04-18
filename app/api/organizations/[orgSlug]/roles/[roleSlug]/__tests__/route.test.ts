/**
 * PR5.2 RED → GREEN — GET / PATCH / DELETE
 * /api/organizations/[orgSlug]/roles/[roleSlug]
 *
 * Covers:
 *   CR.2-S1 — PATCH system role rejected (403 SYSTEM_ROLE_IMMUTABLE)
 *   CR.2-S2 — DELETE system role rejected (403 SYSTEM_ROLE_IMMUTABLE)
 *   CR.5-S3 — PATCH success triggers revalidateOrgMatrix via service
 *   CR.6-S1 — self-lock guard (403 SELF_LOCK_GUARD)
 *   CR.7-S1 — delete blocked by members (409 ROLE_HAS_MEMBERS)
 *   CR.7-S2 — delete succeeds when empty (200)
 *   D.10    — HTTP taxonomy (403 / 404 / 409 / 422)
 *
 * The route handler must pass a caller context that lets RolesService run the
 * self-lock guard end-to-end. We verify this by asserting the service receives
 * the correct CallerContext and by simulating the guard throwing.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Module mocks (hoisted) ─────────────────────────────────────────────────

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

const mockRolesServiceInstance = {
  listRoles: vi.fn(),
  createRole: vi.fn(),
  getRole: vi.fn(),
  updateRole: vi.fn(),
  deleteRole: vi.fn(),
  exists: vi.fn(),
};

vi.mock("@/features/organizations", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/organizations")>();
  return {
    ...actual,
    RolesService: vi.fn().mockImplementation(function () {
      return mockRolesServiceInstance;
    }),
    RolesRepository: vi.fn().mockImplementation(function () {
      return {};
    }),
  };
});

vi.mock("@/features/shared/permissions.cache", () => ({
  revalidateOrgMatrix: vi.fn(),
  getMatrix: vi.fn(),
}));

vi.mock("@/features/shared/permissions.server", () => ({
  requirePermission: vi.fn(),
}));

// ─── Imports ────────────────────────────────────────────────────────────────

import { requirePermission } from "@/features/shared/permissions.server";
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ValidationError,
  SYSTEM_ROLE_IMMUTABLE,
  SELF_LOCK_GUARD,
  ROLE_HAS_MEMBERS,
} from "@/features/shared/errors";

// ─── Constants ──────────────────────────────────────────────────────────────

const ORG_SLUG = "acme";
const ORG_ID = "org_acme_id";
const CLERK_USER_ID = "user_clerk_id";
const CUSTOM_SLUG = "facturador";
const SYSTEM_SLUG = "admin";

function makeRole(overrides: Partial<{ slug: string; isSystem: boolean }> = {}) {
  return {
    id: `r-${overrides.slug ?? CUSTOM_SLUG}`,
    organizationId: ORG_ID,
    slug: overrides.slug ?? CUSTOM_SLUG,
    name: overrides.slug ?? CUSTOM_SLUG,
    description: null,
    isSystem: overrides.isSystem ?? false,
    permissionsRead: ["sales"],
    permissionsWrite: ["sales", "members"],
    canPost: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(requirePermission).mockResolvedValue({
    session: { userId: CLERK_USER_ID },
    orgId: ORG_ID,
    role: "admin",
  } as Awaited<ReturnType<typeof requirePermission>>);
});

// ─── GET ────────────────────────────────────────────────────────────────────

describe("GET /api/organizations/[orgSlug]/roles/[roleSlug]", () => {
  it("(a) returns 200 with { role } when slug exists", async () => {
    const role = makeRole({ slug: CUSTOM_SLUG });
    mockRolesServiceInstance.getRole.mockResolvedValue(role);

    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/roles/${CUSTOM_SLUG}`,
    );
    const res = await GET(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, roleSlug: CUSTOM_SLUG }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { role: { slug: string } };
    expect(body.role.slug).toBe(CUSTOM_SLUG);
    expect(mockRolesServiceInstance.getRole).toHaveBeenCalledWith(
      ORG_ID,
      CUSTOM_SLUG,
    );
  });

  it("(b) returns 404 with NOT_FOUND code when slug is unknown", async () => {
    mockRolesServiceInstance.getRole.mockRejectedValue(
      new NotFoundError("Rol"),
    );

    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/roles/unknown`,
    );
    const res = await GET(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, roleSlug: "unknown" }),
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("NOT_FOUND");
  });
});

// ─── PATCH ──────────────────────────────────────────────────────────────────

describe("PATCH /api/organizations/[orgSlug]/roles/[roleSlug]", () => {
  it("(c) returns 403 SYSTEM_ROLE_IMMUTABLE when patching a system role", async () => {
    mockRolesServiceInstance.updateRole.mockRejectedValue(
      new ForbiddenError(
        "No se puede modificar un rol del sistema",
        SYSTEM_ROLE_IMMUTABLE,
      ),
    );

    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/roles/${SYSTEM_SLUG}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "hacked" }),
      },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, roleSlug: SYSTEM_SLUG }),
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe(SYSTEM_ROLE_IMMUTABLE);
  });

  it("(d) returns 403 SELF_LOCK_GUARD when PATCH would strip caller's members.write", async () => {
    mockRolesServiceInstance.updateRole.mockRejectedValue(
      new ForbiddenError(
        "No podés quitarte a vos mismo la gestión de miembros",
        SELF_LOCK_GUARD,
      ),
    );

    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/roles/${CUSTOM_SLUG}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionsWrite: ["sales"] }),
      },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, roleSlug: CUSTOM_SLUG }),
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe(SELF_LOCK_GUARD);

    // Critical wiring check: the service MUST have been called with a caller
    // context containing the clerk user id — otherwise self-lock cannot run.
    expect(mockRolesServiceInstance.updateRole).toHaveBeenCalledWith(
      ORG_ID,
      CUSTOM_SLUG,
      expect.objectContaining({ permissionsWrite: ["sales"] }),
      expect.objectContaining({ clerkUserId: CLERK_USER_ID }),
    );
  });

  it("(e) returns 200 with updated role on valid PATCH and service is invoked", async () => {
    const updated = makeRole({ slug: CUSTOM_SLUG });
    mockRolesServiceInstance.updateRole.mockResolvedValue(updated);

    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/roles/${CUSTOM_SLUG}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Facturador V2",
          permissionsRead: ["sales", "reports"],
        }),
      },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, roleSlug: CUSTOM_SLUG }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { role: { slug: string } };
    expect(body.role.slug).toBe(CUSTOM_SLUG);
    expect(mockRolesServiceInstance.updateRole).toHaveBeenCalledOnce();
  });

  it("(f) returns 400 when payload is invalid (Zod)", async () => {
    const { PATCH } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/roles/${CUSTOM_SLUG}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // slug must be rejected (immutable on UPDATE, D.5) — use strict schema
        body: JSON.stringify({ slug: "new-slug" }),
      },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, roleSlug: CUSTOM_SLUG }),
    });

    expect(res.status).toBe(400);
    expect(mockRolesServiceInstance.updateRole).not.toHaveBeenCalled();
  });
});

// ─── DELETE ─────────────────────────────────────────────────────────────────

describe("DELETE /api/organizations/[orgSlug]/roles/[roleSlug]", () => {
  it("(g) returns 403 SYSTEM_ROLE_IMMUTABLE when deleting a system role", async () => {
    mockRolesServiceInstance.deleteRole.mockRejectedValue(
      new ForbiddenError(
        "No se puede eliminar un rol del sistema",
        SYSTEM_ROLE_IMMUTABLE,
      ),
    );

    const { DELETE } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/roles/${SYSTEM_SLUG}`,
      { method: "DELETE" },
    );
    const res = await DELETE(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, roleSlug: SYSTEM_SLUG }),
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe(SYSTEM_ROLE_IMMUTABLE);
  });

  it("(h) returns 409 ROLE_HAS_MEMBERS when role has assigned members", async () => {
    mockRolesServiceInstance.deleteRole.mockRejectedValue(
      new ConflictError("No se puede eliminar", ROLE_HAS_MEMBERS),
    );

    const { DELETE } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/roles/${CUSTOM_SLUG}`,
      { method: "DELETE" },
    );
    const res = await DELETE(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, roleSlug: CUSTOM_SLUG }),
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe(ROLE_HAS_MEMBERS);
  });

  it("(i) returns 200 with success body when role has zero members", async () => {
    mockRolesServiceInstance.deleteRole.mockResolvedValue(undefined);

    const { DELETE } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/roles/${CUSTOM_SLUG}`,
      { method: "DELETE" },
    );
    const res = await DELETE(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, roleSlug: CUSTOM_SLUG }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);
    expect(mockRolesServiceInstance.deleteRole).toHaveBeenCalledWith(
      ORG_ID,
      CUSTOM_SLUG,
      expect.objectContaining({ clerkUserId: CLERK_USER_ID }),
    );
  });
});

// Silence unused-import linter (shared errors kept for symmetry across tests)
void ValidationError;
