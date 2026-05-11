import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ODT_ROOT = resolve(__dirname, "..", "..");

function readOdtFile(rel: string): string {
  return readFileSync(resolve(ODT_ROOT, rel), "utf-8");
}

describe("C3 presentation shape — OperationalDocType module (existence-only regex)", () => {
  // α35 — paired sister Expense α38 EXACT mirror
  it("composition-root.ts exports makeOperationalDocTypeService factory", () => {
    const src = readOdtFile("presentation/composition-root.ts");
    expect(src).toMatch(/^export function makeOperationalDocTypeService\(/m);
  });

  // α36 — paired sister Expense α39 EXACT mirror (factory wires repo único)
  it("composition-root.ts factory wires PrismaOperationalDocTypesRepository único", () => {
    const src = readOdtFile("presentation/composition-root.ts");
    expect(src).toMatch(/new PrismaOperationalDocTypesRepository\(/);
  });

  // α37 — paired sister Expense α40 EXACT mirror + EXPANDED (create + update schemas)
  it("validation.ts exports createOperationalDocTypeSchema + updateOperationalDocTypeSchema (Zod)", () => {
    const src = readOdtFile("presentation/validation.ts");
    expect(src).toMatch(
      /^export const createOperationalDocTypeSchema\s*=\s*z\.object\(/m,
    );
    expect(src).toMatch(
      /^export const updateOperationalDocTypeSchema\s*=\s*z\.object\(/m,
    );
  });

  // α38 — paired sister Expense α42 EXACT mirror
  it("server.ts barrel re-exports makeOperationalDocTypeService from composition-root", () => {
    const src = readOdtFile("presentation/server.ts");
    expect(src).toMatch(
      /^export\s*\{[^}]*\bmakeOperationalDocTypeService\b[^}]*\}\s*from\s*["']\.\/composition-root["']/m,
    );
  });

  // α39 — paired sister Expense α43 EXACT mirror + EXPANDED (create + update schemas)
  it("server.ts barrel re-exports createOperationalDocTypeSchema + updateOperationalDocTypeSchema from validation", () => {
    const src = readOdtFile("presentation/server.ts");
    expect(src).toMatch(
      /^export\s*\{[^}]*\bcreateOperationalDocTypeSchema\b[^}]*\}\s*from\s*["']\.\/validation["']/m,
    );
    expect(src).toMatch(/\bupdateOperationalDocTypeSchema\b/);
  });

  // α40 — paired sister Expense α44 EXACT mirror
  it("server.ts barrel re-exports OperationalDocTypeSnapshot + OperationalDocTypesInquiryPort types", () => {
    const src = readOdtFile("presentation/server.ts");
    expect(src).toMatch(/\bOperationalDocTypeSnapshot\b/);
    expect(src).toMatch(/\bOperationalDocTypesInquiryPort\b/);
  });

  // α41 — paired sister Expense α45 EXACT mirror
  it("server.ts barrel re-exports OperationalDocType entity + OperationalDocTypeService + OperationalDocDirection", () => {
    const src = readOdtFile("presentation/server.ts");
    expect(src).toMatch(
      /\bOperationalDocType\b[\s\S]*?from\s*["']\.\.\/domain\/operational-doc-type\.entity["']/,
    );
    expect(src).toMatch(
      /\bOperationalDocTypeService\b[\s\S]*?from\s*["']\.\.\/application\/operational-doc-type\.service["']/,
    );
    expect(src).toMatch(/\bOperationalDocDirection\b/);
  });

  // α42 — paired sister Expense EXPANDED (error re-exports include 3 errors)
  it("server.ts barrel re-exports OperationalDocTypeNotFoundError + DuplicateCodeError + InUseError", () => {
    const src = readOdtFile("presentation/server.ts");
    expect(src).toMatch(/\bOperationalDocTypeNotFoundError\b/);
    expect(src).toMatch(/\bOperationalDocTypeDuplicateCodeError\b/);
    expect(src).toMatch(/\bOperationalDocTypeInUseError\b/);
  });
});
