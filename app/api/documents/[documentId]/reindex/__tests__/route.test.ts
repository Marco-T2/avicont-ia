/**
 * F6 C6.3 RED → GREEN — POST /api/documents/[documentId]/reindex (REQ-47/48).
 *
 * Covers (orchestrator brief):
 *   POST 200 { chunkCount }                — happy path
 *   POST 401                               — not authed
 *   POST 404                               — doc not found
 *   POST 403                               — caller lacks membership in doc's org
 *   POST 409 { error: "..." }              — concurrent reindex (lock held)
 *
 * Paired sister: app/api/documents/[documentId]/route.ts (DELETE handler) —
 * same async params shape, same `requireAuth` + service-side RBAC pattern.
 *
 * Lock surface: ConflictError from the service maps to HTTP 409 via the
 * shared error serializer. The Spanish copy comes from the service throw
 * site ("Reindexación en curso para esta organización").
 *
 * Expected RED failure (pre-GREEN): the route file does not exist; the
 * dynamic import in each test rejects with "Cannot find module '../route'"
 * — every it() fails for the same right reason.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Module mocks (hoisted before route import) ─────────────────────────────

vi.mock("@/features/shared/middleware", () => ({
  requireAuth: vi.fn(),
  handleError: vi.fn((err: unknown) => {
    if (err != null && typeof err === "object" && "statusCode" in err) {
      const e = err as { message: string; code?: string; statusCode: number };
      return Response.json({ error: e.message, code: e.code }, { status: e.statusCode });
    }
    return Response.json({ error: "Error interno del servidor" }, { status: 500 });
  }),
}));

const mockServiceInstance = vi.hoisted(() => ({
  reindex: vi.fn(),
}));

vi.mock("@/modules/documents/presentation/server", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/modules/documents/presentation/server")
  >();
  return {
    ...actual,
    makeDocumentsService: vi.fn().mockReturnValue(mockServiceInstance),
  };
});

// ─── Imports (after mocks) ───────────────────────────────────────────────────

import { requireAuth } from "@/features/shared/middleware";
import {
  UnauthorizedError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from "@/features/shared/errors";

const DOC_ID = "doc_reindex_route_1";
const CLERK_USER_ID = "user_clerk_id";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAuth).mockResolvedValue({
    userId: CLERK_USER_ID,
  } as Awaited<ReturnType<typeof requireAuth>>);
});

describe("POST /api/documents/[documentId]/reindex", () => {
  it("(a) returns 200 with chunkCount on success", async () => {
    mockServiceInstance.reindex.mockResolvedValue({ chunkCount: 7 });

    const { POST } = await import("../route");
    const request = new Request(
      `http://localhost/api/documents/${DOC_ID}/reindex`,
      { method: "POST" },
    );
    const res = await POST(request, {
      params: Promise.resolve({ documentId: DOC_ID }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { chunkCount: number };
    expect(body.chunkCount).toBe(7);
    expect(mockServiceInstance.reindex).toHaveBeenCalledWith(
      DOC_ID,
      CLERK_USER_ID,
    );
  });

  it("(b) returns 401 when caller is not authenticated", async () => {
    vi.mocked(requireAuth).mockRejectedValue(new UnauthorizedError());

    const { POST } = await import("../route");
    const request = new Request(
      `http://localhost/api/documents/${DOC_ID}/reindex`,
      { method: "POST" },
    );
    const res = await POST(request, {
      params: Promise.resolve({ documentId: DOC_ID }),
    });

    expect(res.status).toBe(401);
    expect(mockServiceInstance.reindex).not.toHaveBeenCalled();
  });

  it("(c) returns 404 when the document does not exist", async () => {
    mockServiceInstance.reindex.mockRejectedValue(new NotFoundError("Documento"));

    const { POST } = await import("../route");
    const request = new Request(
      `http://localhost/api/documents/${DOC_ID}/reindex`,
      { method: "POST" },
    );
    const res = await POST(request, {
      params: Promise.resolve({ documentId: DOC_ID }),
    });

    expect(res.status).toBe(404);
  });

  it("(d) returns 403 when the caller is not a member of the doc's org", async () => {
    mockServiceInstance.reindex.mockRejectedValue(new ForbiddenError());

    const { POST } = await import("../route");
    const request = new Request(
      `http://localhost/api/documents/${DOC_ID}/reindex`,
      { method: "POST" },
    );
    const res = await POST(request, {
      params: Promise.resolve({ documentId: DOC_ID }),
    });

    expect(res.status).toBe(403);
  });

  it("(e) returns 409 when a reindex is already in flight for the same org", async () => {
    mockServiceInstance.reindex.mockRejectedValue(
      new ConflictError("Reindexación en curso para esta organización"),
    );

    const { POST } = await import("../route");
    const request = new Request(
      `http://localhost/api/documents/${DOC_ID}/reindex`,
      { method: "POST" },
    );
    const res = await POST(request, {
      params: Promise.resolve({ documentId: DOC_ID }),
    });

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/en curso/);
  });
});
