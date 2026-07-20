import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "../../..");
const DOC_ROOT = resolve(__dirname, "..");

// readRepoFile removed at C5 — α35/α36 inverted to existence checks, no
// repo-root file is read by this sentinel any more (REPO_ROOT still used below).
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

  // α35/α36 — INVERTED at poc-documents-hex C5 (batch 1 wholesale delete).
  // The features/documents/server.ts SHIM was deleted: it had ZERO import
  // consumers (verified by repo-wide grep), so the re-export chain it once
  // preserved is dead weight. Per project precedent these POSITIVE presence
  // sentinels are INVERTED to absence assertions rather than removed, so the
  // α numbering stays stable and a resurrected shim trips the sentinel.

  // α35 — features/documents/server.ts SHIM no longer exists (was: re-exports hex barrel)
  it("α35: features/documents/server.ts SHIM absent — deleted at C5, canonical barrel is @/modules/documents/presentation/server (INVERTED)", () => {
    expect(existsSync(resolve(REPO_ROOT, "features/documents/server.ts"))).toBe(
      false,
    );
  });

  // α36 — features/documents/server.ts SHIM no longer exists (was: carries server-only)
  it("α36: features/documents/server.ts SHIM absent — the ONLY 'server-only' marker for documents is presentation/server.ts (α33) (INVERTED)", () => {
    expect(existsSync(resolve(REPO_ROOT, "features/documents/server.ts"))).toBe(
      false,
    );
  });

  // α37 — presentation/validation/documents.validation.ts exports schemas
  it("α37: presentation/validation/documents.validation.ts exports createDocumentSchema (+ list/analyze)", () => {
    const src = readDocFile("presentation/validation/documents.validation.ts");
    expect(src).toMatch(/^export const createDocumentSchema\b/m);
    expect(src).toMatch(/^export const listDocumentsSchema\b/m);
    expect(src).toMatch(/^export const analyzeDocumentSchema\b/m);
  });
});
