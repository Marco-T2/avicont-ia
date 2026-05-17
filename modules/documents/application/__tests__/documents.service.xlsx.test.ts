/**
 * F3 C3.2/C3.3 — DocumentsService.upload XLSX extraction (REQ-38).
 *
 * Paired sister: documents.service.docx.test.ts. Mock target: `exceljs`
 * boundary-mocked. Service calls `new ExcelJS.Workbook().xlsx.load(buffer)`
 * then iterates worksheets and emits `=== {sheet} ===\n<rows>` per sheet,
 * joined by `\n\n`.
 *
 * Expected RED failure (pre-GREEN): no XLSX branch in upload switch — the
 * exceljs Workbook mock is never instantiated; the first assertion
 * (mockLoad called) fails.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockIndexDocument, mockRagDeleteByDocument, workbookFactory } =
  vi.hoisted(() => {
    type Row = { values: unknown[] };
    type Sheet = {
      name: string;
      rowCount: number;
      eachRow: (cb: (r: Row, n: number) => void) => void;
    };

    // The factory is mutated per-test via `workbookFactory.fn = ...` to control
    // which sheets the next `new Workbook().xlsx.load(buffer)` will produce.
    const factory: { fn: () => Sheet[] } = { fn: () => [] };

    return {
      mockIndexDocument: vi.fn(),
      mockRagDeleteByDocument: vi.fn(),
      workbookFactory: factory,
    };
  });

vi.mock("exceljs", () => {
  // Workbook instance binds eachSheet + worksheets at load() time using the
  // factory closure — sidesteps the `this`-binding pitfall when caller
  // invokes `workbook.xlsx.load(buf)` (where `this === workbook.xlsx`).
  class Workbook {
    worksheets: unknown[] = [];
    private _sheets: unknown[] = [];
    xlsx: { load: (buf: unknown) => Promise<void> };
    constructor() {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const wb = this;
      this.xlsx = {
        load: vi.fn(async (_buf: unknown) => {
          const sheets = workbookFactory.fn();
          wb._sheets = sheets;
          wb.worksheets = sheets;
        }),
      };
    }
    eachSheet(cb: (s: unknown, id: number) => void) {
      this._sheets.forEach((s, i) => cb(s, i + 1));
    }
  }
  return { default: { Workbook }, Workbook };
});

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  getDocument: vi.fn(),
  GlobalWorkerOptions: {},
}));

vi.mock("mammoth", () => ({
  default: { extractRawText: vi.fn() },
  extractRawText: vi.fn(),
}));

vi.mock("@/features/documents/rag/server", () => ({
  RagService: class {
    indexDocument = mockIndexDocument;
    deleteByDocument = mockRagDeleteByDocument;
  },
}));

import { DocumentsService } from "@/modules/documents/application/documents.service";
import { RagService } from "@/features/documents/rag/server";

const CLERK_ORG_ID = "clerk_org_1";
const CLERK_USER_ID = "clerk_user_1";
const ORG_ID = "org_db_1";
const USER_ID = "user_db_1";
const BLOB_URL = "https://blob.example/test.xlsx";
const DOC_ID = "doc_xlsx_1";
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function buildRepo() {
  return {
    findOrgByClerkId: vi.fn().mockResolvedValue({
      id: ORG_ID,
      name: "Test Org",
      clerkOrgId: CLERK_ORG_ID,
    }),
    findUserWithMembership: vi.fn().mockResolvedValue({
      id: USER_ID,
      memberships: [{ role: "admin" }],
    }),
    create: vi.fn().mockImplementation(async (input: { content: string | null }) => ({
      id: DOC_ID,
      name: "test.xlsx",
      fileUrl: BLOB_URL,
      user: { name: "Tester" },
      content: input.content,
    })),
    delete: vi.fn().mockResolvedValue(undefined),
    findAll: vi.fn(),
    findById: vi.fn(),
    findByIdWithMembers: vi.fn(),
    findForAnalysis: vi.fn(),
    updateAnalysis: vi.fn(),
  };
}

class StubBlobStorage {
  upload = vi.fn(async () => ({ url: BLOB_URL, pathname: "test/test.xlsx" }));
  del = vi.fn(async () => {});
}

function buildXlsxFile(size = 2048): File {
  return new File([new Uint8Array(size)], "test.xlsx", { type: XLSX_MIME });
}

describe("DocumentsService.upload — XLSX extraction (REQ-38)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIndexDocument.mockResolvedValue(undefined);
    // Default workbook: two sheets with mixed cell types (Date, number).
    workbookFactory.fn = () => [
      {
        name: "Cuentas",
        rowCount: 2,
        eachRow(cb: (r: { values: unknown[] }, n: number) => void) {
          cb({ values: [undefined, "Código", "Nombre"] }, 1);
          cb({ values: [undefined, "1.01", "Caja"] }, 2);
        },
      },
      {
        name: "Saldos",
        rowCount: 1,
        eachRow(cb: (r: { values: unknown[] }, n: number) => void) {
          cb(
            {
              values: [undefined, new Date("2026-01-15T00:00:00Z"), 1000],
            },
            1,
          );
        },
      },
    ];
  });

  it("flattens multi-sheet workbook to '=== Sheet ===\\n<rows>' joined by blank lines", async () => {
    const repo = buildRepo();
    const blob = new StubBlobStorage();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new DocumentsService(repo as any, blob, new RagService());

    await service.upload(
      CLERK_ORG_ID,
      CLERK_USER_ID,
      "saldos.xlsx",
      null,
      buildXlsxFile(),
    );

    const created = (repo.create.mock.calls[0]?.[0] ?? {}) as { content?: string | null };
    const content = created.content ?? "";
    expect(content).toContain("=== Cuentas ===");
    expect(content).toContain("=== Saldos ===");
    // Tab-joined cells within a row (REQ-38 format)
    expect(content).toContain("Código\tNombre");
    expect(content).toContain("1.01\tCaja");
    // Date cell flattened via toISOString
    expect(content).toContain("2026-01-15T00:00:00.000Z");
    // Numeric cell rendered
    expect(content).toContain("1000");
    // Sheets separated by blank line
    expect(content).toMatch(/=== Cuentas ===[\s\S]*\n\n=== Saldos ===/);
  });
});
