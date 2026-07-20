/**
 * C1 RED → GREEN — DocumentsService.list filters by RAG scope of caller role.
 *
 * Bug pre-C1: `service.list(clerkOrgId, clerkUserId)` returned ALL documents
 * of the organization regardless of caller role. A `member` (granjero) saw
 * ACCOUNTING-scoped docs in the page and could open the Vercel Blob URL.
 * Only the AI agent's RAG search filtered by scope (via `getRagScopes(role)`).
 *
 * Locks the contract:
 *   - DocumentsService.list resolves the caller membership role first.
 *   - Calls `getRagScopes(role)` from @/features/permissions (same matrix the
 *     RAG search uses — single source of truth).
 *   - Passes the resolved DocumentScope[] as second arg to repo.findAll.
 *   - When `getRagScopes(role)` returns null (role has no RAG access),
 *     service returns an empty document list without hitting the repo.
 *
 * Mock hygiene per [[mock_hygiene_commit_scope]]: DocumentsRepositoryPort
 * gains a second positional `allowedScopes` arg on findAll. This test asserts
 * the call shape against a spy — implementation under test is the service +
 * port contract; the fake in-memory repo update lands in the same commit as
 * the wiring.
 *
 * Expected RED failure (pre-GREEN):
 *   - service.list currently calls `repo.findAll(orgId)` with a single
 *     positional arg. The assertion `expect(repo.findAll).toHaveBeenCalledWith(
 *     ORG_ID, EXPECTED_SCOPES)` fails because the second argument is absent.
 *     That IS the right reason (feature not yet wired).
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  getDocument: vi.fn(),
  GlobalWorkerOptions: {},
}));

import { DocumentsService } from "@/modules/documents/application/documents.service";
import type { DocumentIndexingPort } from "@/modules/documents/domain/ports/document-indexing.port";
import type { DocumentWithRelations } from "@/modules/documents/domain/documents.types";

const CLERK_ORG_ID = "clerk_org_1";
const CLERK_USER_ID = "clerk_user_1";
const ORG_ID = "org_db_1";
const USER_ID = "user_db_1";

function buildDoc(
  id: string,
  scope: "ORGANIZATION" | "ACCOUNTING" | "FARM",
): DocumentWithRelations {
  return {
    id,
    name: `${id}.txt`,
    content: null,
    fileUrl: null,
    fileSize: null,
    fileType: null,
    scope,
    organizationId: ORG_ID,
    userId: USER_ID,
    aiSummary: null,
    createdAt: new Date(),
    user: { name: "Tester", email: "t@t" },
    organization: { name: "Test Org", clerkOrgId: CLERK_ORG_ID },
  } as DocumentWithRelations;
}

function buildRepo(role: string) {
  return {
    findOrgByClerkId: vi.fn().mockResolvedValue({
      id: ORG_ID,
      name: "Test Org",
      clerkOrgId: CLERK_ORG_ID,
    }),
    findUserWithMembership: vi.fn().mockResolvedValue({
      id: USER_ID,
      memberships: [{ role }],
    }),
    findAll: vi.fn().mockResolvedValue([] as DocumentWithRelations[]),
    findById: vi.fn(),
    findByIdWithMembers: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    findForAnalysis: vi.fn(),
    updateAnalysis: vi.fn(),
  };
}

class StubBlobStorage {
  upload = vi.fn();
  del = vi.fn();
}


// poc-rag-hex C2 — DocumentsService now takes a DocumentIndexingPort.
// The old module-mock of the rag presentation barrel, plus the stub class it
// exposed, were DELETED rather than repointed: documents.service.ts no longer
// imports that barrel at all, so the mock intercepted nothing. The same
// hoisted spies are wired straight into a port-shaped stub below.
// (Deliberately no literal mock-call text in this prose — the shape sentinels
// match specifiers with line-anchored regexes and would read a comment as code.)
const ragIndexingStub: DocumentIndexingPort = {
  indexDocument: vi.fn(),
  deleteByDocument: vi.fn(),
};

describe("DocumentsService.list — RAG scope filter by caller role (C1)", () => {
  it("member: passes [ORGANIZATION, FARM] to repo.findAll (ACCOUNTING excluded)", async () => {
    const repo = buildRepo("member");
    repo.findAll.mockResolvedValue([
      buildDoc("d_org", "ORGANIZATION"),
      buildDoc("d_farm", "FARM"),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new DocumentsService(repo as any, new StubBlobStorage(), ragIndexingStub);

    const result = await service.list(CLERK_ORG_ID, CLERK_USER_ID);

    expect(repo.findAll).toHaveBeenCalledWith(ORG_ID, ["ORGANIZATION", "FARM"]);
    expect(result.documents).toHaveLength(2);
    expect(result.metadata.userRole).toBe("member");
  });

  it("cobrador: passes [ORGANIZATION, ACCOUNTING] (FARM excluded)", async () => {
    // C2 2026-05-17 — cobrador es sub-rol contable; ve docs ACCOUNTING.
    const repo = buildRepo("cobrador");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new DocumentsService(repo as any, new StubBlobStorage(), ragIndexingStub);

    await service.list(CLERK_ORG_ID, CLERK_USER_ID);

    expect(repo.findAll).toHaveBeenCalledWith(ORG_ID, ["ORGANIZATION", "ACCOUNTING"]);
  });

  it("contador: passes [ORGANIZATION, ACCOUNTING] (FARM excluded)", async () => {
    const repo = buildRepo("contador");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new DocumentsService(repo as any, new StubBlobStorage(), ragIndexingStub);

    await service.list(CLERK_ORG_ID, CLERK_USER_ID);

    expect(repo.findAll).toHaveBeenCalledWith(ORG_ID, ["ORGANIZATION", "ACCOUNTING"]);
  });

  it("owner: passes all three scopes", async () => {
    const repo = buildRepo("owner");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new DocumentsService(repo as any, new StubBlobStorage(), ragIndexingStub);

    await service.list(CLERK_ORG_ID, CLERK_USER_ID);

    expect(repo.findAll).toHaveBeenCalledWith(ORG_ID, [
      "ORGANIZATION",
      "ACCOUNTING",
      "FARM",
    ]);
  });

  it("role without RAG access (unknown): returns empty list without hitting repo.findAll", async () => {
    const repo = buildRepo("custom-no-rag");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new DocumentsService(repo as any, new StubBlobStorage(), ragIndexingStub);

    const result = await service.list(CLERK_ORG_ID, CLERK_USER_ID);

    expect(repo.findAll).not.toHaveBeenCalled();
    expect(result.documents).toEqual([]);
    expect(result.metadata.documentCount).toBe(0);
    expect(result.metadata.userRole).toBe("custom-no-rag");
  });
});
