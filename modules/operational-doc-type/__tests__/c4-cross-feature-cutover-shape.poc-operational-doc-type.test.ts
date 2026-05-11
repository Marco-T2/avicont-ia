import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "../../..");

function readRepoFile(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), "utf-8");
}

// ── Regex patterns ──
const IMPORT_MAKE_ODT_SERVICE_HEX_RE =
  /^import\s*\{[^}]*\bmakeOperationalDocTypeService\b[^}]*\}\s*from\s*["']@\/modules\/operational-doc-type\/presentation\/server["']/m;
const LEGACY_FEATURES_ODT_SERVICE_IMPORT_RE =
  /from\s+["']@\/features\/operational-doc-types\/server["']/;
const LEGACY_FEATURES_ODT_BARREL_IMPORT_RE =
  /from\s+["']@\/features\/operational-doc-types["']/;
const NEW_ODT_SERVICE_CTOR_RE = /new\s+OperationalDocTypesService\s*\(/;
const TO_SNAPSHOT_RE = /\.toSnapshot\(\)/;

describe("POC operational-doc-type hex C4 — cross-feature cutover shape (paired sister expense C4 EXACT mirror reduced)", () => {
  // ── A: payments/new/page.tsx cutover ──
  // α43
  it("α43: payments/new/page.tsx imports makeOperationalDocTypeService hex + NO legacy + .toSnapshot() + NO new OperationalDocTypesService(", () => {
    const src = readRepoFile(
      "app/(dashboard)/[orgSlug]/payments/new/page.tsx",
    );
    expect(src).toMatch(IMPORT_MAKE_ODT_SERVICE_HEX_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_ODT_SERVICE_IMPORT_RE);
    expect(src).toMatch(TO_SNAPSHOT_RE);
    expect(src).not.toMatch(NEW_ODT_SERVICE_CTOR_RE);
  });

  // α44
  it("α44: payments/[paymentId]/page.tsx imports makeOperationalDocTypeService hex + NO legacy + .toSnapshot() + NO new OperationalDocTypesService(", () => {
    const src = readRepoFile(
      "app/(dashboard)/[orgSlug]/payments/[paymentId]/page.tsx",
    );
    expect(src).toMatch(IMPORT_MAKE_ODT_SERVICE_HEX_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_ODT_SERVICE_IMPORT_RE);
    expect(src).toMatch(TO_SNAPSHOT_RE);
    expect(src).not.toMatch(NEW_ODT_SERVICE_CTOR_RE);
  });

  // ── B: settings/operational-doc-types/page.tsx cutover ──
  // α45
  it("α45: settings/operational-doc-types/page.tsx imports makeOperationalDocTypeService hex + NO legacy + .toSnapshot() + NO new OperationalDocTypesService(", () => {
    const src = readRepoFile(
      "app/(dashboard)/[orgSlug]/settings/operational-doc-types/page.tsx",
    );
    expect(src).toMatch(IMPORT_MAKE_ODT_SERVICE_HEX_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_ODT_SERVICE_IMPORT_RE);
    expect(src).toMatch(TO_SNAPSHOT_RE);
    expect(src).not.toMatch(NEW_ODT_SERVICE_CTOR_RE);
  });

  // ── C: API routes cutover ──
  // α46
  it("α46: api/operational-doc-types/route.ts imports from hex barrel + NO legacy features/operational-doc-types + NO new OperationalDocTypesService(", () => {
    const src = readRepoFile(
      "app/api/organizations/[orgSlug]/operational-doc-types/route.ts",
    );
    expect(src).toMatch(IMPORT_MAKE_ODT_SERVICE_HEX_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_ODT_SERVICE_IMPORT_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_ODT_BARREL_IMPORT_RE);
    expect(src).not.toMatch(NEW_ODT_SERVICE_CTOR_RE);
  });

  // α47
  it("α47: api/operational-doc-types/route.ts uses .toSnapshot() for API response", () => {
    const src = readRepoFile(
      "app/api/organizations/[orgSlug]/operational-doc-types/route.ts",
    );
    expect(src).toMatch(TO_SNAPSHOT_RE);
  });

  // α48
  it("α48: api/operational-doc-types/[docTypeId]/route.ts imports from hex barrel + NO legacy features/operational-doc-types + NO new OperationalDocTypesService(", () => {
    const src = readRepoFile(
      "app/api/organizations/[orgSlug]/operational-doc-types/[docTypeId]/route.ts",
    );
    expect(src).toMatch(IMPORT_MAKE_ODT_SERVICE_HEX_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_ODT_SERVICE_IMPORT_RE);
    expect(src).not.toMatch(LEGACY_FEATURES_ODT_BARREL_IMPORT_RE);
    expect(src).not.toMatch(NEW_ODT_SERVICE_CTOR_RE);
  });

  // α49
  it("α49: api/operational-doc-types/[docTypeId]/route.ts uses .toSnapshot() for API response", () => {
    const src = readRepoFile(
      "app/api/organizations/[orgSlug]/operational-doc-types/[docTypeId]/route.ts",
    );
    expect(src).toMatch(TO_SNAPSHOT_RE);
  });

  // α50
  it("α50: api/operational-doc-types/[docTypeId]/route.ts imports OperationalDocTypeInUseError from hex (NO legacy ConflictError for deactivate guard)", () => {
    const src = readRepoFile(
      "app/api/organizations/[orgSlug]/operational-doc-types/[docTypeId]/route.ts",
    );
    expect(src).toMatch(/\bOperationalDocTypeInUseError\b/);
    expect(src).not.toMatch(
      /from\s+["']@\/features\/shared\/errors["']/,
    );
  });
});
