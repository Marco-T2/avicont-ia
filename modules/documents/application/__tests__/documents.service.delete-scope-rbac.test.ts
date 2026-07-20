/**
 * C1 RED → GREEN — DocumentsService.delete validates RAG scope of caller role.
 *
 * Bug pre-C1: `service.delete(documentId, clerkUserId)` only validated that
 * the caller belonged to the document's organization. A `member` (granjero)
 * could DELETE an ACCOUNTING-scoped doc by knowing its id — the membership
 * check passed (same org) but the scope check was absent.
 *
 * Locks the contract:
 *   - delete resolves the caller membership role (via findUserWithMembership
 *     against the document's organization).
 *   - If `getRagScopes(role)` does NOT include `document.scope`, throws
 *     ForbiddenError BEFORE touching RAG or the blob.
 *   - If allowed, proceeds with the existing delete flow (RAG + blob + row).
 *
 * Expected RED failure (pre-GREEN):
 *   - service.delete currently throws ForbiddenError only when the
 *     `document.organization.members` set is empty. A member of the same org
 *     trying to delete an ACCOUNTING doc completes successfully. The first
 *     assertion (`rejects.toThrow(ForbiddenError)`) fails because no error
 *     is thrown. That IS the right reason (feature not yet wired).
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  getDocument: vi.fn(),
  GlobalWorkerOptions: {},
}));

const { mockRagDeleteByDocument } = vi.hoisted(() => ({
  mockRagDeleteByDocument: vi.fn(),
}));

import { DocumentsService } from "@/modules/documents/application/documents.service";
import type { DocumentIndexingPort } from "@/modules/documents/domain/ports/document-indexing.port";
import { ForbiddenError } from "@/modules/shared/domain/errors";

const CLERK_USER_ID = "clerk_user_1";
const ORG_ID = "org_db_1";
const USER_ID = "user_db_1";
const DOC_ID = "doc_acc_1";

function buildRepoWithDoc(opts: {
  role: string;
  scope: "ORGANIZATION" | "ACCOUNTING" | "FARM";
}) {
  return {
    findByIdWithMembers: vi.fn().mockResolvedValue({
      id: DOC_ID,
      fileUrl: null,
      scope: opts.scope,
      organizationId: ORG_ID,
      organization: {
        id: ORG_ID,
        members: [{ id: "membership_1" }],
      },
    }),
    findUserWithMembership: vi.fn().mockResolvedValue({
      id: USER_ID,
      memberships: [{ role: opts.role }],
    }),
    findOrgByClerkId: vi.fn(),
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    delete: vi.fn().mockResolvedValue(undefined),
    findForAnalysis: vi.fn(),
    updateAnalysis: vi.fn(),
  };
}

class StubBlobStorage {
  upload = vi.fn();
  del = vi.fn().mockResolvedValue(undefined);
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
  deleteByDocument: mockRagDeleteByDocument,
};

describe("DocumentsService.delete — RAG scope RBAC by caller role (C1)", () => {
  it("member trying to delete ACCOUNTING doc: throws ForbiddenError, no RAG nor row delete", async () => {
    const repo = buildRepoWithDoc({ role: "member", scope: "ACCOUNTING" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new DocumentsService(repo as any, new StubBlobStorage(), ragIndexingStub);

    await expect(service.delete(DOC_ID, CLERK_USER_ID)).rejects.toThrow(
      ForbiddenError,
    );
    expect(mockRagDeleteByDocument).not.toHaveBeenCalled();
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it("cobrador trying to delete FARM doc: throws ForbiddenError", async () => {
    const repo = buildRepoWithDoc({ role: "cobrador", scope: "FARM" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new DocumentsService(repo as any, new StubBlobStorage(), ragIndexingStub);

    await expect(service.delete(DOC_ID, CLERK_USER_ID)).rejects.toThrow(
      ForbiddenError,
    );
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it("admin deleting ACCOUNTING doc: succeeds (RAG + row delete fire)", async () => {
    const repo = buildRepoWithDoc({ role: "admin", scope: "ACCOUNTING" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new DocumentsService(repo as any, new StubBlobStorage(), ragIndexingStub);

    await service.delete(DOC_ID, CLERK_USER_ID);

    expect(mockRagDeleteByDocument).toHaveBeenCalledWith(DOC_ID);
    expect(repo.delete).toHaveBeenCalledWith(DOC_ID, ORG_ID);
  });

  it("member deleting FARM doc (allowed by RAG_SCOPES): succeeds", async () => {
    const repo = buildRepoWithDoc({ role: "member", scope: "FARM" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new DocumentsService(repo as any, new StubBlobStorage(), ragIndexingStub);

    await service.delete(DOC_ID, CLERK_USER_ID);

    expect(repo.delete).toHaveBeenCalledWith(DOC_ID, ORG_ID);
  });
});
