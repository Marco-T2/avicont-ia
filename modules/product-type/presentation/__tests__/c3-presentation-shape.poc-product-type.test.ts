import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PT_ROOT = resolve(__dirname, "..", "..");

function readPtFile(rel: string): string {
  return readFileSync(resolve(PT_ROOT, rel), "utf-8");
}

describe("C3 presentation shape — ProductType module (existence-only regex)", () => {
  // α33 — paired sister OperationalDocType α35 EXACT mirror
  it("composition-root.ts exports makeProductTypeService factory", () => {
    const src = readPtFile("presentation/composition-root.ts");
    expect(src).toMatch(/^export function makeProductTypeService\(/m);
  });

  // α34 — paired sister OperationalDocType α36 EXACT mirror (factory wires repo único)
  it("composition-root.ts factory wires PrismaProductTypesRepository único", () => {
    const src = readPtFile("presentation/composition-root.ts");
    expect(src).toMatch(/new PrismaProductTypesRepository\(/);
  });

  // α35 — paired sister OperationalDocType α37 EXACT mirror + EXPANDED (create + update schemas)
  it("validation.ts exports createProductTypeSchema + updateProductTypeSchema (Zod)", () => {
    const src = readPtFile("presentation/validation.ts");
    expect(src).toMatch(
      /^export const createProductTypeSchema\s*=\s*z\.object\(/m,
    );
    expect(src).toMatch(
      /^export const updateProductTypeSchema\s*=\s*z\.object\(/m,
    );
  });

  // α36 — paired sister OperationalDocType α38 EXACT mirror
  it("server.ts barrel re-exports makeProductTypeService from composition-root", () => {
    const src = readPtFile("presentation/server.ts");
    expect(src).toMatch(
      /^export\s*\{[^}]*\bmakeProductTypeService\b[^}]*\}\s*from\s*["']\.\/composition-root["']/m,
    );
  });

  // α37 — paired sister OperationalDocType α39 EXACT mirror + EXPANDED (create + update schemas)
  it("server.ts barrel re-exports createProductTypeSchema + updateProductTypeSchema from validation", () => {
    const src = readPtFile("presentation/server.ts");
    expect(src).toMatch(
      /^export\s*\{[^}]*\bcreateProductTypeSchema\b[^}]*\}\s*from\s*["']\.\/validation["']/m,
    );
    expect(src).toMatch(/\bupdateProductTypeSchema\b/);
  });

  // α38 — paired sister OperationalDocType α40 EXACT mirror
  it("server.ts barrel re-exports ProductTypeSnapshot + ProductTypesInquiryPort types", () => {
    const src = readPtFile("presentation/server.ts");
    expect(src).toMatch(/\bProductTypeSnapshot\b/);
    expect(src).toMatch(/\bProductTypesInquiryPort\b/);
  });

  // α39 — paired sister OperationalDocType α41 EXACT mirror
  it("server.ts barrel re-exports ProductType entity + ProductTypeService", () => {
    const src = readPtFile("presentation/server.ts");
    expect(src).toMatch(
      /\bProductType\b[\s\S]*?from\s*["']\.\.\/domain\/product-type\.entity["']/,
    );
    expect(src).toMatch(
      /\bProductTypeService\b[\s\S]*?from\s*["']\.\.\/application\/product-type\.service["']/,
    );
  });

  // α40 — paired sister OperationalDocType α42 REDUCED (2 errors vs 3)
  it("server.ts barrel re-exports ProductTypeNotFoundError + DuplicateCodeError", () => {
    const src = readPtFile("presentation/server.ts");
    expect(src).toMatch(/\bProductTypeNotFoundError\b/);
    expect(src).toMatch(/\bProductTypeDuplicateCodeError\b/);
  });
});
