import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "../../..");
const DOC_ROOT = resolve(__dirname, "..");

function readRepoFile(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), "utf-8");
}
function readDocFile(rel: string): string {
  return readFileSync(resolve(DOC_ROOT, rel), "utf-8");
}

describe("C1 application shape — Documents module (existence-only regex + relocated test) — paired sister poc-org-profile-hex C1", () => {
  // α9 — DocumentsService class exported from application/documents.service.ts
  it("α9: modules/documents/application/documents.service.ts exports DocumentsService class", () => {
    const src = readDocFile("application/documents.service.ts");
    expect(src).toMatch(/^export class DocumentsService\b/m);
  });

  // α10 — constructor accepts (repo, blobStorage, ragService) all required (no optional defaults)
  it("α10: DocumentsService constructor signature accepts (repo, blobStorage, ragService) deps", () => {
    const src = readDocFile("application/documents.service.ts");
    // ctor signature must list 3 deps; allow any whitespace/type annotations
    expect(src).toMatch(
      /constructor\s*\(\s*[^)]*\brepo\b[^)]*\bblobStorage\b[^)]*\bragService\b/,
    );
  });

  // α11 — DocumentsService has upload, list, getById, delete, findForAnalysis, updateAnalysis methods
  it("α11: DocumentsService exposes upload, list, getById, delete, findForAnalysis, updateAnalysis methods", () => {
    const src = readDocFile("application/documents.service.ts");
    for (const method of [
      "upload",
      "list",
      "getById",
      "delete",
      "findForAnalysis",
      "updateAnalysis",
    ]) {
      expect(src).toMatch(new RegExp(`async\\s+${method}\\s*\\(`));
    }
  });

  // α12 — application has NO @/lib/blob import (REQ-002 NEGATIVE)
  it("α12: application/documents.service.ts has ZERO @/lib/blob import (REQ-002 NEGATIVE)", () => {
    const src = readDocFile("application/documents.service.ts");
    expect(src).not.toMatch(/from\s+["']@\/lib\/blob/);
  });

  // α13 — application has NO server-only import (REQ-005 NEGATIVE)
  it("α13: application/documents.service.ts has ZERO 'server-only' import (REQ-005 NEGATIVE)", () => {
    const src = readDocFile("application/documents.service.ts");
    expect(src).not.toMatch(/import\s+["']server-only["']/);
  });

  // α14 — DocumentsService imports RagService from @/features/documents/rag/server (REQ-004)
  it("α14: application/documents.service.ts imports RagService from @/features/documents/rag/server (REQ-004 cross-module canonical-bypass)", () => {
    const src = readDocFile("application/documents.service.ts");
    expect(src).toMatch(
      /from\s+["']@\/features\/documents\/rag\/server["']/,
    );
  });

  // α15 — pdfjs-dist import present + exception comment (REQ-007)
  it("α15: pdfjs-dist import present + 'processing library accepted exception' comment (REQ-007)", () => {
    const src = readDocFile("application/documents.service.ts");
    expect(src).toMatch(/pdfjs-dist\/legacy\/build\/pdf\.mjs/);
    expect(src).toMatch(/processing library accepted exception/i);
  });

  // α16 — FakeBlobStorage in-memory fake implements BlobStoragePort (compile shape)
  it("α16: application/fakes/fake-blob-storage.ts exports FakeBlobStorage implementing BlobStoragePort", () => {
    const src = readDocFile("application/fakes/fake-blob-storage.ts");
    expect(src).toMatch(/^export class FakeBlobStorage\b/m);
    expect(src).toMatch(/implements\s+BlobStoragePort/);
  });

  // α17 — InMemoryDocumentsRepository fake exported (compile shape)
  it("α17: application/fakes/in-memory-documents.repository.ts exports InMemoryDocumentsRepository", () => {
    const src = readDocFile("application/fakes/in-memory-documents.repository.ts");
    expect(src).toMatch(/^export class InMemoryDocumentsRepository\b/m);
  });

  // α18 — error-propagation test relocated to modules/documents/application/__tests__/
  it("α18: error-propagation test relocated to modules/documents/application/__tests__/documents.service.error-propagation.test.ts", () => {
    const newPath = resolve(
      DOC_ROOT,
      "application/__tests__/documents.service.error-propagation.test.ts",
    );
    expect(existsSync(newPath)).toBe(true);
    const oldPath = resolve(
      REPO_ROOT,
      "features/documents/__tests__/documents.service.error-propagation.test.ts",
    );
    expect(existsSync(oldPath)).toBe(false);
  });
});
