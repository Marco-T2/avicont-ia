/**
 * Audit H #4 — documents.service error-handling boundaries
 *
 * Covers two CRITICAL findings from Audit H (2026-04-24):
 *   4.A — `extractPdfText` (L184-199) swallows parse errors and returns null,
 *         conflating "PDF has no text" (legitimate null) with "parser blew up"
 *         (should be a user-visible error).
 *   4.B — `ragService.indexDocument` (L128-130) is fire-and-forget with
 *         `.catch(console.error)`. A failed indexing leaves the document in
 *         the DB without embeddings — invisible to RAG search, no alarm.
 *
 * Fix: await the indexing, propagate both parse and indexing failures, and
 * compensate with blob + document rollback so callers never see a partially
 * persisted document.
 *
 * Expected failure mode on current (pre-fix) code:
 *   - Corrupt PDF → upload() RESOLVES with a document whose content is null.
 *     Test expects ValidationError + no document persisted.
 *   - indexDocument rejection → upload() RESOLVES normally (fire-and-forget
 *     eats the error). Test expects the error to propagate + blob+doc deleted.
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

vi.mock("@/lib/blob", () => ({
  uploadToBlob: mockUploadToBlob,
  deleteFromBlob: mockDeleteFromBlob,
}));

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  getDocument: mockGetDocument,
  GlobalWorkerOptions: {},
}));

vi.mock("@/features/rag/server", () => ({
  RagService: class {
    indexDocument = mockIndexDocument;
    deleteByDocument = mockRagDeleteByDocument;
  },
}));

import { DocumentsService } from "../documents.service";

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

function buildPdfFile(): File {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "test.pdf", {
    type: "application/pdf",
  });
}

describe("DocumentsService.upload — error-handling boundary (Audit H #4)", () => {
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new DocumentsService(repo as any);

      const result = await service.upload(
        CLERK_ORG_ID,
        CLERK_USER_ID,
        "doc name",
        null,
        buildPdfFile(),
      );

      expect(result.id).toBe(DOC_ID);
      expect(repo.create).toHaveBeenCalledTimes(1);
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new DocumentsService(repo as any);

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
      // Blob leak prevented — compensating cleanup ran.
      expect(mockDeleteFromBlob).toHaveBeenCalledWith(BLOB_URL);
    });
  });

  describe("4.B — RAG embedding", () => {
    it("rolls back document and blob when indexDocument fails (PDF path)", async () => {
      mockIndexDocument.mockRejectedValue(new Error("Embedding provider down"));
      const repo = buildRepo();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new DocumentsService(repo as any);

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
      // Blob cleanup too.
      expect(mockDeleteFromBlob).toHaveBeenCalledWith(BLOB_URL);
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new DocumentsService(repo as any);

      await expect(
        service.upload(
          CLERK_ORG_ID,
          CLERK_USER_ID,
          "text note",
          "This is a plain text note long enough to trigger indexing.",
        ),
      ).rejects.toThrow("Embedding provider down");

      expect(repo.delete).toHaveBeenCalledWith(DOC_ID, ORG_ID);
      expect(mockDeleteFromBlob).not.toHaveBeenCalled();
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new DocumentsService(repo as any);

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
