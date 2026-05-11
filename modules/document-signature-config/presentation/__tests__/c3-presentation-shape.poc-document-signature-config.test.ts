import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const DSC_ROOT = resolve(__dirname, "..", "..");

function readDscFile(rel: string): string {
  return readFileSync(resolve(DSC_ROOT, rel), "utf-8");
}

describe("C3 presentation shape — DocumentSignatureConfig module (existence-only regex)", () => {
  // α28 — paired sister ProductType α33 EXACT mirror
  it("composition-root.ts exports makeDocumentSignatureConfigService factory", () => {
    const src = readDscFile("presentation/composition-root.ts");
    expect(src).toMatch(
      /^export function makeDocumentSignatureConfigService\(/m,
    );
  });

  // α29 — paired sister ProductType α34 EXACT mirror (factory wires repo único)
  it("composition-root.ts factory wires PrismaDocumentSignatureConfigsRepository único", () => {
    const src = readDscFile("presentation/composition-root.ts");
    expect(src).toMatch(/new PrismaDocumentSignatureConfigsRepository\(/);
  });

  // α30 — ADAPTED: updateSignatureConfigSchema (config entity uses upsert, single schema)
  it("validation.ts exports updateSignatureConfigSchema + signatureLabelEnum + documentPrintTypeEnum (Zod)", () => {
    const src = readDscFile("presentation/validation.ts");
    expect(src).toMatch(
      /^export const updateSignatureConfigSchema\s*=\s*z\.object\(/m,
    );
    expect(src).toMatch(
      /^export const signatureLabelEnum\s*=\s*z\.enum\(/m,
    );
    expect(src).toMatch(
      /^export const documentPrintTypeEnum\s*=\s*z\.enum\(/m,
    );
  });

  // α31 — paired sister ProductType α36 EXACT mirror
  it("server.ts barrel re-exports makeDocumentSignatureConfigService from composition-root", () => {
    const src = readDscFile("presentation/server.ts");
    expect(src).toMatch(
      /^export\s*\{[^}]*\bmakeDocumentSignatureConfigService\b[^}]*\}\s*from\s*["']\.\/composition-root["']/m,
    );
  });

  // α32 — ADAPTED: validation schemas re-export
  it("server.ts barrel re-exports updateSignatureConfigSchema + documentPrintTypeEnum + signatureLabelEnum from validation", () => {
    const src = readDscFile("presentation/server.ts");
    expect(src).toMatch(/\bupdateSignatureConfigSchema\b/);
    expect(src).toMatch(/\bdocumentPrintTypeEnum\b/);
    expect(src).toMatch(/\bsignatureLabelEnum\b/);
  });

  // α33 — paired sister ProductType α38 EXACT mirror
  it("server.ts barrel re-exports DocumentSignatureConfigSnapshot + DocumentSignatureConfigsInquiryPort types", () => {
    const src = readDscFile("presentation/server.ts");
    expect(src).toMatch(/\bDocumentSignatureConfigSnapshot\b/);
    expect(src).toMatch(/\bDocumentSignatureConfigsInquiryPort\b/);
  });

  // α34 — paired sister ProductType α39 EXACT mirror
  it("server.ts barrel re-exports DocumentSignatureConfig entity + DocumentSignatureConfigService", () => {
    const src = readDscFile("presentation/server.ts");
    expect(src).toMatch(
      /\bDocumentSignatureConfig\b[\s\S]*?from\s*["']\.\.\/domain\/document-signature-config\.entity["']/,
    );
    expect(src).toMatch(
      /\bDocumentSignatureConfigService\b[\s\S]*?from\s*["']\.\.\/application\/document-signature-config\.service["']/,
    );
  });

  // α35 — EXPANDED: DocumentSignatureConfigView + ALL_DOCUMENT_PRINT_TYPES + ALL_SIGNATURE_LABELS + domain types
  it("server.ts barrel re-exports DocumentSignatureConfigView + ALL_DOCUMENT_PRINT_TYPES + ALL_SIGNATURE_LABELS", () => {
    const src = readDscFile("presentation/server.ts");
    expect(src).toMatch(/\bDocumentSignatureConfigView\b/);
    expect(src).toMatch(/\bALL_DOCUMENT_PRINT_TYPES\b/);
    expect(src).toMatch(/\bALL_SIGNATURE_LABELS\b/);
  });
});
