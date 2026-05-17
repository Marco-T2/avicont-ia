/**
 * F3 C3.6/C3.7 — 5MB extraction size guard for DOCX/XLSX (RESOLVED-3).
 *
 * Files >5MB but ≤50MB (outer MAX_FILE_SIZE) MUST NOT crash or block the
 * event loop on sync mammoth/exceljs parsing. Instead the extractor
 * short-circuits: returns null (no indexed content) and emits a warning
 * log. The Document row is still persisted so the file is downloadable;
 * it's simply absent from RAG search.
 *
 * Worker-thread offload is out-of-scope this SDD (design Risk 1,
 * RESOLVED-3).
 *
 * Expected RED failure (pre-GREEN): no size-guard branch — mammoth /
 * exceljs are called on the oversized buffer (mocks observe the call)
 * AND the indexDocument mock is invoked with content (parsed text).
 * After GREEN: extractor short-circuits before lib call; content is
 * null; indexDocument is NOT called (extractedContent.length > 10
 * check fails for null).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockExtractRawText, mockIndexDocument, mockWorkbookLoad } = vi.hoisted(
  () => ({
    mockExtractRawText: vi.fn(),
    mockIndexDocument: vi.fn(),
    mockWorkbookLoad: vi.fn(),
  }),
);

vi.mock("mammoth", () => ({
  default: { extractRawText: mockExtractRawText },
  extractRawText: mockExtractRawText,
}));

vi.mock("exceljs", () => {
  class Workbook {
    worksheets: unknown[] = [];
    xlsx = { load: mockWorkbookLoad };
    eachSheet(_cb: (s: unknown, id: number) => void) {}
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
    deleteByDocument = vi.fn();
  },
}));

import { DocumentsService } from "@/modules/documents/application/documents.service";
import { RagService } from "@/features/documents/rag/server";

const CLERK_ORG_ID = "clerk_org_1";
const CLERK_USER_ID = "clerk_user_1";
const ORG_ID = "org_db_1";
const USER_ID = "user_db_1";
const BLOB_URL = "https://blob.example/big.bin";
const DOC_ID = "doc_big_1";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const FIVE_MB = 5 * 1024 * 1024;
const SIX_MB = 6 * 1024 * 1024;

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
    create: vi.fn().mockImplementation(
      async (input: { content: string | null }) => ({
        id: DOC_ID,
        name: "big.bin",
        fileUrl: BLOB_URL,
        user: { name: "Tester" },
        content: input.content,
      }),
    ),
    delete: vi.fn().mockResolvedValue(undefined),
    findAll: vi.fn(),
    findById: vi.fn(),
    findByIdWithMembers: vi.fn(),
    findForAnalysis: vi.fn(),
    updateAnalysis: vi.fn(),
  };
}

class StubBlobStorage {
  upload = vi.fn(async () => ({ url: BLOB_URL, pathname: "test/big.bin" }));
  del = vi.fn(async () => {});
}

describe("DocumentsService.upload — 5MB extraction size guard (RESOLVED-3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIndexDocument.mockResolvedValue(undefined);
    mockExtractRawText.mockResolvedValue({ value: "should not be called", messages: [] });
    mockWorkbookLoad.mockResolvedValue(undefined);
  });

  it("DOCX >5MB short-circuits: mammoth NOT called, content null, document still persists", async () => {
    const repo = buildRepo();
    const blob = new StubBlobStorage();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new DocumentsService(repo as any, blob, new RagService());

    const file = new File([new Uint8Array(SIX_MB)], "big.docx", { type: DOCX_MIME });
    const result = await service.upload(CLERK_ORG_ID, CLERK_USER_ID, "big.docx", null, file);

    expect(result.id).toBe(DOC_ID);
    expect(mockExtractRawText).not.toHaveBeenCalled();
    // Doc row persisted with null content — RAG indexing skipped (no text > 10 chars).
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ content: null }),
    );
    expect(mockIndexDocument).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("XLSX >5MB short-circuits: exceljs NOT called, content null, document still persists", async () => {
    const repo = buildRepo();
    const blob = new StubBlobStorage();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new DocumentsService(repo as any, blob, new RagService());

    const file = new File([new Uint8Array(SIX_MB)], "big.xlsx", { type: XLSX_MIME });
    const result = await service.upload(CLERK_ORG_ID, CLERK_USER_ID, "big.xlsx", null, file);

    expect(result.id).toBe(DOC_ID);
    expect(mockWorkbookLoad).not.toHaveBeenCalled();
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ content: null }),
    );
    expect(mockIndexDocument).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("DOCX exactly at 5MB threshold still parses (boundary: only strictly > triggers guard)", async () => {
    const repo = buildRepo();
    const blob = new StubBlobStorage();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new DocumentsService(repo as any, blob, new RagService());

    const file = new File([new Uint8Array(FIVE_MB)], "edge.docx", { type: DOCX_MIME });
    mockExtractRawText.mockResolvedValueOnce({ value: "parsed body content", messages: [] });

    await service.upload(CLERK_ORG_ID, CLERK_USER_ID, "edge.docx", null, file);

    expect(mockExtractRawText).toHaveBeenCalledTimes(1);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ content: "parsed body content" }),
    );
  });
});
