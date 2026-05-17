/**
 * F3 C3.0/C3.1 — DocumentsService.upload DOCX extraction (REQ-37).
 *
 * Paired sister: documents.service.error-propagation.test.ts (PDF branch).
 * Mock target: `mammoth` boundary-mocked; service calls `mammoth.extractRawText({ buffer })`.
 *
 * Expected RED failure (pre-GREEN): no DOCX branch in upload switch — the
 * indexDocument call receives `null`/the original `content` arg, NOT the
 * mammoth-extracted text. The first assertion (indexed text equality) fails.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockExtractRawText,
  mockIndexDocument,
  mockRagDeleteByDocument,
} = vi.hoisted(() => ({
  mockExtractRawText: vi.fn(),
  mockIndexDocument: vi.fn(),
  mockRagDeleteByDocument: vi.fn(),
}));

vi.mock("mammoth", () => ({
  default: { extractRawText: mockExtractRawText },
  extractRawText: mockExtractRawText,
}));

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

describe("DocumentsService.upload — DOCX extraction (REQ-37)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIndexDocument.mockResolvedValue(undefined);
    mockExtractRawText.mockResolvedValue({
      value: "DOCX BODY TEXTO EXTRAÍDO",
      messages: [],
    });
  });

  it("extracts text via mammoth.extractRawText and feeds it to RAG indexing", async () => {
    const repo = buildRepo();
    const blob = new StubBlobStorage();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new DocumentsService(repo as any, blob, new RagService());

    const result = await service.upload(
      CLERK_ORG_ID,
      CLERK_USER_ID,
      "doc.docx",
      null,
      buildDocxFile(),
    );

    expect(result.id).toBe(DOC_ID);
    expect(mockExtractRawText).toHaveBeenCalledTimes(1);
    expect(mockIndexDocument).toHaveBeenCalledWith(
      DOC_ID,
      ORG_ID,
      "ORGANIZATION",
      "DOCX BODY TEXTO EXTRAÍDO",
    );
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ content: "DOCX BODY TEXTO EXTRAÍDO" }),
    );
  });
});
