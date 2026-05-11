import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const OP_ROOT = resolve(__dirname, "..");

function readOpFile(rel: string): string {
  return readFileSync(resolve(OP_ROOT, rel), "utf-8");
}

describe("C0 domain shape — OrgProfile module (existence-only regex)", () => {
  // α1 — paired sister DocumentSignatureConfig α1 EXACT mirror
  it("OrgProfile entity is exported from domain/org-profile.entity.ts", () => {
    const src = readOpFile("domain/org-profile.entity.ts");
    expect(src).toMatch(/^export class OrgProfile\b/m);
  });

  // α2 — paired sister DocumentSignatureConfig α2 EXACT mirror (write-tx port R7)
  it("OrgProfileRepository type is exported from domain/org-profile.repository.ts (write-tx port R7 paired sister cementado)", () => {
    const src = readOpFile("domain/org-profile.repository.ts");
    expect(src).toMatch(
      /^export (interface|type) OrgProfileRepository\b/m,
    );
  });

  // α3 — paired sister DocumentSignatureConfig α3 EXACT mirror (read-non-tx port R7)
  it("OrgProfileInquiryPort + OrgProfileSnapshot types are exported from domain/ports/org-profile-inquiry.port.ts (read-non-tx port R7 paired sister cementado)", () => {
    const src = readOpFile(
      "domain/ports/org-profile-inquiry.port.ts",
    );
    expect(src).toMatch(
      /^export (interface|type) OrgProfileInquiryPort\b/m,
    );
    expect(src).toMatch(
      /^export (interface|type) OrgProfileSnapshot\b/m,
    );
  });

  // α4 — EXPANDED: BlobStoragePort interface domain/ports/blob-storage.port.ts (NEW pattern — org-profile has logo blob management)
  it("BlobStoragePort type is exported from domain/ports/blob-storage.port.ts (NEW hex port — @vercel/blob abstraction)", () => {
    const src = readOpFile("domain/ports/blob-storage.port.ts");
    expect(src).toMatch(
      /^export (interface|type) BlobStoragePort\b/m,
    );
  });

  // α5 — paired sister DocumentSignatureConfig α5 EXACT mirror adapted (UpdateOrgProfileInput + OrgProfileProps + OrgProfileSnapshot)
  it("UpdateOrgProfileInput + OrgProfileProps + OrgProfileSnapshot are exported from domain/org-profile.entity.ts", () => {
    const src = readOpFile("domain/org-profile.entity.ts");
    expect(src).toMatch(
      /^export (interface|type) UpdateOrgProfileInput\b/m,
    );
    expect(src).toMatch(
      /^export (interface|type) OrgProfileProps\b/m,
    );
    expect(src).toMatch(
      /^export (interface|type) OrgProfileSnapshot\b/m,
    );
  });

  // α6 — paired sister DocumentSignatureConfig α6 EXACT mirror adapted
  it("OrgProfile.create + OrgProfile.fromPersistence static factories exist in domain/org-profile.entity.ts", () => {
    const src = readOpFile("domain/org-profile.entity.ts");
    expect(src).toMatch(/static create\(/m);
    expect(src).toMatch(/static fromPersistence\(/m);
  });

  // α7 — R5 absoluta domain ZERO Prisma imports
  it("domain/org-profile.entity.ts has ZERO Prisma imports (R5 absoluta)", () => {
    const src = readOpFile("domain/org-profile.entity.ts");
    expect(src).not.toMatch(/from\s+["']@\/generated\/prisma/);
    expect(src).not.toMatch(/from\s+["']prisma/);
  });

  // α8 — R5 absoluta domain repository ZERO Prisma imports
  it("domain/org-profile.repository.ts has ZERO Prisma imports (R5 absoluta)", () => {
    const src = readOpFile("domain/org-profile.repository.ts");
    expect(src).not.toMatch(/from\s+["']@\/generated\/prisma/);
    expect(src).not.toMatch(/from\s+["']prisma/);
  });
});
