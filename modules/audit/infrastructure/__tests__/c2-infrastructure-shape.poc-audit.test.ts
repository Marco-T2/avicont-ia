import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const INFRA_ROOT = resolve(__dirname, "..");

function readInfraFile(rel: string): string {
  return readFileSync(resolve(INFRA_ROOT, rel), "utf-8");
}

describe("C2 infrastructure shape — audit hex module", () => {
  // α16 — PrismaAuditRepository exists and implements domain interface
  it("α16: prisma-audit.repository.ts exports PrismaAuditRepository class implementing AuditRepository", () => {
    const src = readInfraFile("prisma-audit.repository.ts");
    expect(src).toMatch(/^export class PrismaAuditRepository\b/m);
    expect(src).toMatch(/implements AuditRepository/);
  });

  // α17 — Raw SQL CTE queries preserved
  it("α17: PrismaAuditRepository preserves raw SQL CTE queries (audit_with_parent CTE)", () => {
    const src = readInfraFile("prisma-audit.repository.ts");
    expect(src).toMatch(/audit_with_parent/);
    expect(src).toMatch(/LEFT JOIN journal_entries/);
    expect(src).toMatch(/Prisma\.sql/);
  });

  // α18 — scopedQueryRaw guard pattern (tenant isolation)
  it("α18: PrismaAuditRepository has requireOrg guard for tenant isolation", () => {
    const src = readInfraFile("prisma-audit.repository.ts");
    expect(src).toMatch(/requireOrg/);
    expect(src).toMatch(/organizationId is required/i);
  });

  // α19 — listFlat + getVoucherHistory methods
  it("α19: PrismaAuditRepository has listFlat + getVoucherHistory methods", () => {
    const src = readInfraFile("prisma-audit.repository.ts");
    expect(src).toMatch(/async listFlat\(/);
    expect(src).toMatch(/async getVoucherHistory\(/);
  });

  // α20 — PrismaUserNameResolver exists
  it("α20: prisma-user-name-resolver.ts exports PrismaUserNameResolver implementing UserNameResolver", () => {
    const src = readInfraFile("prisma-user-name-resolver.ts");
    expect(src).toMatch(/^export class PrismaUserNameResolver\b/m);
    expect(src).toMatch(/resolveNames/);
  });

  // α21 — server-only guard on infra files
  it("α21: prisma-audit.repository.ts has server-only import", () => {
    const src = readInfraFile("prisma-audit.repository.ts");
    expect(src).toMatch(/import\s+["']server-only["']/);
  });

  // α22 — NO BaseRepository dependency — uses direct Prisma client injection
  it("α22: prisma-audit.repository.ts does NOT extend BaseRepository (direct Prisma client injection)", () => {
    const src = readInfraFile("prisma-audit.repository.ts");
    expect(src).not.toMatch(/extends\s+BaseRepository/);
    expect(src).not.toMatch(/from\s+["']@\/features\/shared\/base\.repository["']/);
  });
});
