import { existsSync, readFileSync } from "node:fs";
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
  // α39 — UPDATED at POC #7 OLEADA 6 sub-POC 7/8 C5 B2a.
  // Original intent: the legacy `journal.service.ts` consumes the HEX
  // document-signature-config service (for `exportVoucherPdf`), NOT the
  // retired `@/features/document-signature-config`. C5 B2a converts
  // `journal.service.ts` into a thin delegating SHIM over the hex
  // `JournalsService` — the doc-sig-config dependency now lives entirely
  // inside the hex use case; the shim imports neither the hex DSC service
  // nor the legacy one. The "NO legacy import" half of the invariant STILL
  // holds (asserted below); the positive "imports the hex DSC service" half
  // is obsolete — a pure delegating shim has no such import. Honest
  // prior-cycle collision per [[invariant_collision_elevation]].
  it("α39: features/accounting/journal.service.ts is a shim — NO legacy document-signature-config import", () => {
    const src = readRepoFile("features/accounting/journal.service.ts");
    expect(src).not.toMatch(LEGACY_FEATURES_DSC_SERVER_IMPORT_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_DSC_BARREL_IMPORT_RE);
    // It delegates to the hex JournalsService, which owns the DSC dep.
    expect(src).toMatch(
      /from\s+["']@\/modules\/accounting\/presentation\/server["']/,
    );
  });

  // α40
  it("α40: modules/accounting/infrastructure/exporters/voucher-pdf.composer.ts imports types from hex + NO legacy", () => {
    const src = readRepoFile(
      "modules/accounting/infrastructure/exporters/voucher-pdf.composer.ts",
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

  // α44 — UPDATED at POC #7 OLEADA 6 sub-POC 7/8 C5 B2a.
  // Original intent: the legacy `journal.service.exportVoucherPdf.test.ts`
  // imports doc-sig-config types from the HEX, not the retired legacy path.
  // C5 B2a DELETES that legacy test file as test-cementación — it
  // constructed `new JournalService(mockRepo, ...)` and asserted the legacy
  // class's internal `exportVoucherPdf` composition; with `journal.service.ts`
  // now a thin shim that logic lives in the hex, where
  // `modules/accounting/application/__tests__/journals.service.test.ts`
  // already covers it (2 assertions ported in the C5 GREEN — `getOrDefault
  // COMPROBANTE` + no-logo render). With the file gone the legacy-import
  // concern is vacuously resolved. Honest prior-cycle collision per
  // [[invariant_collision_elevation]].
  it("α44: features/accounting/__tests__/journal.service.exportVoucherPdf.test.ts removed (C5 B2a test-cementación)", () => {
    expect(
      existsSync(
        resolve(
          REPO_ROOT,
          "features/accounting/__tests__/journal.service.exportVoucherPdf.test.ts",
        ),
      ),
    ).toBe(false);
  });

  // α45
  it("α45: modules/accounting/infrastructure/exporters/__tests__/voucher-pdf.composer.test.ts imports types from hex + NO legacy", () => {
    const src = readRepoFile(
      "modules/accounting/infrastructure/exporters/__tests__/voucher-pdf.composer.test.ts",
    );
    expect(src).not.toMatch(LEGACY_FEATURES_DSC_TYPES_IMPORT_RE);
  });
});
