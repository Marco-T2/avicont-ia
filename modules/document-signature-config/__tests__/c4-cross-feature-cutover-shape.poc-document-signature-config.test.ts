import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "../../..");

function readRepoFile(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), "utf-8");
}

// ── Regex patterns ──
const IMPORT_MAKE_DSC_SERVICE_HEX_RE =
  /^import\s*\{[^}]*\bmakeDocumentSignatureConfigService\b[^}]*\}\s*from\s*["']@\/modules\/document-signature-config\/presentation\/server["']/m;
const LEGACY_FEATURES_DSC_SERVER_IMPORT_RE =
  /from\s+["']@\/features\/document-signature-config\/server["']/;
const LEGACY_FEATURES_DSC_BARREL_IMPORT_RE =
  /from\s+["']@\/features\/document-signature-config["']/;
const LEGACY_FEATURES_DSC_TYPES_IMPORT_RE =
  /from\s+["']@\/features\/document-signature-config\/document-signature-config\.types["']/;
const NEW_DSC_SERVICE_CTOR_RE = /new\s+DocumentSignatureConfigService\s*\(/;

describe("POC document-signature-config hex C4 — cross-feature cutover shape (paired sister product-type C4 EXACT mirror)", () => {
  // ── A: settings/company/page.tsx cutover ──
  // α36
  it("α36: settings/company/page.tsx imports makeDocumentSignatureConfigService hex + NO legacy + NO new DocumentSignatureConfigService(", () => {
    const src = readRepoFile(
      "app/(dashboard)/[orgSlug]/settings/company/page.tsx",
    );
    expect(src).toMatch(IMPORT_MAKE_DSC_SERVICE_HEX_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_DSC_SERVER_IMPORT_RE);
    expect(src).not.toMatch(NEW_DSC_SERVICE_CTOR_RE);
  });

  // ── B: API routes cutover ──
  // α37
  it("α37: api/signature-configs/route.ts imports from hex barrel + NO legacy + NO new DocumentSignatureConfigService(", () => {
    const src = readRepoFile(
      "app/api/organizations/[orgSlug]/signature-configs/route.ts",
    );
    expect(src).toMatch(IMPORT_MAKE_DSC_SERVICE_HEX_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_DSC_SERVER_IMPORT_RE);
    expect(src).not.toMatch(NEW_DSC_SERVICE_CTOR_RE);
  });

  // α38
  it("α38: api/signature-configs/[documentType]/route.ts imports from hex barrel + NO legacy features/document-signature-config + NO new DocumentSignatureConfigService(", () => {
    const src = readRepoFile(
      "app/api/organizations/[orgSlug]/signature-configs/[documentType]/route.ts",
    );
    expect(src).toMatch(IMPORT_MAKE_DSC_SERVICE_HEX_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_DSC_SERVER_IMPORT_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_DSC_BARREL_IMPORT_RE);
    expect(src).not.toMatch(NEW_DSC_SERVICE_CTOR_RE);
  });

  // ── C: features/accounting cross-feature consumers ──
  // α39
  it("α39: features/accounting/journal.service.ts imports makeDocumentSignatureConfigService from hex + NO legacy", () => {
    const src = readRepoFile("features/accounting/journal.service.ts");
    expect(src).toMatch(
      /from\s+["']@\/modules\/document-signature-config\/presentation\/server["']/,
    );
    expect(src).not.toMatch(LEGACY_FEATURES_DSC_SERVER_IMPORT_RE);
  });

  // α40
  it("α40: features/accounting/exporters/voucher-pdf.composer.ts imports types from hex + NO legacy", () => {
    const src = readRepoFile(
      "features/accounting/exporters/voucher-pdf.composer.ts",
    );
    expect(src).toMatch(
      /from\s+["']@\/modules\/document-signature-config\/presentation\/server["']/,
    );
    expect(src).not.toMatch(LEGACY_FEATURES_DSC_SERVER_IMPORT_RE);
  });

  // ── D: Test files mock path update ──
  // α41
  it("α41: api/signature-configs/__tests__/route.test.ts mocks hex path + imports ALL_DOCUMENT_PRINT_TYPES from hex", () => {
    const src = readRepoFile(
      "app/api/organizations/[orgSlug]/signature-configs/__tests__/route.test.ts",
    );
    expect(src).toMatch(
      /vi\.mock\(["']@\/modules\/document-signature-config\/presentation\/server["']/,
    );
    expect(src).not.toMatch(LEGACY_FEATURES_DSC_SERVER_IMPORT_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_DSC_BARREL_IMPORT_RE);
  });

  // α42
  it("α42: api/signature-configs/[documentType]/__tests__/route.test.ts mocks hex path + NO legacy", () => {
    const src = readRepoFile(
      "app/api/organizations/[orgSlug]/signature-configs/[documentType]/__tests__/route.test.ts",
    );
    expect(src).toMatch(
      /vi\.mock\(["']@\/modules\/document-signature-config\/presentation\/server["']/,
    );
    expect(src).not.toMatch(LEGACY_FEATURES_DSC_SERVER_IMPORT_RE);
  });

  // α43
  it("α43: settings/company/__tests__/page.test.ts mocks hex path + NO legacy", () => {
    const src = readRepoFile(
      "app/(dashboard)/[orgSlug]/settings/company/__tests__/page.test.ts",
    );
    expect(src).toMatch(
      /vi\.mock\(["']@\/modules\/document-signature-config\/presentation\/server["']/,
    );
    expect(src).not.toMatch(LEGACY_FEATURES_DSC_SERVER_IMPORT_RE);
  });

  // α44
  it("α44: features/accounting/__tests__/journal.service.exportVoucherPdf.test.ts imports types from hex + NO legacy", () => {
    const src = readRepoFile(
      "features/accounting/__tests__/journal.service.exportVoucherPdf.test.ts",
    );
    expect(src).not.toMatch(LEGACY_FEATURES_DSC_SERVER_IMPORT_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_DSC_TYPES_IMPORT_RE);
  });

  // α45
  it("α45: features/accounting/exporters/__tests__/voucher-pdf.composer.test.ts imports types from hex + NO legacy", () => {
    const src = readRepoFile(
      "features/accounting/exporters/__tests__/voucher-pdf.composer.test.ts",
    );
    expect(src).not.toMatch(LEGACY_FEATURES_DSC_TYPES_IMPORT_RE);
  });
});
