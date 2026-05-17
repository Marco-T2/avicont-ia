/**
 * F6 C6.4 (α-reindex-lock-release sentinel) — REQ-48 SCN-48.1/48.2/48.3.
 *
 * Locks the service-level concurrency contract:
 *   - Second concurrent reindex for the same org throws ConflictError
 *     with the Spanish copy "Reindexación en curso para esta organización"
 *     (mapped to HTTP 409 by the route handler).
 *   - Different orgs run in parallel without interference.
 *   - Lock is released even when the underlying reindex throws — a
 *     subsequent reindex for the same org proceeds.
 *
 * Uses the real InMemoryReindexLock (not a mock) so the test stresses the
 * actual Set-backed adapter wiring exactly as the composition root delivers
 * it to production.
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
import { InMemoryReindexLock } from "@/modules/documents/infrastructure/in-memory-reindex-lock";
import { ConflictError } from "@/features/shared/errors";

const CLERK_USER_ID = "clerk_user_1";
const ORG_A = "org_a";
const ORG_B = "org_b";
const DOC_A1 = "doc_a_1";
const DOC_A2 = "doc_a_2";
const DOC_B1 = "doc_b_1";

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

function docFor(id: string, orgId: string) {
  return {
    id,
    organizationId: orgId,
    scope: "ORGANIZATION",
    content: "long enough content to index",
    organization: { members: [{ id: "m1" }] },
  };
}

describe("DocumentsService.reindex — per-org concurrency (REQ-48)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRagDeleteByDocument.mockResolvedValue(undefined);
    mockIndexDocument.mockResolvedValue(undefined);
  });

  it("SCN-48.1: second concurrent reindex for same org throws ConflictError", async () => {
    const repo = buildRepo();
    repo.findByIdWithMembers.mockImplementation(async (id: string) => {
      if (id === DOC_A1) return docFor(DOC_A1, ORG_A);
      if (id === DOC_A2) return docFor(DOC_A2, ORG_A);
      return null;
    });

    // Hold up the first reindex's pipeline so the second one races it.
    let releaseFirst: () => void = () => {};
    mockIndexDocument.mockImplementationOnce(
      () => new Promise<void>((resolve) => (releaseFirst = resolve)),
    );

    const lock = new InMemoryReindexLock();
    const service = new DocumentsService(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      repo as any,
      new StubBlobStorage(),
      new RagService(),
      undefined,
      lock,
    );

    const first = service.reindex(DOC_A1, CLERK_USER_ID);
    // give the first call time to acquire the lock before the second races
    await new Promise((r) => setImmediate(r));

    await expect(service.reindex(DOC_A2, CLERK_USER_ID)).rejects.toThrow(
      ConflictError,
    );
    await expect(service.reindex(DOC_A2, CLERK_USER_ID)).rejects.toThrow(
      /Reindexación en curso/,
    );

    releaseFirst();
    await first;
  });

  it("SCN-48.2: different orgs run in parallel", async () => {
    const repo = buildRepo();
    repo.findByIdWithMembers.mockImplementation(async (id: string) => {
      if (id === DOC_A1) return docFor(DOC_A1, ORG_A);
      if (id === DOC_B1) return docFor(DOC_B1, ORG_B);
      return null;
    });

    const lock = new InMemoryReindexLock();
    const service = new DocumentsService(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      repo as any,
      new StubBlobStorage(),
      new RagService(),
      undefined,
      lock,
    );

    const [a, b] = await Promise.all([
      service.reindex(DOC_A1, CLERK_USER_ID),
      service.reindex(DOC_B1, CLERK_USER_ID),
    ]);

    expect(a.chunkCount).toBeGreaterThan(0);
    expect(b.chunkCount).toBeGreaterThan(0);
  });

  it("SCN-48.3: lock releases on failure — next reindex proceeds", async () => {
    const repo = buildRepo();
    repo.findByIdWithMembers.mockImplementation(async () =>
      docFor(DOC_A1, ORG_A),
    );

    mockIndexDocument
      .mockRejectedValueOnce(new Error("pipeline boom"))
      .mockResolvedValueOnce(undefined);

    const lock = new InMemoryReindexLock();
    const service = new DocumentsService(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      repo as any,
      new StubBlobStorage(),
      new RagService(),
      undefined,
      lock,
    );

    await expect(service.reindex(DOC_A1, CLERK_USER_ID)).rejects.toThrow(
      "pipeline boom",
    );
    // The lock MUST have released; second call should NOT throw ConflictError.
    await expect(service.reindex(DOC_A1, CLERK_USER_ID)).resolves.toEqual({
      chunkCount: expect.any(Number),
    });
  });
});
