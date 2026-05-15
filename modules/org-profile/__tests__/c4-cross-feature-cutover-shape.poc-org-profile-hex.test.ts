import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "../../..");

function readRepoFile(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), "utf-8");
}

// ── Regex patterns ──
const IMPORT_MAKE_OP_SERVICE_HEX_RE =
  /^import\s*\{[^}]*\bmakeOrgProfileService\b[^}]*\}\s*from\s*["']@\/modules\/org-profile\/presentation\/server["']/m;
const LEGACY_FEATURES_OP_SERVER_IMPORT_RE =
  /from\s+["']@\/features\/org-profile\/server["']/;
const LEGACY_FEATURES_OP_BARREL_IMPORT_RE =
  /from\s+["']@\/features\/org-profile["']/;
const LEGACY_FEATURES_OP_TYPES_IMPORT_RE =
  /from\s+["']@\/features\/org-profile\/org-profile\.types["']/;
const LEGACY_FEATURES_OP_VALIDATION_IMPORT_RE =
  /from\s+["']@\/features\/org-profile\/org-profile\.validation["']/;
const NEW_OP_SERVICE_CTOR_RE = /new\s+OrgProfileService\s*\(/;

describe("POC org-profile hex C4 — cross-feature cutover shape (paired sister document-signature-config C4 EXACT mirror)", () => {
  // ── A: RSC page cutover (3 pages) ──

  // α37
  it("α37: settings/company/page.tsx imports makeOrgProfileService hex + NO legacy + NO new OrgProfileService(", () => {
    const src = readRepoFile(
      "app/(dashboard)/[orgSlug]/settings/company/page.tsx",
    );
    expect(src).toMatch(IMPORT_MAKE_OP_SERVICE_HEX_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_OP_SERVER_IMPORT_RE);
    expect(src).not.toMatch(NEW_OP_SERVICE_CTOR_RE);
  });

  // α38
  it("α38: income-statement/page.tsx imports makeOrgProfileService hex + NO legacy + NO new OrgProfileService(", () => {
    const src = readRepoFile(
      "app/(dashboard)/[orgSlug]/accounting/financial-statements/income-statement/page.tsx",
    );
    expect(src).toMatch(IMPORT_MAKE_OP_SERVICE_HEX_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_OP_SERVER_IMPORT_RE);
    expect(src).not.toMatch(NEW_OP_SERVICE_CTOR_RE);
  });

  // α39
  it("α39: balance-sheet/page.tsx imports makeOrgProfileService hex + NO legacy + NO new OrgProfileService(", () => {
    const src = readRepoFile(
      "app/(dashboard)/[orgSlug]/accounting/financial-statements/balance-sheet/page.tsx",
    );
    expect(src).toMatch(IMPORT_MAKE_OP_SERVICE_HEX_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_OP_SERVER_IMPORT_RE);
    expect(src).not.toMatch(NEW_OP_SERVICE_CTOR_RE);
  });

  // ── B: API routes cutover (2 routes) ──

  // α40
  it("α40: api/profile/route.ts imports from hex barrel + NO legacy", () => {
    const src = readRepoFile(
      "app/api/organizations/[orgSlug]/profile/route.ts",
    );
    expect(src).toMatch(IMPORT_MAKE_OP_SERVICE_HEX_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_OP_SERVER_IMPORT_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_OP_BARREL_IMPORT_RE);
    expect(src).not.toMatch(NEW_OP_SERVICE_CTOR_RE);
  });

  // α41
  it("α41: api/profile/logo/route.ts imports from hex barrel + NO legacy", () => {
    const src = readRepoFile(
      "app/api/organizations/[orgSlug]/profile/logo/route.ts",
    );
    expect(src).toMatch(IMPORT_MAKE_OP_SERVICE_HEX_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_OP_SERVER_IMPORT_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_OP_BARREL_IMPORT_RE);
    expect(src).not.toMatch(NEW_OP_SERVICE_CTOR_RE);
  });

  // ── C: Cross-feature consumers ──

  // α42 — INVERTED at POC #8 OLEADA 6 sub-POC 8/8 C4 (poc-accounting-shim-
  // retirement). Genealogy: original intent asserted the legacy
  // `journal.service.ts` consumes the HEX org-profile service (not the retired
  // `@/features/org-profile`); sub-POC 7 C5 B2a updated it to
  // "journal.service.ts is a shim — NO legacy org-profile import" once the
  // file became a thin delegating shim. sub-POC 8 C4 DELETES that shim
  // outright — every `app/` consumer was repointed to `makeJournalsService()`
  // across C0–C2, and the `features/accounting/server.ts` barrel drops its
  // re-export in the same C4 GREEN. `readRepoFile` on a deleted file throws
  // ENOENT, so α42 re-inverts to assert the deletion: with the file gone the
  // "NO legacy org-profile import" invariant is vacuously and permanently
  // satisfied. Honest prior-cycle collision per
  // [[invariant_collision_elevation]], re-inverted in the C4 GREEN that causes it.
  it("α42: features/accounting/journal.service.ts DELETED (sub-POC 8/8 C4 shim retirement — legacy org-profile import vacuously absent)", () => {
    expect(
      existsSync(resolve(REPO_ROOT, "features/accounting/journal.service.ts")),
    ).toBe(false);
  });

  // ── D: Client component consumers (3 files — import from client barrel) ──

  // α43
  it("α43: company-profile-form.tsx imports UpdateOrgProfileInput from hex client barrel + NO legacy", () => {
    const src = readRepoFile(
      "components/settings/company/company-profile-form.tsx",
    );
    expect(src).toMatch(
      /from\s+["']@\/modules\/org-profile\/presentation["']/,
    );
    expect(src).not.toMatch(LEGACY_FEATURES_OP_TYPES_IMPORT_RE);
  });

  // α44
  it("α44: identity-section.tsx imports UpdateOrgProfileInput from hex client barrel + NO legacy", () => {
    const src = readRepoFile(
      "components/settings/company/identity-section.tsx",
    );
    expect(src).toMatch(
      /from\s+["']@\/modules\/org-profile\/presentation["']/,
    );
    expect(src).not.toMatch(LEGACY_FEATURES_OP_TYPES_IMPORT_RE);
  });

  // α45
  it("α45: logo-uploader.tsx imports logoUploadConstraints from hex client barrel + NO legacy", () => {
    const src = readRepoFile(
      "components/settings/company/logo-uploader.tsx",
    );
    expect(src).toMatch(
      /from\s+["']@\/modules\/org-profile\/presentation["']/,
    );
    expect(src).not.toMatch(LEGACY_FEATURES_OP_VALIDATION_IMPORT_RE);
  });

  // ── E: Test consumer ──

  // α46 — UPDATED at POC #7 OLEADA 6 sub-POC 7/8 C5 B2a.
  // Original intent: the legacy `journal.service.exportVoucherPdf.test.ts`
  // imports the `OrgProfileService` type from the HEX, not the retired
  // legacy path. C5 B2a DELETES that legacy test file as test-cementación
  // (it asserted the legacy `JournalService` class's internal
  // `exportVoucherPdf` composition; that logic now lives in the hex, covered
  // by `modules/accounting/application/__tests__/journals.service.test.ts`).
  // With the file gone the legacy-import concern is vacuously resolved.
  // Honest prior-cycle collision per [[invariant_collision_elevation]].
  it("α46: journal.service.exportVoucherPdf.test.ts removed (C5 B2a test-cementación)", () => {
    expect(
      existsSync(
        resolve(
          REPO_ROOT,
          "features/accounting/__tests__/journal.service.exportVoucherPdf.test.ts",
        ),
      ),
    ).toBe(false);
  });
});
