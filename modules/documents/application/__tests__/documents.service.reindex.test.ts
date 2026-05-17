/**
 * F6 C6.1 RED → GREEN — DocumentsService.reindex (REQ-47).
 *
 * Locks the contract:
 *   - reindex(documentId, clerkUserId) RBAC mirrors delete: NotFoundError when
 *     the doc is missing, ForbiddenError when the user is not a member of the
 *     doc's org.
 *   - Happy path: calls ragService.deleteByDocument(docId) THEN
 *     ragService.indexDocument(docId, orgId, scope, content). Returns
 *     { chunkCount }.
 *   - Doc without content (null or <=10 chars): returns { chunkCount: 0 }
 *     and does NOT call indexDocument (delete is still safe to call).
 *
 * F6 MVP scope: re-extraction from the file blob is OUT — the method re-uses
 * the persisted Document.content (per orchestrator brief). Blob re-download
 * is deferred tech-debt.
 *
 * Expected RED failure (pre-GREEN): DocumentsService has no `reindex` method,
 * so `service.reindex(...)` throws `service.reindex is not a function` for
 * every it() before any assertion runs.
 *
 * Mock hygiene per [[mock_hygiene_commit_scope]]: RagService is mocked at the
 * module boundary (matches the F5 tags-attachment test fake shape). No
 * constructor signature change.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockIndexDocument, mockRagDeleteByDocument } = vi.hoisted(() => ({
  mockIndexDocument: vi.fn(),
  mockRagDeleteByDocument: vi.fn(),
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
import { NotFoundError, ForbiddenError } from "@/features/shared/errors";

const CLERK_USER_ID = "clerk_user_1";
const ORG_ID = "org_db_1";
const DOC_ID = "doc_reindex_1";

function buildRepo() {
  return {
    findAll: vi.fn(),
    findById: vi.fn(),
    findByIdWithMembers: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    findOrgByClerkId: vi.fn(),
    findUserWithMembership: vi.fn(),
    findForAnalysis: vi.fn(),
    updateAnalysis: vi.fn(),
  };
}

class StubBlobStorage {
  upload = vi.fn();
  del = vi.fn();
}

describe("DocumentsService.reindex (REQ-47)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIndexDocument.mockResolvedValue(undefined);
    mockRagDeleteByDocument.mockResolvedValue(undefined);
  });

  it("re-runs the RAG pipeline (delete then index) and returns chunkCount", async () => {
    const repo = buildRepo();
    repo.findByIdWithMembers.mockResolvedValue({
      id: DOC_ID,
      organizationId: ORG_ID,
      scope: "ORGANIZATION",
      content: "long enough content to index in RAG pipeline",
      organization: { members: [{ id: "m1" }] },
    });
    const service = new DocumentsService(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      repo as any,
      new StubBlobStorage(),
      new RagService(),
    );

    const result = await service.reindex(DOC_ID, CLERK_USER_ID);

    expect(mockRagDeleteByDocument).toHaveBeenCalledWith(DOC_ID);
    expect(mockIndexDocument).toHaveBeenCalledWith(
      DOC_ID,
      ORG_ID,
      "ORGANIZATION",
      "long enough content to index in RAG pipeline",
    );
    // chunkCount is opaque (RagService is mocked) — what matters is the shape.
    expect(result).toEqual({ chunkCount: expect.any(Number) });
    // Order matters: delete BEFORE index.
    const deleteOrder = mockRagDeleteByDocument.mock.invocationCallOrder[0];
    const indexOrder = mockIndexDocument.mock.invocationCallOrder[0];
    expect(deleteOrder).toBeLessThan(indexOrder);
  });

  it("throws NotFoundError when the document does not exist", async () => {
    const repo = buildRepo();
    repo.findByIdWithMembers.mockResolvedValue(null);
    const service = new DocumentsService(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      repo as any,
      new StubBlobStorage(),
      new RagService(),
    );

    await expect(service.reindex(DOC_ID, CLERK_USER_ID)).rejects.toThrow(
      NotFoundError,
    );
    expect(mockRagDeleteByDocument).not.toHaveBeenCalled();
    expect(mockIndexDocument).not.toHaveBeenCalled();
  });

  it("throws ForbiddenError when caller is not a member of the doc's org", async () => {
    const repo = buildRepo();
    repo.findByIdWithMembers.mockResolvedValue({
      id: DOC_ID,
      organizationId: ORG_ID,
      scope: "ORGANIZATION",
      content: "valid content",
      organization: { members: [] }, // no membership
    });
    const service = new DocumentsService(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      repo as any,
      new StubBlobStorage(),
      new RagService(),
    );

    await expect(service.reindex(DOC_ID, CLERK_USER_ID)).rejects.toThrow(
      ForbiddenError,
    );
    expect(mockRagDeleteByDocument).not.toHaveBeenCalled();
    expect(mockIndexDocument).not.toHaveBeenCalled();
  });

  it("returns chunkCount 0 and does not call indexDocument when content is missing/short", async () => {
    const repo = buildRepo();
    repo.findByIdWithMembers.mockResolvedValue({
      id: DOC_ID,
      organizationId: ORG_ID,
      scope: "ORGANIZATION",
      content: null,
      organization: { members: [{ id: "m1" }] },
    });
    const service = new DocumentsService(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      repo as any,
      new StubBlobStorage(),
      new RagService(),
    );

    const result = await service.reindex(DOC_ID, CLERK_USER_ID);

    // delete is safe to call even when there is nothing indexed (idempotent).
    expect(mockRagDeleteByDocument).toHaveBeenCalledWith(DOC_ID);
    expect(mockIndexDocument).not.toHaveBeenCalled();
    expect(result).toEqual({ chunkCount: 0 });
  });
});
