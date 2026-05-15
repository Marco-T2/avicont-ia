/**
 * POC #10 C3-D Ciclo 3 — POST /api/organizations/:orgSlug/journal
 *
 * Switch del route POST de `JournalService` legacy al hexagonal
 * `JournalsService.createEntry` / `createAndPost` vía composition root.
 * Sin bridge displayNumber + voucherType nested (counter productivo real
 * 0/3 — drop lockeado en Block B fix-up §13 emergente).
 *
 * Failure mode RED 3a: el route sigue llamando al `JournalService` legacy,
 * los mocks hexagonales `mockCreateEntry` / `mockCreateAndPost` nunca se
 * invocan → expect(...).toHaveBeenCalledTimes(1) falla.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateEntry, mockCreateAndPost } = vi.hoisted(() => ({
  mockCreateEntry: vi.fn(),
  mockCreateAndPost: vi.fn(),
}));

const { mockLegacyCreateEntry, mockLegacyCreateAndPost, mockLegacyList } =
  vi.hoisted(() => ({
    mockLegacyCreateEntry: vi.fn(),
    mockLegacyCreateAndPost: vi.fn(),
    mockLegacyList: vi.fn(),
  }));

vi.mock("@/features/shared/middleware", () => ({
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

vi.mock("@/features/permissions/server", () => ({
  requirePermission: vi.fn(),
}));

vi.mock("@/features/users/server", () => ({
  UsersService: vi.fn().mockImplementation(function () {
    return {
      resolveByClerkId: vi.fn().mockResolvedValue({ id: "user-db-id" }),
    };
  }),
}));

vi.mock("@/modules/accounting/presentation/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/accounting/presentation/server")>()),
  makeJournalsService: vi.fn(() => ({
    createEntry: mockCreateEntry,
    createAndPost: mockCreateAndPost,
    list: mockLegacyList,
  })),
}));

import { requirePermission } from "@/features/permissions/server";
import { POST } from "../route";

const ORG_SLUG = "test-org";
const ORG_ID = "org-test-id";

function makeParams(
  orgSlug = ORG_SLUG,
): Promise<{ orgSlug: string }> {
  return Promise.resolve({ orgSlug });
}

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  date: "2026-04-15",
  description: "Test entry",
  periodId: "clz0000000000000000000001",
  voucherTypeId: "clz0000000000000000000002",
  lines: [
    {
      accountId: "clz0000000000000000000003",
      debit: 100,
      credit: 0,
      order: 0,
    },
    {
      accountId: "clz0000000000000000000004",
      debit: 0,
      credit: 100,
      order: 1,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  (requirePermission as ReturnType<typeof vi.fn>).mockResolvedValue({
    session: { userId: "clerk-user-id" },
    orgId: ORG_ID,
    role: "owner",
  });
});

describe("POST /journal — hexagonal switch (POC #10 C3-D Ciclo 3)", () => {
  it("postImmediately=false → invokes hexagonal createEntry, NOT legacy", async () => {
    mockCreateEntry.mockResolvedValue({
      toSnapshot: () => ({ id: "je-1", number: 42, status: "DRAFT" }),
    });

    const res = await POST(makeRequest(validBody), { params: makeParams() });

    expect(mockCreateEntry).toHaveBeenCalledTimes(1);
    expect(mockLegacyCreateEntry).not.toHaveBeenCalled();
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("je-1");
    expect(body.displayNumber).toBeUndefined();
  });

  it("postImmediately=true → invokes hexagonal createAndPost, NOT legacy", async () => {
    mockCreateAndPost.mockResolvedValue({
      journal: {
        toSnapshot: () => ({ id: "je-2", number: 43, status: "POSTED" }),
      },
      correlationId: "corr-1",
    });

    const res = await POST(
      makeRequest({ ...validBody, postImmediately: true }),
      { params: makeParams() },
    );

    expect(mockCreateAndPost).toHaveBeenCalledTimes(1);
    expect(mockLegacyCreateAndPost).not.toHaveBeenCalled();
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("je-2");
    expect(body.displayNumber).toBeUndefined();
  });
});
