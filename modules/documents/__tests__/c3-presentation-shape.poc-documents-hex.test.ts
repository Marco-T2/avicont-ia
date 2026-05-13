import { readFileSync } from "node:fs";
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

describe("C3 presentation shape — Documents module (existence-only regex) — paired sister poc-org-profile-hex C3", () => {
  // α29 — composition-root.ts exports makeDocumentsService function
  it("α29: presentation/composition-root.ts exports makeDocumentsService factory", () => {
    const src = readDocFile("presentation/composition-root.ts");
    expect(src).toMatch(/^export function makeDocumentsService\(/m);
  });

  // α30 — composition-root wires PrismaDocumentsRepository + VercelBlobStorageAdapter
  it("α30: composition-root.ts factory wires PrismaDocumentsRepository + VercelBlobStorageAdapter", () => {
    const src = readDocFile("presentation/composition-root.ts");
    expect(src).toMatch(/new PrismaDocumentsRepository\(/);
    expect(src).toMatch(/new VercelBlobStorageAdapter\(/);
  });

  // α31 — presentation/server.ts re-exports makeDocumentsService from ./composition-root
  it("α31: presentation/server.ts re-exports makeDocumentsService from ./composition-root", () => {
    const src = readDocFile("presentation/server.ts");
    expect(src).toMatch(
      /^export\s*\{[^}]*\bmakeDocumentsService\b[^}]*\}\s*from\s*["']\.\/composition-root["']/m,
    );
  });

  // α32 — presentation/server.ts exports DocumentsService
  it("α32: presentation/server.ts exports DocumentsService", () => {
    const src = readDocFile("presentation/server.ts");
    expect(src).toMatch(/\bDocumentsService\b/);
  });

  // α33 — presentation/server.ts carries server-only (REQ-005 POSITIVE)
  it("α33: presentation/server.ts carries 'server-only' import (REQ-005 POSITIVE)", () => {
    const src = readDocFile("presentation/server.ts");
    expect(src).toMatch(/import\s+["']server-only["']/);
  });

  // α34 — presentation/server.ts re-exports validation schemas
  it("α34: presentation/server.ts re-exports createDocumentSchema + listDocumentsSchema + analyzeDocumentSchema", () => {
    const src = readDocFile("presentation/server.ts");
    expect(src).toMatch(/\bcreateDocumentSchema\b/);
    expect(src).toMatch(/\blistDocumentsSchema\b/);
    expect(src).toMatch(/\banalyzeDocumentSchema\b/);
  });

  // α35 — features/documents/server.ts SHIM re-exports from @/modules/documents/presentation/server
  it("α35: features/documents/server.ts SHIM re-exports from @/modules/documents/presentation/server", () => {
    const src = readRepoFile("features/documents/server.ts");
    expect(src).toMatch(
      /from\s+["']@\/modules\/documents\/presentation\/server["']/,
    );
  });

  // α36 — features/documents/server.ts SHIM carries server-only marker
  it("α36: features/documents/server.ts SHIM carries 'server-only' import (POSITIVE)", () => {
    const src = readRepoFile("features/documents/server.ts");
    expect(src).toMatch(/import\s+["']server-only["']/);
  });

  // α37 — presentation/validation/documents.validation.ts exports schemas
  it("α37: presentation/validation/documents.validation.ts exports createDocumentSchema (+ list/analyze)", () => {
    const src = readDocFile("presentation/validation/documents.validation.ts");
    expect(src).toMatch(/^export const createDocumentSchema\b/m);
    expect(src).toMatch(/^export const listDocumentsSchema\b/m);
    expect(src).toMatch(/^export const analyzeDocumentSchema\b/m);
  });
});
