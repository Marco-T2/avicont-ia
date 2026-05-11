import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PRES_ROOT = resolve(__dirname, "..");

function readPresFile(rel: string): string {
  return readFileSync(resolve(PRES_ROOT, rel), "utf-8");
}

describe("C3 presentation shape — audit hex module", () => {
  // α23 — composition-root exports makeAuditService factory
  it("α23: composition-root.ts exports makeAuditService factory function", () => {
    const src = readPresFile("composition-root.ts");
    expect(src).toMatch(/^export function makeAuditService\b/m);
    expect(src).toMatch(/import\s+["']server-only["']/);
  });

  // α24 — server.ts barrel exports service factory + validation + domain types
  it("α24: server.ts barrel exports makeAuditService + validation schemas + domain types", () => {
    const src = readPresFile("server.ts");
    expect(src).toMatch(/makeAuditService/);
    expect(src).toMatch(/auditListQuerySchema/);
    expect(src).toMatch(/parseCursor/);
    expect(src).toMatch(/voucherHistoryParamsSchema/);
    expect(src).toMatch(/import\s+["']server-only["']/);
  });

  // α25 — index.ts client-safe barrel (NO Repository/Service)
  it("α25: index.ts client-safe barrel exports types+constants (NO Repository/Service names)", () => {
    const src = readPresFile("index.ts");
    // Should export types and constants
    expect(src).toMatch(/AUDITED_ENTITY_TYPES/);
    expect(src).toMatch(/AUDIT_ACTIONS/);
    expect(src).toMatch(/isHeaderEvent/);
    expect(src).toMatch(/buildGroupSummary/);
    // Should NOT export server-only symbols
    expect(src).not.toMatch(/\bAuditService\b/);
    expect(src).not.toMatch(/\bAuditRepository\b/);
    expect(src).not.toMatch(/\bPrismaAuditRepository\b/);
    // Should NOT have server-only import
    expect(src).not.toMatch(/import\s+["']server-only["']/);
  });

  // α26 — validation.ts exports Zod schemas
  it("α26: validation.ts exports auditListQuerySchema + parseCursor + voucherHistoryParamsSchema", () => {
    const src = readPresFile("validation.ts");
    expect(src).toMatch(/^export const auditListQuerySchema\b/m);
    expect(src).toMatch(/^export function parseCursor\b/m);
    expect(src).toMatch(/^export const voucherHistoryParamsSchema\b/m);
  });

  // α27 — composition-root wires PrismaAuditRepository + PrismaUserNameResolver
  it("α27: composition-root.ts wires PrismaAuditRepository + PrismaUserNameResolver into AuditService", () => {
    const src = readPresFile("composition-root.ts");
    expect(src).toMatch(/PrismaAuditRepository/);
    expect(src).toMatch(/PrismaUserNameResolver/);
    expect(src).toMatch(/AuditService/);
  });
});
