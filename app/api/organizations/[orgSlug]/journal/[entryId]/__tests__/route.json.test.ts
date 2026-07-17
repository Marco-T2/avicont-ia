/**
 * T1.1 — REQ-DISPLAY-2 sentinel: GET /api/organizations/[orgSlug]/journal/[entryId]
 * JSON response must NOT contain the `displayNumber` field (helper retirement).
 *
 * RED expected failure mode (declared per [[red_acceptance_failure_mode]]):
 *   `expect(body).not.toHaveProperty("displayNumber")` FAILS because route.ts:54
 *   currently returns `{ ...entry, displayNumber }` enriched with
 *   `formatCorrelativeNumber(...)`.
 *
 * GREEN: drop `displayNumber` const + drop field from returned object + drop
 *   `formatCorrelativeNumber` import from route.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetById } = vi.hoisted(() => ({
  mockGetById: vi.fn(),
}));

vi.mock("@/features/shared/middleware", () => ({
  handleError: vi.fn((err: unknown) => {
    if (err != null && typeof err === "object" && "statusCode" in err) {
      const e = err as { message: string; code?: string; statusCode: number };
      return Response.json({ error: e.message, code: e.code }, { status: e.statusCode });
    }
    return Response.json({ error: "Error interno del servidor" }, { status: 500 });
  }),
}));

vi.mock("@/modules/permissions/application/server", () => ({
  requirePermission: vi.fn(),
}));

vi.mock("@/modules/users/application/users.service", () => ({
  UsersService: vi.fn().mockImplementation(function () {
    return { resolveByClerkId: vi.fn() };
  }),
}));

vi.mock("@/modules/accounting/presentation/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/accounting/presentation/server")>()),
  makeJournalsService: vi.fn(() => ({
    getById: mockGetById,
    exportVoucherPdf: vi.fn(),
  })),
}));

import { requirePermission } from "@/modules/permissions/application/server";
import { GET } from "../route";

const ORG_SLUG = "test-org";
const ORG_ID = "org-test-id";
const ENTRY_ID = "entry-xyz";

function makeParams() {
  return Promise.resolve({ orgSlug: ORG_SLUG, entryId: ENTRY_ID });
}

function makeRequest(search = ""): Request {
  return new Request(`http://localhost/api/test${search}`, { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();
  (requirePermission as ReturnType<typeof vi.fn>).mockResolvedValue({
    session: { userId: "clerk-user-id" },
    orgId: ORG_ID,
    role: "owner",
  });
});

describe("GET /journal/[entryId] — JSON shape (REQ-DISPLAY-2)", () => {
  it("response body MUST NOT contain `displayNumber` field", async () => {
    mockGetById.mockResolvedValue({
      id: ENTRY_ID,
      number: 145,
      date: new Date("2025-08-19"),
      voucherType: { prefix: "CE" },
    });

    const res = await GET(makeRequest(), { params: makeParams() });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).not.toHaveProperty("displayNumber");
  });
});
