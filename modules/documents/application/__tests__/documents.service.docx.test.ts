/**
 * F3 C3.0/C3.1 — DocumentsService.upload DOCX extraction (REQ-37).
 *
 * Paired sister: documents.service.error-propagation.test.ts (PDF branch).
 * Mock target: `mammoth` boundary-mocked; service calls `mammoth.convertToMarkdown({ buffer })`
 * (markdown preserves `# H1` headings so the F2 chunker REQ-33 detector picks them up).
 *
 * Expected RED failure (pre-GREEN): no DOCX branch in upload switch — the
 * indexDocument call receives `null`/the original `content` arg, NOT the
 * mammoth-extracted text. The first assertion (indexed text equality) fails.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

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
const BLOB_URL = "https://blob.example/test.docx";
const DOC_ID = "doc_docx_1";
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
      name: "test.docx",
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
  upload = vi.fn(async () => ({ url: BLOB_URL, pathname: "test/test.docx" }));
  del = vi.fn(async () => {});
}

function buildDocxFile(size = 1024): File {
  // Real DOCX magic bytes aren't required because mammoth is fully mocked.
  return new File([new Uint8Array(size)], "test.docx", { type: DOCX_MIME });
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

describe("DocumentsService.upload — DOCX extraction (REQ-37)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIndexDocument.mockResolvedValue(undefined);
    mockConvertToMarkdown.mockResolvedValue({
      value: "# Heading\n\nDOCX BODY TEXTO EXTRAÍDO",
      messages: [],
    });
  });

  it("extracts markdown via mammoth.convertToMarkdown and feeds it to RAG indexing", async () => {
    const repo = buildRepo();
    const blob = new StubBlobStorage();
    const service = new DocumentsService(repo as any, blob, ragIndexingStub);

    const result = await service.upload(
      CLERK_ORG_ID,
      CLERK_USER_ID,
      "doc.docx",
      null,
      buildDocxFile(),
    );

    expect(result.id).toBe(DOC_ID);
    expect(mockConvertToMarkdown).toHaveBeenCalledTimes(1);
    expect(mockIndexDocument).toHaveBeenCalledWith(
      DOC_ID,
      ORG_ID,
      "ORGANIZATION",
      "# Heading\n\nDOCX BODY TEXTO EXTRAÍDO",
    );
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ content: "# Heading\n\nDOCX BODY TEXTO EXTRAÍDO" }),
    );
  });
});
