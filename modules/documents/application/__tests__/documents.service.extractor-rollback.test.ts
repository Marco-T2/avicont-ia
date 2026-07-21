/**
 * F3 C3.4/C3.5 — DOCX extractor failure triggers saga rollback (REQ-39).
 *
 * Paired sister: documents.service.error-propagation.test.ts (PDF parser
 * rollback). Same contract: parser throws → ValidationError with literal
 * Spanish "No se pudo procesar el archivo" → no Document row, no chunks,
 * blob cleaned up.
 *
 * NOTE on literal string: PDF uses "No se pudo procesar el PDF" (file-type
 * specific); DOCX path uses REQ-39's "No se pudo procesar el archivo".
 *
 * Scope-locked 2026-05-17: XLSX scenario retired alongside upload format
 * reduction to PDF + DOCX + TXT (REQ-37 XLSX scope retired, REQ-38 RETIRED).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ValidationError } from "@/modules/shared/domain/errors";

const {
  mockConvertToMarkdown,
  mockIndexDocument,
  mockRagDeleteByDocument,
} = vi.hoisted(() => ({
  mockConvertToMarkdown: vi.fn(),
  mockIndexDocument: vi.fn(),
  mockRagDeleteByDocument: vi.fn(),
}));

vi.mock("mammoth", () => ({
  default: { convertToMarkdown: mockConvertToMarkdown },
  convertToMarkdown: mockConvertToMarkdown,
}));

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  getDocument: vi.fn(),
  GlobalWorkerOptions: {},
}));

import { DocumentsService } from "@/modules/documents/application/documents.service";
import type { DocumentIndexingPort } from "@/modules/documents/domain/ports/document-indexing.port";

const CLERK_ORG_ID = "clerk_org_1";
const CLERK_USER_ID = "clerk_user_1";
const ORG_ID = "org_db_1";
const USER_ID = "user_db_1";
const BLOB_URL = "https://blob.example/corrupt.bin";
const DOC_ID = "doc_corrupt_1";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

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


// poc-rag-hex C2 — DocumentsService now takes a DocumentIndexingPort.
// The old module-mock of the rag presentation barrel, plus the stub class it
// exposed, were DELETED rather than repointed: documents.service.ts no longer
// imports that barrel at all, so the mock intercepted nothing. The same
// hoisted spies are wired straight into a port-shaped stub below.
// (Deliberately no literal mock-call text in this prose — the shape sentinels
// match specifiers with line-anchored regexes and would read a comment as code.)
const ragIndexingStub: DocumentIndexingPort = {
  indexDocument: mockIndexDocument,
  deleteByDocument: mockRagDeleteByDocument,
};

describe("DocumentsService.upload — extractor failure rollback (REQ-39)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIndexDocument.mockResolvedValue(undefined);
  });

  it("corrupt DOCX: throws ValidationError with REQ-39 literal, rolls back blob, never creates doc", async () => {
    mockConvertToMarkdown.mockRejectedValue(new Error("DOCX zip is invalid"));
    const repo = buildRepo();
    const blob = new StubBlobStorage();
    const service = new DocumentsService(repo as any, blob, ragIndexingStub);

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
});
