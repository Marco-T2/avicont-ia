import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const OPERATIONAL_DOC_TYPE_ROOT = resolve(__dirname, "..");

function readOperationalDocTypeFile(rel: string): string {
  return readFileSync(resolve(OPERATIONAL_DOC_TYPE_ROOT, rel), "utf-8");
}

describe("C0 domain shape — OperationalDocType module (existence-only regex)", () => {
  // α1 — paired sister Expense α1 EXACT mirror
  it("OperationalDocType entity is exported from domain/operational-doc-type.entity.ts", () => {
    const src = readOperationalDocTypeFile("domain/operational-doc-type.entity.ts");
    expect(src).toMatch(/^export class OperationalDocType\b/m);
  });

  // α2 — paired sister Expense α2 EXACT mirror (R5 absoluta domain ZERO Prisma imports — local const array + type pattern)
  it("OPERATIONAL_DOC_DIRECTIONS const + OperationalDocDirection type are exported from domain/value-objects/operational-doc-direction.ts (paired sister Expense EXPENSE_CATEGORIES const array + type pattern EXACT mirror — R5 absoluta domain ZERO Prisma imports)", () => {
    const src = readOperationalDocTypeFile(
      "domain/value-objects/operational-doc-direction.ts",
    );
    expect(src).toMatch(/^export const OPERATIONAL_DOC_DIRECTIONS\b/m);
    expect(src).toMatch(/^export type OperationalDocDirection\b/m);
  });

  // α3 — paired sister Expense α3 EXACT mirror (write-tx port R7 paired sister cementado)
  it("OperationalDocTypesRepository type is exported from domain/operational-doc-type.repository.ts (write-tx port R7 paired sister cementado)", () => {
    const src = readOperationalDocTypeFile(
      "domain/operational-doc-type.repository.ts",
    );
    expect(src).toMatch(/^export (interface|type) OperationalDocTypesRepository\b/m);
  });

  // α4 — paired sister Expense α4 EXACT mirror (D3 Opt A R7 read-non-tx separation)
  it("OperationalDocTypesInquiryPort + OperationalDocTypeSnapshot types are exported from domain/ports/operational-doc-type-inquiry.port.ts (read-non-tx port R7 paired sister cementado)", () => {
    const src = readOperationalDocTypeFile(
      "domain/ports/operational-doc-type-inquiry.port.ts",
    );
    expect(src).toMatch(/^export (interface|type) OperationalDocTypesInquiryPort\b/m);
    expect(src).toMatch(/^export (interface|type) OperationalDocTypeSnapshot\b/m);
  });

  // α5 — paired sister Expense α5 EXPANDED honest (3 errors vs expense 2) — DuplicateCode + InUse derived business invariants legacy (P2002 unique constraint catch + countActivePayments > 0 deactivate guard)
  it("OperationalDocTypeNotFoundError + OperationalDocTypeDuplicateCodeError + OperationalDocTypeInUseError errors are exported from domain/errors/operational-doc-type-errors.ts (α5 EXPANDED honest paired sister Expense 2 errors → 3 errors — business invariants legacy derived)", () => {
    const src = readOperationalDocTypeFile(
      "domain/errors/operational-doc-type-errors.ts",
    );
    expect(src).toMatch(/^export class OperationalDocTypeNotFoundError\b/m);
    expect(src).toMatch(/^export class OperationalDocTypeDuplicateCodeError\b/m);
    expect(src).toMatch(/^export class OperationalDocTypeInUseError\b/m);
  });

  // α6 — paired sister Expense α6 EXACT mirror (3 types)
  it("CreateOperationalDocTypeInput + OperationalDocTypeProps + OperationalDocTypeSnapshot are exported from domain/operational-doc-type.entity.ts", () => {
    const src = readOperationalDocTypeFile("domain/operational-doc-type.entity.ts");
    expect(src).toMatch(/^export (interface|type) CreateOperationalDocTypeInput\b/m);
    expect(src).toMatch(/^export (interface|type) OperationalDocTypeProps\b/m);
    expect(src).toMatch(/^export (interface|type) OperationalDocTypeSnapshot\b/m);
  });

  // α7 — paired sister Expense α7 EXACT mirror
  it("OperationalDocType.create + OperationalDocType.fromPersistence static factories exist in domain/operational-doc-type.entity.ts", () => {
    const src = readOperationalDocTypeFile("domain/operational-doc-type.entity.ts");
    expect(src).toMatch(/static create\(/m);
    expect(src).toMatch(/static fromPersistence\(/m);
  });
});
