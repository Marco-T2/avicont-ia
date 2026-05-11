import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const OP_ROOT = resolve(__dirname, "..", "..");

function readOpFile(rel: string): string {
  return readFileSync(resolve(OP_ROOT, rel), "utf-8");
}

describe("C3 presentation shape — OrgProfile module (existence-only regex)", () => {
  // α29 — paired sister DocumentSignatureConfig α28 EXACT mirror
  it("composition-root.ts exports makeOrgProfileService factory", () => {
    const src = readOpFile("presentation/composition-root.ts");
    expect(src).toMatch(
      /^export function makeOrgProfileService\(/m,
    );
  });

  // α30 — paired sister DocumentSignatureConfig α29 EXACT mirror
  it("composition-root.ts factory wires PrismaOrgProfileRepository + VercelBlobStorageAdapter", () => {
    const src = readOpFile("presentation/composition-root.ts");
    expect(src).toMatch(/new PrismaOrgProfileRepository\(/);
    expect(src).toMatch(/new VercelBlobStorageAdapter\(/);
  });

  // α31 — ADAPTED: updateOrgProfileSchema + logoUploadConstraints (org-profile validation)
  it("validation.ts exports updateOrgProfileSchema + logoUploadConstraints (Zod)", () => {
    const src = readOpFile("presentation/validation.ts");
    expect(src).toMatch(
      /^export const updateOrgProfileSchema\s*=\s*z\.object\(/m,
    );
    expect(src).toMatch(
      /^export const logoUploadConstraints\b/m,
    );
  });

  // α32 — paired sister DocumentSignatureConfig α31 EXACT mirror
  it("server.ts barrel re-exports makeOrgProfileService from composition-root", () => {
    const src = readOpFile("presentation/server.ts");
    expect(src).toMatch(
      /^export\s*\{[^}]*\bmakeOrgProfileService\b[^}]*\}\s*from\s*["']\.\/composition-root["']/m,
    );
  });

  // α33 — ADAPTED: validation schemas re-export
  it("server.ts barrel re-exports updateOrgProfileSchema + logoUploadConstraints from validation", () => {
    const src = readOpFile("presentation/server.ts");
    expect(src).toMatch(/\bupdateOrgProfileSchema\b/);
    expect(src).toMatch(/\blogoUploadConstraints\b/);
  });

  // α34 — paired sister DocumentSignatureConfig α33 EXACT mirror adapted
  it("server.ts barrel re-exports OrgProfileSnapshot + OrgProfileInquiryPort types", () => {
    const src = readOpFile("presentation/server.ts");
    expect(src).toMatch(/\bOrgProfileSnapshot\b/);
    expect(src).toMatch(/\bOrgProfileInquiryPort\b/);
  });

  // α35 — paired sister DocumentSignatureConfig α34 EXACT mirror adapted
  it("server.ts barrel re-exports OrgProfile entity + OrgProfileService", () => {
    const src = readOpFile("presentation/server.ts");
    expect(src).toMatch(
      /\bOrgProfile\b[\s\S]*?from\s*["']\.\.\/domain\/org-profile\.entity["']/,
    );
    expect(src).toMatch(
      /\bOrgProfileService\b[\s\S]*?from\s*["']\.\.\/application\/org-profile\.service["']/,
    );
  });

  // α36 — CLIENT barrel: client-safe exports for 3 client components
  it("index.ts (client barrel) re-exports updateOrgProfileSchema + logoUploadConstraints + UpdateOrgProfileInput — NO 'server-only'", () => {
    const src = readOpFile("presentation/index.ts");
    expect(src).toMatch(/\bupdateOrgProfileSchema\b/);
    expect(src).toMatch(/\blogoUploadConstraints\b/);
    expect(src).toMatch(/\bUpdateOrgProfileInput\b/);
    expect(src).not.toMatch(/server-only/);
  });
});
