/**
 * T7 — Route handler: GET /api/organizations/[orgSlug]/journal/[entryId]?format=pdf
 *
 * Branch `?format=pdf` devuelve application/pdf; sin format sigue JSON (backward compat).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetById, mockExportVoucherPdf } = vi.hoisted(() => ({
  mockGetById: vi.fn(),
  mockExportVoucherPdf: vi.fn(),
}));

vi.mock("@/features/shared/middleware", () => ({
  handleError: vi.fn((err: unknown) => {
    if (err != null && typeof err === "object" && "statusCode" in err) {
      const e = err as { message: string; code?: string; statusCode: number };
      return Response.json({ error: e.message, code: e.code }, { status: e.statusCode });
    }
    if (err instanceof Error && err.name === "ZodError") {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return Response.json({ error: "Error interno del servidor" }, { status: 500 });
  }),
}));

vi.mock("@/features/permissions/server", () => ({
  requirePermission: vi.fn(),
}));

vi.mock("@/features/users/server", () => ({
  UsersService: vi.fn().mockImplementation(function () {
    return { resolveByClerkId: vi.fn() };
  }),
}));

vi.mock("@/modules/accounting/presentation/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/accounting/presentation/server")>()),
  makeJournalsService: vi.fn(() => ({
    getById: mockGetById,
    exportVoucherPdf: mockExportVoucherPdf,
  })),
}));

import { requirePermission } from "@/features/permissions/server";
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

describe("GET /journal/[entryId] — format=pdf branch", () => {
  it("sin ?format → JSON con entry (backward compat)", async () => {
    mockGetById.mockResolvedValue({
      id: ENTRY_ID,
      number: 145,
      date: new Date("2025-08-19"),
      voucherType: { prefix: "CE" },
    });

    const res = await GET(makeRequest(), { params: makeParams() });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(mockExportVoucherPdf).not.toHaveBeenCalled();
  });

  it("?format=pdf → application/pdf con Buffer", async () => {
    const fakePdf = Buffer.from("%PDF-1.7 fake pdf content");
    mockExportVoucherPdf.mockResolvedValue(fakePdf);

    const res = await GET(makeRequest("?format=pdf"), { params: makeParams() });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toContain("inline");
    expect(res.headers.get("content-disposition")).toContain(".pdf");
    const body = Buffer.from(await res.arrayBuffer());
    expect(body.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(mockGetById).not.toHaveBeenCalled();
  });

  it("?format=pdf&exchangeRate=6.96&ufvRate=2.82 → pasa opts al service", async () => {
    mockExportVoucherPdf.mockResolvedValue(Buffer.from("%PDF-1.7"));

    await GET(makeRequest("?format=pdf&exchangeRate=6.96&ufvRate=2.82"), {
      params: makeParams(),
    });

    expect(mockExportVoucherPdf).toHaveBeenCalledWith(
      ORG_ID,
      ENTRY_ID,
      expect.objectContaining({ exchangeRate: 6.96, ufvRate: "2.82" }),
    );
  });

  it("?format=pdf&exchangeRate=0 → pasa 0 (omite USD en composer)", async () => {
    mockExportVoucherPdf.mockResolvedValue(Buffer.from("%PDF-1.7"));

    await GET(makeRequest("?format=pdf&exchangeRate=0"), { params: makeParams() });

    expect(mockExportVoucherPdf).toHaveBeenCalledWith(
      ORG_ID,
      ENTRY_ID,
      expect.objectContaining({ exchangeRate: 0 }),
    );
  });

  it("?format=invalid → 400 (Zod)", async () => {
    const res = await GET(makeRequest("?format=xlsx"), { params: makeParams() });

    expect(res.status).toBe(400);
    expect(mockExportVoucherPdf).not.toHaveBeenCalled();
    expect(mockGetById).not.toHaveBeenCalled();
  });
});
