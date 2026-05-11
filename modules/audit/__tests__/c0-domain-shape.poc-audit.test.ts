import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const AUDIT_ROOT = resolve(__dirname, "..");

function readAuditFile(rel: string): string {
  return readFileSync(resolve(AUDIT_ROOT, rel), "utf-8");
}

describe("C0 domain shape — audit hex module (existence-only regex)", () => {
  // --- audit.types.ts ---

  // α1 — R5 absoluta: ZERO Prisma imports in domain types
  it("α1: domain/audit.types.ts exports AUDITED_ENTITY_TYPES + AUDIT_ACTIONS local const arrays (R5 absoluta ZERO Prisma imports)", () => {
    const src = readAuditFile("domain/audit.types.ts");
    expect(src).toMatch(/^export const AUDITED_ENTITY_TYPES\b/m);
    expect(src).toMatch(/^export const AUDIT_ACTIONS\b/m);
    // R5 absoluta — ZERO Prisma imports
    expect(src).not.toMatch(/from\s+["']@\/generated\/prisma/);
    expect(src).not.toMatch(/from\s+["']prisma/);
  });

  // α2 — AuditEvent + AuditGroup + AuditCursor + AuditListFilters interfaces/types
  it("α2: domain/audit.types.ts exports AuditEvent + AuditGroup + AuditCursor + AuditListFilters types", () => {
    const src = readAuditFile("domain/audit.types.ts");
    expect(src).toMatch(/^export (interface|type) AuditEvent\b/m);
    expect(src).toMatch(/^export (interface|type) AuditGroup\b/m);
    expect(src).toMatch(/^export (interface|type) AuditCursor\b/m);
    expect(src).toMatch(/^export (interface|type) AuditListFilters\b/m);
  });

  // α3 — AuditGroupSummary + DiffField + helper functions
  it("α3: domain/audit.types.ts exports AuditGroupSummary + DiffField types + helper functions (isHeaderEvent, buildGroupSummary, buildTimelineSummary, getVoucherDetailUrl)", () => {
    const src = readAuditFile("domain/audit.types.ts");
    expect(src).toMatch(/^export (interface|type) AuditGroupSummary\b/m);
    expect(src).toMatch(/^export (interface|type) DiffField\b/m);
    expect(src).toMatch(/^export function isHeaderEvent\b/m);
    expect(src).toMatch(/^export function buildGroupSummary\b/m);
    expect(src).toMatch(/^export function buildTimelineSummary\b/m);
    expect(src).toMatch(/^export function getVoucherDetailUrl\b/m);
  });

  // α4 — UI constants (labels, status badges, diff fields)
  it("α4: domain/audit.types.ts exports ENTITY_TYPE_LABELS + ACTION_LABELS + STATUS_BADGE_LABELS + DIFF_FIELDS constants", () => {
    const src = readAuditFile("domain/audit.types.ts");
    expect(src).toMatch(/^export const ENTITY_TYPE_LABELS\b/m);
    expect(src).toMatch(/^export const ACTION_LABELS\b/m);
    expect(src).toMatch(/^export const STATUS_BADGE_LABELS\b/m);
    expect(src).toMatch(/^export const DIFF_FIELDS\b/m);
  });

  // --- audit.classifier.ts ---

  // α5 — classify function exported from domain layer
  it("α5: domain/audit.classifier.ts exports classify function + ParentContext type (R5 absoluta ZERO Prisma imports)", () => {
    const src = readAuditFile("domain/audit.classifier.ts");
    expect(src).toMatch(/^export function classify\b/m);
    expect(src).toMatch(/^export type ParentContext\b/m);
    // R5 absoluta
    expect(src).not.toMatch(/from\s+["']@\/generated\/prisma/);
    expect(src).not.toMatch(/from\s+["']prisma/);
  });

  // --- audit.repository.ts (interface) ---

  // α6 — AuditRepository interface (read-only port) + AuditRow type
  it("α6: domain/audit.repository.ts exports AuditRepository interface + AuditRow type (read-only port — NO write methods)", () => {
    const src = readAuditFile("domain/audit.repository.ts");
    expect(src).toMatch(
      /^export (interface|type) AuditRepository\b/m,
    );
    expect(src).toMatch(
      /^export (interface|type) AuditRow\b/m,
    );
    // Read-only: should have listFlat + getVoucherHistory, NO save/create/update/delete
    expect(src).toMatch(/listFlat/);
    expect(src).toMatch(/getVoucherHistory/);
    expect(src).not.toMatch(/\bsave\b/);
    expect(src).not.toMatch(/\bcreate\b/);
    expect(src).not.toMatch(/\bupdate\b/);
    expect(src).not.toMatch(/\bdelete\b/);
  });

  // --- inquiry port ---

  // α7 — AuditInquiryPort for cross-module consumption
  it("α7: domain/ports/audit-inquiry.port.ts exports AuditInquiryPort interface (read-only cross-module port)", () => {
    const src = readAuditFile("domain/ports/audit-inquiry.port.ts");
    expect(src).toMatch(
      /^export (interface|type) AuditInquiryPort\b/m,
    );
    // R5 absoluta
    expect(src).not.toMatch(/from\s+["']@\/generated\/prisma/);
  });

  // α8 — domain types have local AuditEntityType + AuditAction + AuditClassification type aliases
  it("α8: domain/audit.types.ts exports AuditEntityType + AuditAction + AuditClassification local types (R5 absoluta domain enum pattern)", () => {
    const src = readAuditFile("domain/audit.types.ts");
    expect(src).toMatch(/^export type AuditEntityType\b/m);
    expect(src).toMatch(/^export type AuditAction\b/m);
    expect(src).toMatch(/^export type AuditClassification\b/m);
  });
});
