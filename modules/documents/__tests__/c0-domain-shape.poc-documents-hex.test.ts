import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const DOC_ROOT = resolve(__dirname, "..");

function readDocFile(rel: string): string {
  return readFileSync(resolve(DOC_ROOT, rel), "utf-8");
}

describe("C0 domain shape — Documents module (existence-only regex) — paired sister poc-org-profile-hex C0", () => {
  // α1 — types file exports DocumentWithRelations
  it("α1: modules/documents/domain/documents.types.ts exports DocumentWithRelations", () => {
    const src = readDocFile("domain/documents.types.ts");
    expect(src).toMatch(/^export type DocumentWithRelations\b/m);
  });

  // α2 — types file exports CreateDocumentInput
  it("α2: modules/documents/domain/documents.types.ts exports CreateDocumentInput", () => {
    const src = readDocFile("domain/documents.types.ts");
    expect(src).toMatch(/^export interface CreateDocumentInput\b/m);
  });

  // α3 — types file exports DocumentListResult + DocumentUploadResult
  it("α3: modules/documents/domain/documents.types.ts exports DocumentListResult + DocumentUploadResult", () => {
    const src = readDocFile("domain/documents.types.ts");
    expect(src).toMatch(/^export interface DocumentListResult\b/m);
    expect(src).toMatch(/^export interface DocumentUploadResult\b/m);
  });

  // α4 — domain/ports/blob-storage.port.ts exports BlobStoragePort
  it("α4: modules/documents/domain/ports/blob-storage.port.ts exports BlobStoragePort", () => {
    const src = readDocFile("domain/ports/blob-storage.port.ts");
    expect(src).toMatch(/^export (interface|type) BlobStoragePort\b/m);
  });

  // α5 — BlobStoragePort has upload method signature
  it("α5: BlobStoragePort has upload method signature (DIFFERS from org-profile del-only port)", () => {
    const src = readDocFile("domain/ports/blob-storage.port.ts");
    expect(src).toMatch(/upload\s*\(/);
  });

  // α6 — BlobStoragePort has del method signature
  it("α6: BlobStoragePort has del method signature", () => {
    const src = readDocFile("domain/ports/blob-storage.port.ts");
    expect(src).toMatch(/del\s*\(/);
  });

  // α7 — R5 absoluta — types file ZERO Prisma imports
  it("α7: domain/documents.types.ts has ZERO Prisma imports (R5 absoluta NEGATIVE sentinel)", () => {
    const src = readDocFile("domain/documents.types.ts");
    expect(src).not.toMatch(/from\s+["']@\/generated\/prisma/);
    expect(src).not.toMatch(/from\s+["']@prisma\/client/);
  });

  // α8 — REQ-005 NEGATIVE — types file ZERO server-only
  it("α8: domain/documents.types.ts has ZERO 'server-only' import (REQ-005 NEGATIVE sentinel)", () => {
    const src = readDocFile("domain/documents.types.ts");
    expect(src).not.toMatch(/import\s+["']server-only["']/);
  });
});
