import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { stripSourceComments } from "@/modules/shared/__tests__/strip-source-comments";

const REPO_ROOT = resolve(__dirname, "../../..");
const DOC_ROOT = resolve(__dirname, "..");

/**
 * RAW source — comments included. Use ONLY where a comment is the artifact
 * under test (α15's REQ-007 rationale). Everywhere else use readDocSource.
 */
function readDocFileRaw(rel: string): string {
  return readFileSync(resolve(DOC_ROOT, rel), "utf-8");
}

/**
 * Source with comments STRIPPED (poc-rag-hex C3) — the default read for every
 * lock that pins RUNTIME CODE. Anchoring alone left residue: `^import` still
 * matches an UNINDENTED line inside a block comment, and unanchored NEGATIVES
 * can be driven falsely RED by prose. Removing comments closes both directions.
 */
function readDocSource(rel: string): string {
  return stripSourceComments(readDocFileRaw(rel));
}

describe("C1 application shape — Documents module (existence-only regex + relocated test) — paired sister poc-org-profile-hex C1", () => {
  // α9 — DocumentsService class exported from application/documents.service.ts
  it("α9: modules/documents/application/documents.service.ts exports DocumentsService class", () => {
    const src = readDocSource("application/documents.service.ts");
    expect(src).toMatch(/^export class DocumentsService\b/m);
  });

  // α10 — constructor accepts (repo, blobStorage, ragService) all required (no optional defaults)
  it("α10: DocumentsService constructor signature accepts (repo, blobStorage, ragService) deps", () => {
    const src = readDocSource("application/documents.service.ts");
    // ANCHORED (^...) — the previous unanchored `[^)]*\bragService\b` span was
    // satisfied by the ctor's own explanatory comment, not by the parameter.
    // Each dep must now appear as a real line-anchored parameter declaration.
    expect(src).toMatch(/^\s*constructor\s*\(/m);
    for (const dep of ["repo", "blobStorage", "ragService"]) {
      expect(src).toMatch(new RegExp(`^\\s*private readonly ${dep}\\b`, "m"));
    }
  });

  // α11 — DocumentsService has upload, list, getById, delete, findForAnalysis, updateAnalysis methods
  it("α11: DocumentsService exposes upload, list, getById, delete, findForAnalysis, updateAnalysis methods", () => {
    const src = readDocSource("application/documents.service.ts");
    for (const method of [
      "upload",
      "list",
      "getById",
      "delete",
      "findForAnalysis",
      "updateAnalysis",
    ]) {
      // ANCHORED (^...) — an unanchored method regex reads a doc comment as code.
      expect(src).toMatch(new RegExp(`^\\s*async\\s+${method}\\s*\\(`, "m"));
    }
  });

  // α12 — application has NO @/lib/blob import (REQ-002 NEGATIVE)
  it("α12: application/documents.service.ts has ZERO @/lib/blob import (REQ-002 NEGATIVE)", () => {
    const src = readDocSource("application/documents.service.ts");
    expect(src).not.toMatch(/from\s+["']@\/lib\/blob/);
  });

  // α13 — application has NO server-only import (REQ-005 NEGATIVE)
  it("α13: application/documents.service.ts has ZERO 'server-only' import (REQ-005 NEGATIVE)", () => {
    const src = readDocSource("application/documents.service.ts");
    expect(src).not.toMatch(/import\s+["']server-only["']/);
  });

  // α14 — INVERTED at poc-rag-hex C2. Used to pin the REQ-004 cross-module
  // canonical-bypass (concrete RagService import) INTO the application layer.
  // REQ-004 is dead: DocumentsService depends on DocumentIndexingPort only.
  // Polarity flipped — the concrete import is now a violation, and the port
  // import is the positive lock that replaces it.
  it("α14: application/documents.service.ts imports DocumentIndexingPort and NO concrete rag module (REQ-004 killed)", () => {
    const src = readDocSource("application/documents.service.ts");
    // Comments are stripped at the read boundary, AND the matcher is
    // multi-line-aware (`} from "X"` closes a multi-line named import) so
    // splitting the import across lines cannot evade the positive lock.
    expect(src).toMatch(
      /^(?:import\b.*|\})\s*from\s+["']@\/modules\/documents\/domain\/ports\/document-indexing\.port["']/m,
    );
    expect(src).not.toMatch(/from\s+["']@\/features\/documents\/rag\/server["']/);
    expect(src).not.toMatch(/from\s+["']@\/modules\/rag\//);
  });

  // α15 — pdfjs-dist import present + exception comment (REQ-007)
  it("α15: pdfjs-dist import present + 'processing library accepted exception' comment (REQ-007)", () => {
    // CODE half — stripped source + multi-line-aware, so no comment can satisfy it.
    const src = readDocSource("application/documents.service.ts");
    expect(src).toMatch(
      /^(?:import\b.*|\})\s*from\s+["']pdfjs-dist\/legacy\/build\/pdf\.mjs["']/m,
    );
    // COMMENT half — DELIBERATE EXCEPTION to the comment-stripping convention.
    // This lock asserts the REQ-007 exception rationale at documents.service.ts:33;
    // the comment IS the artifact under test, so it MUST read RAW source.
    // Stripping here would make the assertion unsatisfiable by construction.
    const raw = readDocFileRaw("application/documents.service.ts");
    expect(raw).toMatch(/processing library accepted exception/i);
  });

  // α16 — FakeBlobStorage in-memory fake implements BlobStoragePort (compile shape)
  it("α16: application/fakes/fake-blob-storage.ts exports FakeBlobStorage implementing BlobStoragePort", () => {
    const src = readDocSource("application/fakes/fake-blob-storage.ts");
    // ANCHORED (^export class ... implements ...) — the `implements` clause is
    // folded into the anchored declaration so comment prose cannot satisfy it.
    expect(src).toMatch(
      /^export class FakeBlobStorage\s+implements\s+BlobStoragePort\b/m,
    );
  });

  // α17 — InMemoryDocumentsRepository fake exported (compile shape)
  it("α17: application/fakes/in-memory-documents.repository.ts exports InMemoryDocumentsRepository", () => {
    const src = readDocSource("application/fakes/in-memory-documents.repository.ts");
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
