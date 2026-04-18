/**
 * PR6.2 RED → GREEN — POST /api/organizations/[orgSlug]/members
 *
 * Covers:
 *   CR.8-S1 — valid org role accepted (201)
 *   CR.8-S2 — unknown slug rejected (422-shape)
 *   R.1-S2  — owner slug rejected (non-assignable)
 *   R.1-S3  — custom slug accepted (async exists=true)
 *   D.9     — parseAsync wiring in route handler
 *
 * Strategy:
 *   Mock middleware (requirePermission + handleError), MembersService,
 *   and the rolesService singleton used by the async refine. No DB.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Module mocks (hoisted) ──────────────────────────────────────────────────

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
      return Response.json({ error: e.message, code: e.code }, { status: e.statusCode });
    }
    return Response.json({ error: "Error interno del servidor" }, { status: 500 });
  }),
}));

vi.mock("@/features/shared/permissions.server", () => ({
  requirePermission: vi.fn(),
}));

const mockMembersServiceInstance = {
  listMembers: vi.fn(),
  addMember: vi.fn(),
  updateRole: vi.fn(),
  removeMember: vi.fn(),
};

vi.mock("@/features/organizations", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/organizations")>();
  return {
    ...actual,
    MembersService: vi.fn().mockImplementation(function () {
      return mockMembersServiceInstance;
    }),
  };
});

// The async refine inside the factory calls rolesService.exists — mock that singleton.
vi.mock("@/features/organizations/roles.service.singleton", () => ({
  rolesService: {
    exists: vi.fn<(orgId: string, slug: string) => Promise<boolean>>(),
  },
}));

import { requirePermission } from "@/features/shared/permissions.server";
import { rolesService } from "@/features/organizations/roles.service.singleton";

const ORG_SLUG = "acme";
const ORG_ID = "org_acme_id";
const CLERK_USER_ID = "user_clerk_id";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requirePermission).mockResolvedValue({
    session: { userId: CLERK_USER_ID },
    orgId: ORG_ID,
    role: "admin",
  } as Awaited<ReturnType<typeof requirePermission>>);
});

describe("POST /api/organizations/[orgSlug]/members — async role validation (PR6.2)", () => {
  it("(e) returns 201 for valid custom role with async exists=true", async () => {
    vi.mocked(rolesService.exists).mockResolvedValue(true);
    mockMembersServiceInstance.addMember.mockResolvedValue({
      id: "m1",
      role: "facturador",
      userId: "u1",
      name: "x",
      email: "x@y.com",
    });

    const { POST } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/members`,
      {
        method: "POST",
        body: JSON.stringify({ email: "x@y.com", role: "facturador" }),
      },
    );
    const res = await POST(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { role: string };
    expect(body.role).toBe("facturador");
    expect(rolesService.exists).toHaveBeenCalledWith(ORG_ID, "facturador");
    expect(mockMembersServiceInstance.addMember).toHaveBeenCalledWith(
      ORG_ID,
      "x@y.com",
      "facturador",
    );
  });

  it("(f) returns 4xx validation error when role slug is unknown (exists=false)", async () => {
    vi.mocked(rolesService.exists).mockResolvedValue(false);

    const { POST } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/members`,
      {
        method: "POST",
        body: JSON.stringify({ email: "x@y.com", role: "cajero" }),
      },
    );
    const res = await POST(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });

    // handleError maps ZodError → 400 (existing project convention). Any
    // validation-failure status code is acceptable as long as it's in the
    // 4xx range and the service was NOT called.
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(rolesService.exists).toHaveBeenCalledWith(ORG_ID, "cajero");
    expect(mockMembersServiceInstance.addMember).not.toHaveBeenCalled();
  });

  it("(R.1-S2) rejects role='owner' without touching rolesService.exists", async () => {
    vi.mocked(rolesService.exists).mockResolvedValue(true);

    const { POST } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/members`,
      {
        method: "POST",
        body: JSON.stringify({ email: "x@y.com", role: "owner" }),
      },
    );
    const res = await POST(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(rolesService.exists).not.toHaveBeenCalled();
    expect(mockMembersServiceInstance.addMember).not.toHaveBeenCalled();
  });

  it("(CR.8-S1) accepts system role 'contador' via async path", async () => {
    vi.mocked(rolesService.exists).mockResolvedValue(true);
    mockMembersServiceInstance.addMember.mockResolvedValue({
      id: "m2",
      role: "contador",
      userId: "u2",
      name: "y",
      email: "y@y.com",
    });

    const { POST } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/members`,
      {
        method: "POST",
        body: JSON.stringify({ email: "y@y.com", role: "contador" }),
      },
    );
    const res = await POST(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });

    expect(res.status).toBe(201);
    expect(rolesService.exists).toHaveBeenCalledWith(ORG_ID, "contador");
  });
});

describe("PATCH /api/organizations/[orgSlug]/members/[memberId] — async role validation (PR6.2)", () => {
  const MEMBER_ID = "m1";

  it("(g) rejects role='owner' (non-assignable) without touching rolesService.exists", async () => {
    vi.mocked(rolesService.exists).mockResolvedValue(true);

    const { PATCH } = await import("../[memberId]/route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/members/${MEMBER_ID}`,
      {
        method: "PATCH",
        body: JSON.stringify({ role: "owner" }),
      },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, memberId: MEMBER_ID }),
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(rolesService.exists).not.toHaveBeenCalled();
    expect(mockMembersServiceInstance.updateRole).not.toHaveBeenCalled();
  });

  it("(R.3mod-S3) accepts custom role 'facturador' when exists=true", async () => {
    vi.mocked(rolesService.exists).mockResolvedValue(true);
    mockMembersServiceInstance.updateRole.mockResolvedValue({
      id: MEMBER_ID,
      role: "facturador",
      userId: "u1",
      name: "n",
      email: "e@e.com",
    });

    const { PATCH } = await import("../[memberId]/route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/members/${MEMBER_ID}`,
      {
        method: "PATCH",
        body: JSON.stringify({ role: "facturador" }),
      },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, memberId: MEMBER_ID }),
    });

    expect(res.status).toBe(200);
    expect(rolesService.exists).toHaveBeenCalledWith(ORG_ID, "facturador");
    expect(mockMembersServiceInstance.updateRole).toHaveBeenCalledWith(
      ORG_ID,
      MEMBER_ID,
      "facturador",
      CLERK_USER_ID,
    );
  });

  it("(CR.8-S2) rejects unknown slug 'cajero' (exists=false) and does not call service", async () => {
    vi.mocked(rolesService.exists).mockResolvedValue(false);

    const { PATCH } = await import("../[memberId]/route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/members/${MEMBER_ID}`,
      {
        method: "PATCH",
        body: JSON.stringify({ role: "cajero" }),
      },
    );
    const res = await PATCH(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG, memberId: MEMBER_ID }),
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(rolesService.exists).toHaveBeenCalledWith(ORG_ID, "cajero");
    expect(mockMembersServiceInstance.updateRole).not.toHaveBeenCalled();
  });
});
