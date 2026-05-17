/**
 * F5 C5.0 RED → GREEN — GET /api/organizations/[orgSlug]/tags (REQ-46).
 *
 * Covers:
 *   GET 200 { tags: Tag[] }        — any org member
 *   GET 401                        — unauthenticated
 *   GET 403                        — caller is not a member of the org
 *
 * Paired sister: app/api/organizations/[orgSlug]/roles/__tests__/route.test.ts.
 * POST scenarios live in route.post.test.ts (next cycle).
 *
 * Expected RED failure (pre-GREEN): the route file does not exist; the
 * dynamic `await import("../route")` rejects with `Cannot find module
 * '../route'`, failing every it() before any assertion runs. That IS the
 * right reason (route handler not implemented yet).
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
import { UnauthorizedError, ForbiddenError } from "@/features/shared/errors";

// ─── Constants ───────────────────────────────────────────────────────────────

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

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requirePermission).mockResolvedValue({
    session: { userId: CLERK_USER_ID },
    orgId: ORG_ID,
    role: "admin",
  } as Awaited<ReturnType<typeof requirePermission>>);
});

// ─── GET ─────────────────────────────────────────────────────────────────────

describe("GET /api/organizations/[orgSlug]/tags", () => {
  it("(a) returns 200 with { tags: [...] } for any authed org member", async () => {
    mockTagsServiceInstance.list.mockResolvedValue([
      makeTag("contabilidad"),
      makeTag("fiscal"),
    ]);

    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/tags`,
    );
    const res = await GET(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { tags: Array<{ slug: string }> };
    expect(body.tags).toHaveLength(2);
    expect(body.tags.map((t) => t.slug)).toEqual(["contabilidad", "fiscal"]);
    expect(mockTagsServiceInstance.list).toHaveBeenCalledWith(ORG_ID);
  });

  it("(b) returns 401 when unauthenticated", async () => {
    vi.mocked(requirePermission).mockRejectedValue(new UnauthorizedError());

    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/tags`,
    );
    const res = await GET(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });

    expect(res.status).toBe(401);
    expect(mockTagsServiceInstance.list).not.toHaveBeenCalled();
  });

  it("(c) returns 403 when caller is not a member of the org", async () => {
    vi.mocked(requirePermission).mockRejectedValue(new ForbiddenError());

    const { GET } = await import("../route");
    const request = new Request(
      `http://localhost/api/organizations/${ORG_SLUG}/tags`,
    );
    const res = await GET(request, {
      params: Promise.resolve({ orgSlug: ORG_SLUG }),
    });

    expect(res.status).toBe(403);
    expect(mockTagsServiceInstance.list).not.toHaveBeenCalled();
  });
});
