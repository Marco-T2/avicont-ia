/**
 * Audit H #4 — documents.service error-handling boundaries (RELOCATED from
 * features/documents/__tests__ → modules/documents/application/__tests__ as
 * part of poc-documents-hex C1).
 *
 * Covers two CRITICAL findings from Audit H (2026-04-24):
 *   4.A — `extractPdfText` (L184-199) swallows parse errors and returns null,
 *         conflating "PDF has no text" (legitimate null) with "parser blew up"
 *         (should be a user-visible error).
 *   4.B — `ragService.indexDocument` (L128-130) is fire-and-forget with
 *         `.catch(console.error)`. A failed indexing leaves the document in
 *         the DB without embeddings — invisible to RAG search, no alarm.
 *
 * Mock-target preservation: @/lib/blob mock kept per spec matrix (no-op now —
 * application/documents.service.ts no longer imports it; assertions on blob
 * delete are redirected to the injected FakeBlobStorage stub). @/features/
 * documents/rag/server + pdfjs-dist mock targets UNCHANGED.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ValidationError } from "@/features/shared/errors";

const {
  mockUploadToBlob,
  mockDeleteFromBlob,
  mockGetDocument,
  mockIndexDocument,
  mockRagDeleteByDocument,
} = vi.hoisted(() => ({
  mockUploadToBlob: vi.fn(),
  mockDeleteFromBlob: vi.fn(),
  mockGetDocument: vi.fn(),
  mockIndexDocument: vi.fn(),
  mockRagDeleteByDocument: vi.fn(),
}));

// Mock target retained for spec matrix preservation. Application no longer
// imports @/lib/blob; declaration is a structural no-op here.
vi.mock("@/lib/blob", () => ({
  uploadToBlob: mockUploadToBlob,
  deleteFromBlob: mockDeleteFromBlob,
}));

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  getDocument: mockGetDocument,
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
const BLOB_URL = "https://blob.example/test.pdf";
const DOC_ID = "doc_1";

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
      name: "test.pdf",
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

/** Captures blobStorage port calls so assertions can target the injected stub. */
class StubBlobStorage {
  uploadCalls: Array<{ file: File; organizationId: string; userId: string }> = [];
  delCalls: string[] = [];
  upload = vi.fn(async (file: File, organizationId: string, userId: string) => {
    this.uploadCalls.push({ file, organizationId, userId });
    return { url: BLOB_URL, pathname: "test/test.pdf" };
  });
  del = vi.fn(async (url: string) => {
    this.delCalls.push(url);
  });
}

function buildPdfFile(): File {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "test.pdf", {
    type: "application/pdf",
  });
}

describe("DocumentsService.upload — error-handling boundary (Audit H #4) — hex relocated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUploadToBlob.mockResolvedValue({ url: BLOB_URL });
    mockDeleteFromBlob.mockResolvedValue(undefined);
    mockIndexDocument.mockResolvedValue(undefined);
    // Default: PDF parses successfully and yields text "hello world hello world".
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: vi.fn().mockResolvedValue({
          getTextContent: vi.fn().mockResolvedValue({
            items: [{ str: "hello world hello world" }],
          }),
        }),
        destroy: vi.fn().mockResolvedValue(undefined),
      }),
    });
  });

  describe("4.A — PDF extraction", () => {
    it("happy path: parses PDF, creates document, indexes embeddings", async () => {
      const repo = buildRepo();
      const blob = new StubBlobStorage();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new DocumentsService(repo as any, blob, new RagService());

      const result = await service.upload(
        CLERK_ORG_ID,
        CLERK_USER_ID,
        "doc name",
        null,
        buildPdfFile(),
      );

      expect(result.id).toBe(DOC_ID);
      expect(repo.create).toHaveBeenCalledTimes(1);
      expect(blob.upload).toHaveBeenCalledTimes(1);
      expect(mockIndexDocument).toHaveBeenCalledWith(
        DOC_ID,
        ORG_ID,
        "ORGANIZATION",
        "hello world hello world",
      );
    });

    it("throws ValidationError + rolls back blob when PDF parser fails (corrupt PDF)", async () => {
      // Simulate a corrupt PDF: the parse promise rejects.
      mockGetDocument.mockReturnValue({
        promise: Promise.reject(new Error("Invalid PDF structure")),
      });
      const repo = buildRepo();
      const blob = new StubBlobStorage();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new DocumentsService(repo as any, blob, new RagService());

      await expect(
        service.upload(
          CLERK_ORG_ID,
          CLERK_USER_ID,
          "corrupt.pdf",
          null,
          buildPdfFile(),
        ),
      ).rejects.toBeInstanceOf(ValidationError);

      // No document persisted.
      expect(repo.create).not.toHaveBeenCalled();
      // Blob leak prevented — compensating cleanup ran on the injected port.
      expect(blob.del).toHaveBeenCalledWith(BLOB_URL);
    });
  });

  describe("4.B — RAG embedding", () => {
    it("rolls back document and blob when indexDocument fails (PDF path)", async () => {
      mockIndexDocument.mockRejectedValue(new Error("Embedding provider down"));
      const repo = buildRepo();
      const blob = new StubBlobStorage();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new DocumentsService(repo as any, blob, new RagService());

      await expect(
        service.upload(
          CLERK_ORG_ID,
          CLERK_USER_ID,
          "doc name",
          null,
          buildPdfFile(),
        ),
      ).rejects.toThrow("Embedding provider down");

      // The document was created, then rolled back.
      expect(repo.create).toHaveBeenCalledTimes(1);
      expect(repo.delete).toHaveBeenCalledWith(DOC_ID, ORG_ID);
      // Blob cleanup too — via injected port.
      expect(blob.del).toHaveBeenCalledWith(BLOB_URL);
    });

    it("rolls back document (no blob cleanup) when indexDocument fails on text-only upload", async () => {
      mockIndexDocument.mockRejectedValue(new Error("Embedding provider down"));
      const repo = buildRepo();
      repo.create.mockResolvedValueOnce({
        id: DOC_ID,
        name: "text note",
        fileUrl: null,
        user: { name: "Tester" },
      });
      const blob = new StubBlobStorage();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new DocumentsService(repo as any, blob, new RagService());

      await expect(
        service.upload(
          CLERK_ORG_ID,
          CLERK_USER_ID,
          "text note",
          "This is a plain text note long enough to trigger indexing.",
        ),
      ).rejects.toThrow("Embedding provider down");

      expect(repo.delete).toHaveBeenCalledWith(DOC_ID, ORG_ID);
      expect(blob.del).not.toHaveBeenCalled();
    });

    it("does not try to index when extracted content is under 10 chars", async () => {
      mockGetDocument.mockReturnValue({
        promise: Promise.resolve({
          numPages: 1,
          getPage: vi.fn().mockResolvedValue({
            getTextContent: vi
              .fn()
              .mockResolvedValue({ items: [{ str: "hi" }] }),
          }),
          destroy: vi.fn().mockResolvedValue(undefined),
        }),
      });
      const repo = buildRepo();
      const blob = new StubBlobStorage();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new DocumentsService(repo as any, blob, new RagService());

      const result = await service.upload(
        CLERK_ORG_ID,
        CLERK_USER_ID,
        "tiny.pdf",
        null,
        buildPdfFile(),
      );

      expect(result.id).toBe(DOC_ID);
      expect(mockIndexDocument).not.toHaveBeenCalled();
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });
});
