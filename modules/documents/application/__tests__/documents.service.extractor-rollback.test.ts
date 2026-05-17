/**
 * F3 C3.4/C3.5 — DOCX/XLSX extractor failures trigger saga rollback (REQ-39).
 *
 * Paired sister: documents.service.error-propagation.test.ts (PDF parser
 * rollback). Same contract: parser throws → ValidationError with literal
 * Spanish "No se pudo procesar el archivo" → no Document row, no chunks,
 * blob cleaned up.
 *
 * NOTE on literal string: PDF uses "No se pudo procesar el PDF" (file-type
 * specific); the new DOCX/XLSX path uses REQ-39's "No se pudo procesar el
 * archivo" (generic, since spec REQ-39 names this exact string).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ValidationError } from "@/features/shared/errors";

const {
  mockExtractRawText,
  mockIndexDocument,
  mockRagDeleteByDocument,
  workbookFactory,
} = vi.hoisted(() => ({
  mockExtractRawText: vi.fn(),
  mockIndexDocument: vi.fn(),
  mockRagDeleteByDocument: vi.fn(),
  workbookFactory: { fn: (): unknown[] => [], shouldThrow: false as boolean },
}));

vi.mock("mammoth", () => ({
  default: { extractRawText: mockExtractRawText },
  extractRawText: mockExtractRawText,
}));

vi.mock("exceljs", () => {
  class Workbook {
    worksheets: unknown[] = [];
    private _sheets: unknown[] = [];
    xlsx = {
      load: vi.fn(async () => {
        if (workbookFactory.shouldThrow) {
          throw new Error("Invalid XLSX zip");
        }
        const sheets = workbookFactory.fn();
        this._sheets = sheets;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this as any).worksheets = sheets;
      }),
    };
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
const BLOB_URL = "https://blob.example/corrupt.bin";
const DOC_ID = "doc_corrupt_1";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
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
    create: vi.fn().mockResolvedValue({
      id: DOC_ID,
      name: "x",
      fileUrl: BLOB_URL,
      user: { name: "Tester" },
    }),
    delete: vi.fn().mockResolvedValue(undefined),
    findAll: vi.fn(),
    findById: vi.fn(),
    findByIdWithMembers: vi.fn(),
    findForAnalysis: vi.fn(),
    updateAnalysis: vi.fn(),
  };
}

class StubBlobStorage {
  upload = vi.fn(async () => ({ url: BLOB_URL, pathname: "test/corrupt.bin" }));
  del = vi.fn(async () => {});
}

describe("DocumentsService.upload — extractor failure rollback (REQ-39)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workbookFactory.shouldThrow = false;
    mockIndexDocument.mockResolvedValue(undefined);
  });

  it("corrupt DOCX: throws ValidationError with REQ-39 literal, rolls back blob, never creates doc", async () => {
    mockExtractRawText.mockRejectedValue(new Error("DOCX zip is invalid"));
    const repo = buildRepo();
    const blob = new StubBlobStorage();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new DocumentsService(repo as any, blob, new RagService());

    const file = new File([new Uint8Array(2048)], "corrupt.docx", {
      type: DOCX_MIME,
    });

    const err = await service
      .upload(CLERK_ORG_ID, CLERK_USER_ID, "corrupt.docx", null, file)
      .catch((e) => e);

    expect(err).toBeInstanceOf(ValidationError);
    expect((err as Error).message).toBe("No se pudo procesar el archivo");
    expect(repo.create).not.toHaveBeenCalled();
    expect(mockIndexDocument).not.toHaveBeenCalled();
    expect(blob.del).toHaveBeenCalledWith(BLOB_URL);
  });

  it("corrupt XLSX: throws ValidationError with REQ-39 literal, rolls back blob, never creates doc", async () => {
    workbookFactory.shouldThrow = true;
    const repo = buildRepo();
    const blob = new StubBlobStorage();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new DocumentsService(repo as any, blob, new RagService());

    const file = new File([new Uint8Array(2048)], "corrupt.xlsx", {
      type: XLSX_MIME,
    });

    const err = await service
      .upload(CLERK_ORG_ID, CLERK_USER_ID, "corrupt.xlsx", null, file)
      .catch((e) => e);

    expect(err).toBeInstanceOf(ValidationError);
    expect((err as Error).message).toBe("No se pudo procesar el archivo");
    expect(repo.create).not.toHaveBeenCalled();
    expect(mockIndexDocument).not.toHaveBeenCalled();
    expect(blob.del).toHaveBeenCalledWith(BLOB_URL);
  });
});
