/**
 * PR5.1 RED → GREEN — GET / POST /api/organizations/[orgSlug]/roles
 *
 * Covers:
 *   R.4-S1  — list roles
 *   R.4-S2  — create custom role
 *   CR.3-S3 — unauthorized user cannot create role
 *   CR.4-S2 — duplicate slug rejected (409 SLUG_TAKEN)
 *   D.10    — HTTP taxonomy (403 / 409 / 422)
 *
 * Strategy:
 *   Mock RolesService + middleware (requireAuth/Org/Role, handleError).
 *   No DB; no real cache; no Clerk.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Module mocks (hoisted before route import) ─────────────────────────────

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

// Permissions cache: we only need revalidateOrgMatrix to be callable.
vi.mock("@/features/shared/permissions.cache", () => ({
  revalidateOrgMatrix: vi.fn(),
  getMatrix: vi.fn(),
}));

// Gate at the requirePermission boundary — the inner middleware primitives
// (requireAuth / requireOrgAccess / requireRole) stay mocked too for tests
// that want to force a 401/403 at a specific layer.
vi.mock("@/features/shared/permissions.server", () => ({
  requirePermission: vi.fn(),
}));

// ─── Imports (after mocks) ───────────────────────────────────────────────────

import {
  requireAuth,
  requireOrgAccess,
  requireRole,
} from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import {
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  ValidationError,
  RESERVED_SLUG,
  SLUG_TAKEN,
} from "@/features/shared/errors";

// ─── Constants ───────────────────────────────────────────────────────────────

const ORG_SLUG = "acme";
const ORG_ID = "org_acme_id";
const CLERK_USER_ID = "user_clerk_id";

function makeSystemRole(slug: string) {
  return {
    id: `r-${slug}`,
    organizationId: ORG_ID,
    slug,
    name: slug,
    description: null,
    isSystem: true,
    permissionsRead: [],
    permissionsWrite: slug === "admin" ? ["members"] : [],
    canPost: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeCustomRole(slug: string) {
  return {
    id: `r-${slug}`,
    organizationId: ORG_ID,
    slug,
    name: slug,
    description: null,
    isSystem: false,
    permissionsRead: ["sales"],
    permissionsWrite: [],
    canPost: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const SYSTEM_ROLES_ROWS = [
  makeSystemRole("owner"),
  makeSystemRole("admin"),
  makeSystemRole("contador"),
  makeSystemRole("cobrador"),
  makeSystemRole("member"),
];

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(requireAuth).mockResolvedValue({
    userId: CLERK_USER_ID,
  } as Awaited<ReturnType<typeof requireAuth>>);
  vi.mocked(requireOrgAccess).mockResolvedValue(ORG_ID);
  vi.mocked(requireRole).mockResolvedValue({
    role: "admin",
  } as Awaited<ReturnType<typeof requireRole>>);

  vi.mocked(requirePermission).mockResolvedValue({
    session: { userId: CLERK_USER_ID },
    orgId: ORG_ID,
    role: "admin",
  } as Awaited<ReturnType<typeof requirePermission>>);
});

// ─── GET ─────────────────────────────────────────────────────────────────────

describe("GET /api/organizations/[orgSlug]/roles", () => {
  it("(a) returns 200 with { roles: [...] } containing 5 system rows for admin caller", async () => {
    mockRolesServiceInstance.listRoles.mockResolvedValue(SYSTEM_ROLES_ROWS);

    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/roles`,
    );
    const res = await GET(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { roles: Array<{ slug: string }> };
    expect(body.roles).toHaveLength(5);
    expect(body.roles.map((r) => r.slug)).toEqual([
      "owner",
      "admin",
      "contador",
      "cobrador",
      "member",
    ]);
    expect(mockRolesServiceInstance.listRoles).toHaveBeenCalledWith(ORG_ID);
  });

  it("(b) returns 403 when caller lacks members.read", async () => {
    vi.mocked(requirePermission).mockRejectedValue(new ForbiddenError());

    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/roles`,
    );
    const res = await GET(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });

    expect(res.status).toBe(403);
    expect(mockRolesServiceInstance.listRoles).not.toHaveBeenCalled();
  });

  it("(c) returns 401 when unauthenticated", async () => {
    vi.mocked(requirePermission).mockRejectedValue(new UnauthorizedError());

    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/roles`,
    );
    const res = await GET(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });

    expect(res.status).toBe(401);
    expect(mockRolesServiceInstance.listRoles).not.toHaveBeenCalled();
  });
});

// ─── W-3: Cross-org slug isolation (CR.4-S3) ─────────────────────────────────

describe("GET /api/organizations/[orgSlug]/roles — cross-org slug isolation (CR.4-S3)", () => {
  const ORG_A_SLUG = "org-a";
  const ORG_A_ID = "org_a_id";
  const ORG_B_SLUG = "org-b";
  const ORG_B_ID = "org_b_id";

  it("(j) same role slug in two orgs returns separate records scoped to each org", async () => {
    const roleA = {
      id: "r-a-facturador",
      organizationId: ORG_A_ID,
      slug: "facturador",
      name: "Facturador A",
      description: null,
      isSystem: false,
      permissionsRead: ["sales"],
      permissionsWrite: [],
      canPost: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const roleB = {
      id: "r-b-facturador",
      organizationId: ORG_B_ID,
      slug: "facturador",
      name: "Facturador B",
      description: null,
      isSystem: false,
      permissionsRead: ["purchases"],
      permissionsWrite: [],
      canPost: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { GET } = await import("../route");

    // ── Org A request ─────────────────────────────────────────────────────────
    vi.mocked(requirePermission).mockResolvedValueOnce({
      session: { userId: CLERK_USER_ID },
      orgId: ORG_A_ID,
      role: "admin",
    } as Awaited<ReturnType<typeof requirePermission>>);
    mockRolesServiceInstance.listRoles.mockResolvedValueOnce([roleA]);

    const reqA = new Request(
      `http://localhost/api/organizations/${ORG_A_SLUG}/roles`,
    );
    const resA = await GET(reqA, {
      params: Promise.resolve({ orgSlug: ORG_A_SLUG }),
    });

    expect(resA.status).toBe(200);
    const bodyA = (await resA.json()) as { roles: Array<{ id: string; slug: string }> };
    expect(bodyA.roles).toHaveLength(1);
    expect(bodyA.roles[0].id).toBe("r-a-facturador");
    expect(mockRolesServiceInstance.listRoles).toHaveBeenLastCalledWith(ORG_A_ID);

    // ── Org B request ─────────────────────────────────────────────────────────
    vi.mocked(requirePermission).mockResolvedValueOnce({
      session: { userId: CLERK_USER_ID },
      orgId: ORG_B_ID,
      role: "admin",
    } as Awaited<ReturnType<typeof requirePermission>>);
    mockRolesServiceInstance.listRoles.mockResolvedValueOnce([roleB]);

    const reqB = new Request(
      `http://localhost/api/organizations/${ORG_B_SLUG}/roles`,
    );
    const resB = await GET(reqB, {
      params: Promise.resolve({ orgSlug: ORG_B_SLUG }),
    });

    expect(resB.status).toBe(200);
    const bodyB = (await resB.json()) as { roles: Array<{ id: string; slug: string }> };
    expect(bodyB.roles).toHaveLength(1);
    expect(bodyB.roles[0].id).toBe("r-b-facturador");
    expect(mockRolesServiceInstance.listRoles).toHaveBeenLastCalledWith(ORG_B_ID);

    // ── Verify route properly scoped each call to the correct orgId ───────────
    // Both calls share the same slug "facturador" but returned different records,
    // proving the route delegates org scope via orgId (from requirePermission),
    // not the URL slug alone.
    expect(bodyA.roles[0].id).not.toBe(bodyB.roles[0].id);
  });
});

// ─── POST ────────────────────────────────────────────────────────────────────

describe("POST /api/organizations/[orgSlug]/roles", () => {
  it("(d) returns 201 with created role when payload is valid", async () => {
    const created = makeCustomRole("facturador");
    mockRolesServiceInstance.createRole.mockResolvedValue(created);

    const { POST } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/roles`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Facturador",
          templateSlug: "contador",
        }),
      },
    );
    const res = await POST(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { role: { slug: string } };
    expect(body.role.slug).toBe("facturador");
    expect(mockRolesServiceInstance.createRole).toHaveBeenCalledWith(
      ORG_ID,
      expect.objectContaining({ name: "Facturador", templateSlug: "contador" }),
      expect.objectContaining({ clerkUserId: CLERK_USER_ID }),
    );
  });

  it("(e) returns 422 with RESERVED_SLUG when service rejects reserved slug", async () => {
    mockRolesServiceInstance.createRole.mockRejectedValue(
      new ValidationError("El slug \"admin\" está reservado", RESERVED_SLUG),
    );

    const { POST } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/roles`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "admin", templateSlug: "contador" }),
      },
    );
    const res = await POST(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });

    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe(RESERVED_SLUG);
  });

  it("(f) returns 409 with SLUG_TAKEN when service reports slug exhaustion", async () => {
    mockRolesServiceInstance.createRole.mockRejectedValue(
      new ConflictError("No se pudo resolver un slug único", SLUG_TAKEN),
    );

    const { POST } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/roles`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Facturador",
          templateSlug: "contador",
        }),
      },
    );
    const res = await POST(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe(SLUG_TAKEN);
  });

  it("(g) returns 403 when caller lacks members.write", async () => {
    vi.mocked(requirePermission).mockRejectedValue(new ForbiddenError());

    const { POST } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/roles`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Facturador",
          templateSlug: "contador",
        }),
      },
    );
    const res = await POST(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });

    expect(res.status).toBe(403);
    expect(mockRolesServiceInstance.createRole).not.toHaveBeenCalled();
  });

  it("(h) returns 400 when templateSlug is missing (Zod validation)", async () => {
    const { POST } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/roles`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Facturador" }),
      },
    );
    const res = await POST(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });

    expect(res.status).toBe(400);
    expect(mockRolesServiceInstance.createRole).not.toHaveBeenCalled();
  });

  it("(i) returns 500 when body is malformed JSON", async () => {
    const { POST } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/roles`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json{",
      },
    );
    const res = await POST(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });

    // SyntaxError from request.json() is unknown → 500 per handleError fallback
    expect(res.status).toBe(500);
    expect(mockRolesServiceInstance.createRole).not.toHaveBeenCalled();
  });
});
