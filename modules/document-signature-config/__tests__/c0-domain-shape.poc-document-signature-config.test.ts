import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const DSC_ROOT = resolve(__dirname, "..");

function readDscFile(rel: string): string {
  return readFileSync(resolve(DSC_ROOT, rel), "utf-8");
}

describe("C0 domain shape — DocumentSignatureConfig module (existence-only regex)", () => {
  // α1 — paired sister ProductType α1 EXACT mirror
  it("DocumentSignatureConfig entity is exported from domain/document-signature-config.entity.ts", () => {
    const src = readDscFile("domain/document-signature-config.entity.ts");
    expect(src).toMatch(/^export class DocumentSignatureConfig\b/m);
  });

  // α2 — paired sister ProductType α2 EXACT mirror (write-tx port R7 paired sister cementado)
  it("DocumentSignatureConfigsRepository type is exported from domain/document-signature-config.repository.ts (write-tx port R7 paired sister cementado)", () => {
    const src = readDscFile("domain/document-signature-config.repository.ts");
    expect(src).toMatch(
      /^export (interface|type) DocumentSignatureConfigsRepository\b/m,
    );
  });

  // α3 — paired sister ProductType α3 EXACT mirror (D3 Opt A R7 read-non-tx separation)
  it("DocumentSignatureConfigsInquiryPort + DocumentSignatureConfigSnapshot types are exported from domain/ports/document-signature-config-inquiry.port.ts (read-non-tx port R7 paired sister cementado)", () => {
    const src = readDscFile(
      "domain/ports/document-signature-config-inquiry.port.ts",
    );
    expect(src).toMatch(
      /^export (interface|type) DocumentSignatureConfigsInquiryPort\b/m,
    );
    expect(src).toMatch(
      /^export (interface|type) DocumentSignatureConfigSnapshot\b/m,
    );
  });

  // α4 — REDUCED honest (0 domain errors — config entity upsert pattern, no not-found/duplicate guard in legacy service)
  // DocumentSignatureConfig has NO errors — it uses upsert semantics (always succeeds), no findById that throws
  // Skipped — no errors file needed

  // α5 — paired sister ProductType α5 EXACT mirror adapted (UpsertDocumentSignatureConfigInput + DocumentSignatureConfigProps + DocumentSignatureConfigSnapshot)
  it("UpsertDocumentSignatureConfigInput + DocumentSignatureConfigProps + DocumentSignatureConfigSnapshot are exported from domain/document-signature-config.entity.ts", () => {
    const src = readDscFile("domain/document-signature-config.entity.ts");
    expect(src).toMatch(
      /^export (interface|type) UpsertDocumentSignatureConfigInput\b/m,
    );
    expect(src).toMatch(
      /^export (interface|type) DocumentSignatureConfigProps\b/m,
    );
    expect(src).toMatch(
      /^export (interface|type) DocumentSignatureConfigSnapshot\b/m,
    );
  });

  // α6 — paired sister ProductType α6 EXACT mirror adapted (create → fromUpsert for config pattern)
  it("DocumentSignatureConfig.create + DocumentSignatureConfig.fromPersistence static factories exist in domain/document-signature-config.entity.ts", () => {
    const src = readDscFile("domain/document-signature-config.entity.ts");
    expect(src).toMatch(/static create\(/m);
    expect(src).toMatch(/static fromPersistence\(/m);
  });

  // α7 — EXPANDED: R5 absoluta domain ZERO Prisma imports — local const array + type pattern for enums
  it("domain/document-signature-config.entity.ts exports ALL_DOCUMENT_PRINT_TYPES + ALL_SIGNATURE_LABELS local const arrays (R5 absoluta ZERO Prisma imports)", () => {
    const src = readDscFile("domain/document-signature-config.entity.ts");
    expect(src).toMatch(/^export const ALL_DOCUMENT_PRINT_TYPES\b/m);
    expect(src).toMatch(/^export const ALL_SIGNATURE_LABELS\b/m);
    // R5 absoluta — ZERO Prisma imports
    expect(src).not.toMatch(/from\s+["']@\/generated\/prisma/);
    expect(src).not.toMatch(/from\s+["']prisma/);
  });

  // α8 — EXPANDED: DocumentPrintType + SignatureLabel local type exports (R5 domain enum pattern)
  it("domain/document-signature-config.entity.ts exports DocumentPrintType + SignatureLabel local types (R5 absoluta domain enum pattern)", () => {
    const src = readDscFile("domain/document-signature-config.entity.ts");
    expect(src).toMatch(/^export type DocumentPrintType\b/m);
    expect(src).toMatch(/^export type SignatureLabel\b/m);
  });
});
