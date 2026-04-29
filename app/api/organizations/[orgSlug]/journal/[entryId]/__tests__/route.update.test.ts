/**
 * POC #10 C3-D Ciclo 4 — PATCH /api/organizations/:orgSlug/journal/:entryId
 *
 * Switch del route PATCH de `JournalService.updateEntry` legacy al
 * hexagonal `JournalsService.updateEntry` vía composition root. Sin
 * bridge displayNumber + voucherType nested (counter productivo real
 * 0/3 — drop lockeado en Block B fix-up §13 emergente).
 *
 * Coexistencia: GET single + GET pdf se quedan en legacy.
 *
 * Failure mode RED 4a: el route sigue llamando a `service.updateEntry`
 * legacy → `mockUpdateEntry` hex nunca se invoca →
 * expect(mockUpdateEntry).toHaveBeenCalledTimes(1) falla.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUpdateEntry } = vi.hoisted(() => ({
  mockUpdateEntry: vi.fn(),
}));

const { mockLegacyUpdateEntry, mockLegacyGetById, mockLegacyExportPdf } =
  vi.hoisted(() => ({
    mockLegacyUpdateEntry: vi.fn(),
    mockLegacyGetById: vi.fn(),
    mockLegacyExportPdf: vi.fn(),
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

vi.mock("@/features/accounting/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/accounting/server")>()),
  JournalService: vi.fn().mockImplementation(function () {
    return {
      updateEntry: mockLegacyUpdateEntry,
      getById: mockLegacyGetById,
      exportVoucherPdf: mockLegacyExportPdf,
    };
  }),
}));

vi.mock("@/modules/accounting/presentation/composition-root", () => ({
  makeJournalsService: vi.fn(() => ({
    updateEntry: mockUpdateEntry,
  })),
}));

import { requirePermission } from "@/features/permissions/server";
import { PATCH } from "../route";

const ORG_SLUG = "test-org";
const ORG_ID = "org-test-id";
const ENTRY_ID = "clz0000000000000000000099";

function makeParams(
  orgSlug = ORG_SLUG,
  entryId = ENTRY_ID,
): Promise<{ orgSlug: string; entryId: string }> {
  return Promise.resolve({ orgSlug, entryId });
}

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/test", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validPatchBody = {
  description: "Updated description",
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

describe("PATCH /journal/[entryId] — hexagonal switch (POC #10 C3-D Ciclo 4)", () => {
  it("invokes hexagonal updateEntry, NOT legacy", async () => {
    mockUpdateEntry.mockResolvedValue({
      journal: {
        toSnapshot: () => ({
          id: ENTRY_ID,
          number: 42,
          status: "DRAFT",
          description: "Updated description",
        }),
      },
      correlationId: "corr-1",
    });

    const res = await PATCH(makeRequest(validPatchBody), {
      params: makeParams(),
    });

    expect(mockUpdateEntry).toHaveBeenCalledTimes(1);
    expect(mockLegacyUpdateEntry).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(ENTRY_ID);
    expect(body.displayNumber).toBeUndefined();
  });
});
