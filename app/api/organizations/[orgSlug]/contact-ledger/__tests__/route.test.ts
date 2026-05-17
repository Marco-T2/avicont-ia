/**
 * C4/C7 — Route tests for GET /api/organizations/[orgSlug]/contact-ledger
 *
 * Covers spec REQ "API Contract — Contact Ledger" + "PDF Export" + "XLSX Export":
 *   T1 — format=json + valid params → 200 + ContactLedgerPaginatedDto shape
 *   T2 — format=json sin params → 200 (defaults aplicados)
 *   T3 — format=pdf sin contactId → ValidationError (422)
 *   T4 — format=xlsx sin dateFrom/dateTo → ValidationError (422)
 *   T5 — sin permission `reports:read` → 403 ForbiddenError
 *   T6 — format=pdf con contactId+rango → 200 + application/pdf + inline
 *   T7 — format=xlsx con contactId+rango → 200 + xlsx mime + attachment
 *   T8 — Decimal serializados como string en json (NO Decimal objects)
 *
 * C7 cutover (este commit): T6 + T7 flip de 501 NotImplementedError stubs a
 * 200 con exporters cableados. Exporters viven en subdir
 * `infrastructure/exporters/contact-ledger/` (design D6 + α17 preservation
 * per [[named_rule_immutability]]). Mocks para exporters + contactsService +
 * journalRepo + fetchLogoAsDataUrl bundled per [[mock_hygiene_commit_scope]].
 *
 * Sister precedent: `app/api/organizations/[orgSlug]/trial-balance/__tests__/route.test.ts`
 * (paired sister apply directly per [[paired_sister_default_no_surface]]).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ForbiddenError, ValidationError } from "@/features/shared/errors";

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  mockRequirePermission,
  mockGetContactLedgerPaginated,
  mockGetActiveById,
  mockGetOrgMetadata,
  mockFetchLogoAsDataUrl,
  mockExportPdf,
  mockExportXlsx,
} = vi.hoisted(() => ({
  mockRequirePermission: vi.fn(),
  mockGetContactLedgerPaginated: vi.fn(),
  mockGetActiveById: vi.fn(),
  mockGetOrgMetadata: vi.fn(),
  mockFetchLogoAsDataUrl: vi.fn(),
  mockExportPdf: vi.fn(),
  mockExportXlsx: vi.fn(),
}));

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@/features/permissions/server", () => ({
  requirePermission: mockRequirePermission,
}));

vi.mock("@/features/shared/middleware", () => ({
  handleError: vi.fn((err: unknown) => {
    if (
      err != null &&
      typeof err === "object" &&
      "flatten" in err &&
      typeof (err as Record<string, unknown>).flatten === "function"
    ) {
      return Response.json(
        { error: "Datos inválidos" },
        { status: 400 },
      );
    }
    if (err != null && typeof err === "object" && "statusCode" in err) {
      const e = err as { message: string; code?: string; statusCode: number };
      return Response.json(
        { error: e.message, code: e.code },
        { status: e.statusCode },
      );
    }
    return Response.json({ error: "Error interno" }, { status: 500 });
  }),
}));

// [[mock_hygiene_commit_scope]] + [[cross_module_boundary_mock_target_rewrite]]:
// makeLedgerService factory mock + exporter functions stub (route.ts importa
// `makeLedgerService` + `exportContactLedger{Pdf,Xlsx}` desde el mismo barrel).
vi.mock("@/modules/accounting/presentation/server", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/modules/accounting/presentation/server")
  >()),
  makeLedgerService: vi.fn().mockReturnValue({
    getContactLedgerPaginated: mockGetContactLedgerPaginated,
  }),
  exportContactLedgerPdf: mockExportPdf,
  exportContactLedgerXlsx: mockExportXlsx,
}));

// contactsService factory — usado solo en PDF/XLSX branches (T6/T7) para
// resolver contact.name. Json branch no llama contactsService directamente
// (el service interno hace la resolution via contacts.getActiveById).
vi.mock("@/modules/contacts/presentation/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/contacts/presentation/server")>()),
  makeContactsService: vi.fn().mockReturnValue({
    getActiveById: mockGetActiveById,
  }),
}));

// JournalRepository class — `new JournalRepository()` at module load del route,
// pero también es construido por la composition-root (importada vía la barrel
// que arriba mockeamos parcialmente). Stub debe ser constructable desde ambos
// callsites — usar partial mock con importOriginal preservando otras exports +
// substituyendo la class por una stub-class real.
vi.mock(
  "@/modules/accounting/infrastructure/prisma-journal-entries.repo",
  async (importOriginal) => {
    const mod =
      await importOriginal<
        typeof import("@/modules/accounting/infrastructure/prisma-journal-entries.repo")
      >();
    class JournalRepositoryStub {
      getOrgMetadata = mockGetOrgMetadata;
    }
    return {
      ...mod,
      JournalRepository: JournalRepositoryStub,
    };
  },
);

vi.mock("@/modules/accounting/infrastructure/exporters/logo-fetcher", () => ({
  fetchLogoAsDataUrl: mockFetchLogoAsDataUrl,
}));

// ── Minimal DTO fixture (Decimal fields as string per DEC-1 boundary) ────────

const minimalDto = {
  items: [
    {
      entryId: "je-1",
      date: new Date("2025-01-15"),
      entryNumber: 1,
      voucherCode: "CD",
      displayNumber: "CD2501-000001",
      description: "Venta a cliente",
      debit: "150.50",
      credit: "0.00",
      balance: "150.50",
      status: "PENDING",
      dueDate: "2025-02-15T00:00:00.000Z",
      voucherTypeHuman: "Nota de despacho",
      sourceType: "sale",
      paymentMethod: null,
      bankAccountName: null,
      withoutAuxiliary: false,
    },
  ],
  total: 1,
  page: 1,
  pageSize: 25,
  totalPages: 1,
  openingBalance: "0.00",
};

const fakeContact = {
  id: "contact-1",
  name: "Distribuidora ACME SRL",
};

const fakeOrgMeta = {
  name: "Avicont SA",
  taxId: "1001",
  address: "Av. Principal 123",
  city: "La Paz",
  logoUrl: null,
};

// ── Import after mocks ───────────────────────────────────────────────────────

import { GET, runtime } from "../route";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeParams(slug = "acme") {
  return Promise.resolve({ orgSlug: slug });
}

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/organizations/acme/contact-ledger");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString());
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePermission.mockResolvedValue({ orgId: "org-1", role: "contador" });
  mockGetContactLedgerPaginated.mockResolvedValue(minimalDto);
  mockGetActiveById.mockResolvedValue(fakeContact);
  mockGetOrgMetadata.mockResolvedValue(fakeOrgMeta);
  mockFetchLogoAsDataUrl.mockResolvedValue(undefined);
  mockExportPdf.mockResolvedValue({
    buffer: Buffer.from("%PDF-1.4 fake"),
    docDef: {},
  });
  mockExportXlsx.mockResolvedValue(Buffer.from("PK\x03\x04 fake xlsx"));
});

describe("GET /api/.../contact-ledger — json branch (T1, T2, T8)", () => {
  it("T1 — format=json + valid params → 200 + ContactLedgerPaginatedDto shape", async () => {
    const res = await GET(
      makeRequest({
        contactId: "contact-1",
        dateFrom: "2025-01-01",
        dateTo: "2025-01-31",
        format: "json",
      }),
      { params: makeParams() },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();
    expect(body).toMatchObject({
      items: expect.any(Array),
      total: expect.any(Number),
      page: expect.any(Number),
      pageSize: expect.any(Number),
      totalPages: expect.any(Number),
      openingBalance: expect.any(String),
    });
  });

  it("T2 — format=json sin params → 200 (defaults aplicados)", async () => {
    const res = await GET(makeRequest({ format: "json" }), {
      params: makeParams(),
    });
    expect(res.status).toBe(200);
    expect(mockGetContactLedgerPaginated).toHaveBeenCalled();
  });

  it("T8 — monetary fields serializados como string (DEC-1)", async () => {
    const res = await GET(
      makeRequest({
        contactId: "contact-1",
        dateFrom: "2025-01-01",
        dateTo: "2025-01-31",
      }),
      { params: makeParams() },
    );
    const body = await res.json();
    expect(typeof body.openingBalance).toBe("string");
    expect(typeof body.items[0].debit).toBe("string");
    expect(typeof body.items[0].credit).toBe("string");
    expect(typeof body.items[0].balance).toBe("string");
  });
});

describe("GET /api/.../contact-ledger — input validation (T3, T4)", () => {
  it("T3 — format=pdf sin contactId → ValidationError (422)", async () => {
    const res = await GET(
      makeRequest({ format: "pdf", dateFrom: "2025-01-01", dateTo: "2025-01-31" }),
      { params: makeParams() },
    );
    expect(res.status).toBe(422);
  });

  it("T4 — format=xlsx sin dateFrom/dateTo → ValidationError (422)", async () => {
    const res = await GET(
      makeRequest({ format: "xlsx", contactId: "contact-1" }),
      { params: makeParams() },
    );
    expect(res.status).toBe(422);
  });
});

describe("GET /api/.../contact-ledger — RBAC (T5)", () => {
  it("T5 — sin permission `reports:read` → 403 ForbiddenError", async () => {
    mockRequirePermission.mockRejectedValue(
      new ForbiddenError("Forbidden", "FORBIDDEN"),
    );
    const res = await GET(makeRequest({ format: "json" }), {
      params: makeParams(),
    });
    expect(res.status).toBe(403);
  });

  it("T5b — requirePermission called with (resource='reports', action='read', orgSlug)", async () => {
    await GET(makeRequest({ format: "json" }), { params: makeParams("acme") });
    expect(mockRequirePermission).toHaveBeenCalledWith(
      "reports",
      "read",
      "acme",
    );
  });
});

describe("GET /api/.../contact-ledger — PDF/XLSX wiring (T6, T7) — C7 GREEN", () => {
  it("T6 — format=pdf + contactId + rango → 200 + application/pdf inline", async () => {
    const res = await GET(
      makeRequest({
        format: "pdf",
        contactId: "contact-1",
        dateFrom: "2025-01-01",
        dateTo: "2025-01-31",
      }),
      { params: makeParams() },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toContain("inline");
    expect(res.headers.get("content-disposition")).toContain(".pdf");
    expect(mockExportPdf).toHaveBeenCalled();
  });

  it("T7 — format=xlsx + contactId + rango → 200 + xlsx mime attachment", async () => {
    const res = await GET(
      makeRequest({
        format: "xlsx",
        contactId: "contact-1",
        dateFrom: "2025-01-01",
        dateTo: "2025-01-31",
      }),
      { params: makeParams() },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(res.headers.get("content-disposition")).toContain(".xlsx");
    expect(mockExportXlsx).toHaveBeenCalled();
  });

  it("T6b — PDF branch fetches logo via fetchLogoAsDataUrl con orgMeta.logoUrl", async () => {
    mockGetOrgMetadata.mockResolvedValue({
      ...fakeOrgMeta,
      logoUrl: "https://blob.example.com/logo.png",
    });
    await GET(
      makeRequest({
        format: "pdf",
        contactId: "contact-1",
        dateFrom: "2025-01-01",
        dateTo: "2025-01-31",
      }),
      { params: makeParams() },
    );
    expect(mockFetchLogoAsDataUrl).toHaveBeenCalledWith(
      "https://blob.example.com/logo.png",
    );
  });

  it("T7b — XLSX branch NO fetchea logo (no embebido en xlsx)", async () => {
    await GET(
      makeRequest({
        format: "xlsx",
        contactId: "contact-1",
        dateFrom: "2025-01-01",
        dateTo: "2025-01-31",
      }),
      { params: makeParams() },
    );
    expect(mockFetchLogoAsDataUrl).not.toHaveBeenCalled();
  });
});

describe("route module — runtime config", () => {
  it("exports runtime = 'nodejs' (pdfmake/exceljs need Buffer)", () => {
    expect(runtime).toBe("nodejs");
  });
});

// Surface unused import para tsc clean — ValidationError es importado pero
// no asertado directamente (handleError mock mapea statusCode → response status).
void ValidationError;
