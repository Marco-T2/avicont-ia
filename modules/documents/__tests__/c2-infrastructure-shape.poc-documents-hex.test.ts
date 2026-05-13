import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const DOC_ROOT = resolve(__dirname, "..");

function readDocFile(rel: string): string {
  return readFileSync(resolve(DOC_ROOT, rel), "utf-8");
}

describe("C2 infrastructure shape — Documents module (existence-only regex) — paired sister poc-org-profile-hex C2", () => {
  // α19 — PrismaDocumentsRepository class exported
  it("α19: infrastructure/prisma/prisma-documents.repository.ts exports PrismaDocumentsRepository", () => {
    const src = readDocFile("infrastructure/prisma/prisma-documents.repository.ts");
    expect(src).toMatch(/^export class PrismaDocumentsRepository\b/m);
  });

  // α20 — PrismaDocumentsRepository has 9 expected methods
  it("α20: PrismaDocumentsRepository has 9 methods (findOrgByClerkId, findUserWithMembership, create, delete, findAll, findById, findByIdWithMembers, findForAnalysis, updateAnalysis)", () => {
    const src = readDocFile("infrastructure/prisma/prisma-documents.repository.ts");
    for (const method of [
      "findOrgByClerkId",
      "findUserWithMembership",
      "create",
      "delete",
      "findAll",
      "findById",
      "findByIdWithMembers",
      "findForAnalysis",
      "updateAnalysis",
    ]) {
      expect(src).toMatch(new RegExp(`async\\s+${method}\\b`));
    }
  });

  // α21 — VercelBlobStorageAdapter class exported
  it("α21: infrastructure/blob/vercel-blob-storage.adapter.ts exports VercelBlobStorageAdapter", () => {
    const src = readDocFile("infrastructure/blob/vercel-blob-storage.adapter.ts");
    expect(src).toMatch(/^export class VercelBlobStorageAdapter\b/m);
  });

  // α22 — VercelBlobStorageAdapter implements BlobStoragePort (upload + del)
  it("α22: VercelBlobStorageAdapter implements BlobStoragePort with upload + del methods", () => {
    const src = readDocFile("infrastructure/blob/vercel-blob-storage.adapter.ts");
    expect(src).toMatch(/implements\s+BlobStoragePort/);
    expect(src).toMatch(/async\s+upload\s*\(/);
    expect(src).toMatch(/async\s+del\s*\(/);
  });

  // α23 — upload(file, orgId, userId) returns {url, pathname} shape
  it("α23: VercelBlobStorageAdapter.upload signature matches (file, orgId/organizationId, userId) → {url, pathname}", () => {
    const src = readDocFile("infrastructure/blob/vercel-blob-storage.adapter.ts");
    // upload signature should reference file, organizationId/orgId, userId
    expect(src).toMatch(/upload\s*\(\s*file\s*:[^,]+,\s*\w+\s*:\s*string\s*,\s*\w+\s*:\s*string/);
    expect(src).toMatch(/\{\s*url\s*:\s*string\s*;\s*pathname\s*:\s*string\s*\}/);
  });

  // α24 — PrismaDocumentsRepository ZERO @vercel/blob imports (R5)
  it("α24: PrismaDocumentsRepository has ZERO @vercel/blob imports (R5 isolation)", () => {
    const src = readDocFile("infrastructure/prisma/prisma-documents.repository.ts");
    expect(src).not.toMatch(/from\s+["']@vercel\/blob["']/);
  });

  // α25 — VercelBlobStorageAdapter ZERO Prisma imports (R5)
  it("α25: VercelBlobStorageAdapter has ZERO @prisma/client or @/generated/prisma imports (R5 isolation)", () => {
    const src = readDocFile("infrastructure/blob/vercel-blob-storage.adapter.ts");
    expect(src).not.toMatch(/from\s+["']@prisma\/client/);
    expect(src).not.toMatch(/from\s+["']@\/generated\/prisma/);
  });

  // α26 — PrismaDocumentsRepository HAS Prisma import (POSITIVE)
  it("α26: PrismaDocumentsRepository imports from @prisma/client or @/generated/prisma (POSITIVE)", () => {
    const src = readDocFile("infrastructure/prisma/prisma-documents.repository.ts");
    expect(src).toMatch(/from\s+["'](?:@prisma\/client|@\/generated\/prisma)/);
  });

  // α27 — VercelBlobStorageAdapter HAS @vercel/blob import (POSITIVE)
  it("α27: VercelBlobStorageAdapter imports from @vercel/blob (POSITIVE)", () => {
    const src = readDocFile("infrastructure/blob/vercel-blob-storage.adapter.ts");
    expect(src).toMatch(/from\s+["']@vercel\/blob["']/);
  });

  // α28 — infrastructure ZERO server-only (REQ-005 NEGATIVE)
  it("α28: infrastructure files have ZERO 'server-only' import (REQ-005 NEGATIVE)", () => {
    const repoSrc = readDocFile("infrastructure/prisma/prisma-documents.repository.ts");
    const adapterSrc = readDocFile("infrastructure/blob/vercel-blob-storage.adapter.ts");
    expect(repoSrc).not.toMatch(/import\s+["']server-only["']/);
    expect(adapterSrc).not.toMatch(/import\s+["']server-only["']/);
  });
});
