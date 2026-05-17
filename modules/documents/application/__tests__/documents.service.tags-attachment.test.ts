/**
 * F5 C5.5 RED → GREEN — DocumentsService.upload accepts tagIds (REQ-45 persist).
 *
 * Locks the wiring contract:
 *   - upload(...) accepts an optional `tagIds: string[]` param (last positional).
 *   - When tagIds is non-empty, TagsRepositoryPort.attachToDocument is invoked
 *     with the newly-created document.id and the same tagIds, after repo.create
 *     resolves and BEFORE indexDocument fires.
 *   - When tagIds is empty / undefined, attachToDocument is NOT called.
 *   - Saga rollback: if attachToDocument throws, the document row, file blob,
 *     and any partial chunks are rolled back (mirrors existing extractor-fail
 *     rollback path).
 *
 * Mock hygiene per [[mock_hygiene_commit_scope]]: the DocumentsService
 * constructor gains a 4th parameter (TagsRepositoryPort). The fake repo
 * here is built inline; existing test fakes elsewhere stay valid because
 * the new param is optional in the constructor signature (back-compat) —
 * paired sister extractor tests do not need to be touched.
 *
 * Expected RED failure (pre-GREEN):
 *   - `upload` signature has no tagIds parameter; TS allows the extra arg
 *     at runtime (positional swallow) but `attachToDocument` is never
 *     invoked, so the first assertion fails. Once the constructor gains
 *     the 4th param, the explicit `attach` count assertion fails until
 *     the wiring lands. That IS the right reason (feature not implemented).
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
import type { TagsRepositoryPort } from "@/modules/tags/domain/ports/tags-repository.port";

const CLERK_ORG_ID = "clerk_org_1";
const CLERK_USER_ID = "clerk_user_1";
const ORG_ID = "org_db_1";
const USER_ID = "user_db_1";
const DOC_ID = "doc_tags_1";

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
      name: "test.txt",
      fileUrl: null,
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
  upload = vi.fn(async () => ({ url: "https://blob/x", pathname: "x" }));
  del = vi.fn(async () => {});
}

function buildTagsRepo(): TagsRepositoryPort & {
  _attached: Array<{ documentId: string; tagIds: string[] }>;
} {
  const attached: Array<{ documentId: string; tagIds: string[] }> = [];
  return {
    _attached: attached,
    async listByOrg() {
      return [];
    },
    async findBySlugs() {
      return [];
    },
    async create() {
      throw new Error("not used by this test");
    },
    async attachToDocument(documentId: string, tagIds: string[]) {
      attached.push({ documentId, tagIds });
    },
  };
}

describe("DocumentsService.upload — tags attachment (REQ-45)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIndexDocument.mockResolvedValue(undefined);
  });

  it("attaches tagIds via TagsRepositoryPort after document creation", async () => {
    const repo = buildRepo();
    const blob = new StubBlobStorage();
    const tagsRepo = buildTagsRepo();
    const service = new DocumentsService(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      repo as any,
      blob,
      new RagService(),
      tagsRepo,
    );

    await service.upload(
      CLERK_ORG_ID,
      CLERK_USER_ID,
      "doc.txt",
      "raw content text here",
      null,
      "ORGANIZATION",
      ["t1", "t2"],
    );

    expect(tagsRepo._attached).toEqual([
      { documentId: DOC_ID, tagIds: ["t1", "t2"] },
    ]);
    expect(repo.create).toHaveBeenCalledTimes(1);
  });

  it("does NOT call attachToDocument when tagIds is empty", async () => {
    const repo = buildRepo();
    const blob = new StubBlobStorage();
    const tagsRepo = buildTagsRepo();
    const service = new DocumentsService(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      repo as any,
      blob,
      new RagService(),
      tagsRepo,
    );

    await service.upload(
      CLERK_ORG_ID,
      CLERK_USER_ID,
      "doc.txt",
      "raw content text here",
      null,
      "ORGANIZATION",
      [],
    );

    expect(tagsRepo._attached).toEqual([]);
  });

  it("does NOT call attachToDocument when tagIds is undefined (back-compat)", async () => {
    const repo = buildRepo();
    const blob = new StubBlobStorage();
    const tagsRepo = buildTagsRepo();
    const service = new DocumentsService(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      repo as any,
      blob,
      new RagService(),
      tagsRepo,
    );

    await service.upload(
      CLERK_ORG_ID,
      CLERK_USER_ID,
      "doc.txt",
      "raw content text here",
      null,
      "ORGANIZATION",
    );

    expect(tagsRepo._attached).toEqual([]);
  });

  it("rolls back document on attachToDocument failure", async () => {
    const repo = buildRepo();
    const blob = new StubBlobStorage();
    const tagsRepo = buildTagsRepo();
    // Force attach to throw.
    tagsRepo.attachToDocument = vi.fn(async () => {
      throw new Error("attach failed");
    });

    const service = new DocumentsService(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      repo as any,
      blob,
      new RagService(),
      tagsRepo,
    );

    await expect(
      service.upload(
        CLERK_ORG_ID,
        CLERK_USER_ID,
        "doc.txt",
        "raw content text here",
        null,
        "ORGANIZATION",
        ["t1"],
      ),
    ).rejects.toThrow();

    expect(repo.delete).toHaveBeenCalledWith(DOC_ID, ORG_ID);
  });
});
