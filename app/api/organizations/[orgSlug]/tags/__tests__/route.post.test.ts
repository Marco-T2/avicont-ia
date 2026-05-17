/**
 * F5 C5.1 RED → GREEN — POST /api/organizations/[orgSlug]/tags (REQ-46).
 *
 * Covers:
 *   POST 201 { tag: Tag }   — upload-capable role (mirrors documents:write)
 *   POST 400                — Zod (name missing)
 *   POST 403                — caller lacks upload permission for ANY scope
 *   POST 409                — slug collision (Prisma P2002 → ConflictError)
 *
 * Paired sister: app/api/organizations/[orgSlug]/roles/__tests__/route.test.ts
 * (POST handler, ConflictError → 409 surface).
 *
 * Expected RED failure (pre-GREEN): the route file exports only GET; the
 * dynamic `await import("../route").POST` is `undefined` and TypeError
 * "POST is not a function" surfaces on the first call — every test fails
 * for the same right reason (handler not implemented yet).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Module mocks (hoisted before route import) ─────────────────────────────

vi.mock("@/features/shared/middleware", () => ({
  requireAuth: vi.fn(),
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

vi.mock("@/features/permissions/server", () => ({
  requirePermission: vi.fn(),
}));

const mockTagsServiceInstance = vi.hoisted(() => ({
  list: vi.fn(),
  resolveBySlugs: vi.fn(),
  create: vi.fn(),
  attach: vi.fn(),
}));

vi.mock("@/modules/tags/presentation/server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/modules/tags/presentation/server")>();
  return {
    ...actual,
    makeTagsService: vi.fn().mockReturnValue(mockTagsServiceInstance),
  };
});

// ─── Imports (after mocks) ───────────────────────────────────────────────────

import { requirePermission } from "@/features/permissions/server";
import { ForbiddenError } from "@/features/shared/errors";

const ORG_SLUG = "acme";
const ORG_ID = "org_acme_id";
const CLERK_USER_ID = "user_clerk_id";

function makeTag(slug: string) {
  return {
    id: `tag-${slug}`,
    organizationId: ORG_ID,
    name: slug,
    slug,
    color: null,
    createdAt: new Date("2026-05-17T00:00:00Z"),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requirePermission).mockResolvedValue({
    session: { userId: CLERK_USER_ID },
    orgId: ORG_ID,
    role: "admin",
  } as Awaited<ReturnType<typeof requirePermission>>);
});

describe("POST /api/organizations/[orgSlug]/tags", () => {
  it("(a) returns 201 with the created tag for upload-capable role", async () => {
    mockTagsServiceInstance.create.mockResolvedValue(makeTag("rrhh"));

    const { POST } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/tags`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "RRHH", color: "#abcdef" }),
      },
    );
    const res = await POST(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { tag: { slug: string } };
    expect(body.tag.slug).toBe("rrhh");
    expect(mockTagsServiceInstance.create).toHaveBeenCalledWith(
      ORG_ID,
      "RRHH",
      "#abcdef",
    );
  });

  it("(b) returns 403 when caller cannot upload to any scope", async () => {
    vi.mocked(requirePermission).mockRejectedValue(new ForbiddenError());

    const { POST } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/tags`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "RRHH" }),
      },
    );
    const res = await POST(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });

    expect(res.status).toBe(403);
    expect(mockTagsServiceInstance.create).not.toHaveBeenCalled();
  });

  it("(c) returns 409 with friendly Spanish copy when slug collides (Prisma P2002)", async () => {
    // Simulate the unique-constraint error bubbling up from PrismaTagsRepository.
    const prismaError = Object.assign(new Error("Unique constraint"), {
      code: "P2002",
    });
    mockTagsServiceInstance.create.mockRejectedValue(prismaError);

    const { POST } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/tags`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Contabilidad" }),
      },
    );
    const res = await POST(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/ya existe/);
  });

  it("(d) returns 400 when name is missing (Zod)", async () => {
    const { POST } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/tags`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );
    const res = await POST(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });

    expect(res.status).toBe(400);
    expect(mockTagsServiceInstance.create).not.toHaveBeenCalled();
  });
});
